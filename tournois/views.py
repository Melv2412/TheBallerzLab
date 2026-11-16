from django.conf import settings
from django.contrib.auth.models import User
from django.db import DatabaseError, connection, transaction
from django.db.models import Count, F
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from . import journal
from . import reglement as regles
from .models import Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from .organisateurs import est_organisateur_valide, limite_tournois_atteinte, nb_tournois_actifs
from .phases_finales import generer_phases_finales, resume_phases_finales
from .serializers import (
    ActionMatchSerializer,
    EquipeSerializer,
    JoueurSerializer,
    MatchListSerializer,
    MatchSerializer,
    StatistiqueJoueurSerializer,
    TournoiSerializer,
    UpdateStatistiqueSerializer,
    UserSerializer,
)
from .services import classement_du_tournoi, meilleurs_joueurs


@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def health(request):
    """Vérifie que l'API répond et que la base est joignable (appelé par le cron keep-alive)."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return Response({'status': 'erreur', 'database': False}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({'status': 'ok', 'database': True})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def reglements(request):
    """Préréglages disponibles (FIBA, NBA, 3x3) et bornes des réglages, pour les formulaires."""
    return Response({
        'presets': regles.PRESETS,
        'bornes': regles.BORNES,
        'modifiables_en_cours': sorted(regles.REGLAGES_MODIFIABLES_EN_COURS),
    })


def get_tournoi(obj):
    """Retourne le tournoi auquel un objet est rattaché."""
    if isinstance(obj, Tournoi):
        return obj
    if isinstance(obj, (Equipe, Match)):
        return obj.tournoi
    if isinstance(obj, Joueur):
        return obj.equipe.tournoi
    if isinstance(obj, StatistiqueJoueur):
        return obj.match.tournoi
    return None


def peut_modifier(user, tournoi):
    """Seul l'organisateur modifie un tournoi ; les tournois sans organisateur sont réservés au staff."""
    if tournoi is None or not user.is_authenticated:
        return False
    if tournoi.organisateur_id is None:
        return user.is_staff
    return tournoi.organisateur_id == user.id


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Permission personnalisée : seul l'organisateur du tournoi peut modifier l'objet."""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return peut_modifier(request.user, get_tournoi(obj))


class OrganisateurRequisMixin:
    """
    Vérifie aussi le tournoi *ciblé* lors d'une création ou d'une modification
    (has_object_permission ne voit que l'objet existant, jamais les données envoyées).
    """
    def get_tournoi_cible(self, serializer):
        data = serializer.validated_data
        if 'tournoi' in data:
            return data['tournoi']
        if 'equipe' in data:
            return data['equipe'].tournoi
        if 'match' in data:
            return data['match'].tournoi
        return get_tournoi(serializer.instance)

    def verifier_organisateur(self, serializer):
        if not peut_modifier(self.request.user, self.get_tournoi_cible(serializer)):
            raise PermissionDenied("Vous n'êtes pas l'organisateur de ce tournoi.")

    def perform_create(self, serializer):
        self.verifier_organisateur(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self.verifier_organisateur(serializer)
        serializer.save()


class UserViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """ViewSet pour l'inscription uniquement (pas de liste, modification ni suppression)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'inscription'

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[])
    def me(self, request):
        """Profil de l'utilisateur connecté : peut-il créer un tournoi ?"""
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'is_staff': user.is_staff,
            'organisateur_valide': est_organisateur_valide(user),
            'tournois_actifs': nb_tournois_actifs(user),
            'limite_tournois_actifs': None if user.is_staff else settings.LIMITE_TOURNOIS_ACTIFS,
        })


class TournoiViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les tournois."""
    serializer_class = TournoiSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom']

    def get_queryset(self):
        # Les compteurs sont calculés par la base en une seule requête
        return Tournoi.objects.select_related('organisateur').annotate(
            nb_equipes=Count('equipes', distinct=True),
            nb_matchs=Count('matchs', distinct=True),
        ).order_by(*Tournoi._meta.ordering)  # ordering du Meta ignoré avec annotate()

    def get_object(self):
        # Les slugs ne sont jamais purement numériques : une valeur numérique est un ID
        val = self.kwargs[self.lookup_field]
        filtre = {'id': val} if val.isdigit() else {'slug': val}
        tournoi = get_object_or_404(self.get_queryset(), **filtre)
        self.check_object_permissions(self.request, tournoi)
        return tournoi

    def perform_create(self, serializer):
        user = self.request.user
        if not est_organisateur_valide(user):
            raise PermissionDenied(
                "Ton compte organisateur est en attente de validation par l'équipe THE LAB."
            )
        if limite_tournois_atteinte(user):
            raise ValidationError({'detail': (
                f"Tu as déjà {settings.LIMITE_TOURNOIS_ACTIFS} tournois en cours ou à venir. "
                "Un tournoi libère sa place une fois sa date de fin passée."
            )})
        # L'organisateur est l'utilisateur connecté
        serializer.save(organisateur=user)

    @action(detail=True, methods=['get'])
    def classement(self, request, slug=None):
        """Classement des équipes du tournoi (?type=poule ou ?type=elimination)."""
        return Response(classement_du_tournoi(self.get_object(), request.query_params.get('type')))

    @action(detail=True, methods=['get'])
    def mvp(self, request, slug=None):
        """Top 5 des joueurs à la meilleure évaluation moyenne (?type=poule ou ?type=elimination)."""
        return Response(meilleurs_joueurs(self.get_object(), request.query_params.get('type')))

    @action(detail=True, methods=['get'])
    def phases_finales(self, request, slug=None):
        """État des séries de chaque phase finale (victoires, vainqueur, matchs)."""
        return Response(resume_phases_finales(self.get_object()))

    @action(detail=True, methods=['post'])
    def generer_phases_finales(self, request, slug=None):
        """Crée le premier tour des phases finales d'après le classement de poule."""
        tournoi = self.get_object()  # vérifie que l'utilisateur est l'organisateur
        generer_phases_finales(tournoi)
        return Response(resume_phases_finales(tournoi), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reset_playoffs(self, request, slug=None):
        """Réinitialise les playoffs pour ce tournoi (soit tout, soit à partir d'une phase)."""
        tournoi = self.get_object()  # vérifie que l'utilisateur est l'organisateur

        phase = request.data.get('phase', None)
        phases_ordre = ['8eme', 'quart', 'demi', 'finale']

        if phase and phase in phases_ordre:
            idx = phases_ordre.index(phase)
            phases_a_supprimer = phases_ordre[idx:]
            matchs_a_supprimer = tournoi.matchs.filter(phase__in=phases_a_supprimer)
            count = matchs_a_supprimer.count()
            matchs_a_supprimer.delete()
            return Response({"message": f"Réinitialisation en cascade réussie. {count} matchs éliminatoires supprimés (phases: {', '.join(phases_a_supprimer)})."})
        else:
            matchs_playoffs = tournoi.matchs.exclude(phase='poule')
            count = matchs_playoffs.count()
            matchs_playoffs.delete()
            return Response({"message": f"Réinitialisation totale des playoffs réussie. {count} matchs éliminatoires supprimés."})


class EquipeViewSet(OrganisateurRequisMixin, viewsets.ModelViewSet):
    """ViewSet pour gérer les équipes."""
    queryset = Equipe.objects.select_related('tournoi').all()
    serializer_class = EquipeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = Equipe.objects.select_related('tournoi').annotate(nb_joueurs=Count('joueurs')).order_by(*Equipe._meta.ordering)
        tournoi_param = self.request.query_params.get('tournoi', None)
        if tournoi_param:
            if tournoi_param.isdigit():
                queryset = queryset.filter(tournoi_id=tournoi_param)
            else:
                queryset = queryset.filter(tournoi__slug=tournoi_param)
        return queryset


class JoueurViewSet(OrganisateurRequisMixin, viewsets.ModelViewSet):
    """ViewSet pour gérer les joueurs."""
    queryset = Joueur.objects.select_related('equipe', 'equipe__tournoi').all()
    serializer_class = JoueurSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = Joueur.objects.select_related('equipe', 'equipe__tournoi').all()
        equipe_id = self.request.query_params.get('equipe', None)
        if equipe_id:
            queryset = queryset.filter(equipe_id=equipe_id)
        # Tous les joueurs d'un tournoi en une requête (par ID ou slug)
        tournoi_param = self.request.query_params.get('tournoi', None)
        if tournoi_param:
            if tournoi_param.isdigit():
                queryset = queryset.filter(equipe__tournoi_id=tournoi_param)
            else:
                queryset = queryset.filter(equipe__tournoi__slug=tournoi_param)
        return queryset


class MatchViewSet(OrganisateurRequisMixin, viewsets.ModelViewSet):
    """ViewSet pour gérer les matchs."""
    queryset = Match.objects.select_related(
        'tournoi__organisateur', 'equipe_domicile', 'equipe_exterieur'
    ).prefetch_related('statistiques_joueurs__joueur__equipe').all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        return MatchSerializer

    def get_queryset(self):
        queryset = Match.objects.select_related('tournoi__organisateur', 'equipe_domicile', 'equipe_exterieur')
        # La liste n'affiche pas les stats des joueurs : inutile de les charger
        if self.action != 'list':
            queryset = queryset.prefetch_related('statistiques_joueurs__joueur__equipe')

        tournoi_param = self.request.query_params.get('tournoi', None)
        statut = self.request.query_params.get('statut', None)

        if tournoi_param:
            if tournoi_param.isdigit():
                queryset = queryset.filter(tournoi_id=tournoi_param)
            else:
                queryset = queryset.filter(tournoi__slug=tournoi_param)
        if statut:
            queryset = queryset.filter(statut=statut)

        return queryset

    def _refuser_si_termine(self, match):
        if match.statut == 'termine':
            raise ValidationError({'detail': "Match terminé : repassez-le « en cours » pour le modifier."})

    def _match_verrouille(self, pk):
        """Match relu sous verrou : deux actions simultanées ne se marchent pas dessus."""
        match = Match.objects.select_for_update().get(pk=pk)
        self._refuser_si_termine(match)
        return match

    def _reponse_match(self, match):
        return Response(MatchSerializer(self.get_queryset().get(pk=match.pk)).data)

    @action(detail=True, methods=['post'])
    def initialiser_stats(self, request, pk=None):
        """Initialise les statistiques pour tous les joueurs des deux équipes."""
        match = self.get_object()
        self._refuser_si_termine(match)

        stats_crees = []
        for joueur in Joueur.objects.filter(equipe__in=[match.equipe_domicile_id, match.equipe_exterieur_id]):
            stat, created = StatistiqueJoueur.objects.get_or_create(joueur=joueur, match=match)
            if created:
                stats_crees.append(stat)

        serializer = StatistiqueJoueurSerializer(stats_crees, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def temps_mort(self, request, pk=None):
        """Accorde un temps mort à une équipe ({"equipe": "domicile"|"exterieur"}) et arrête le chrono."""
        cote = request.data.get('equipe')
        if cote not in ('domicile', 'exterieur'):
            raise ValidationError({'equipe': "Choisir domicile ou exterieur."})
        self.get_object()  # permissions

        with transaction.atomic():
            match = self._match_verrouille(pk)
            match.figer_chrono(timezone.now())
            periode = match.periode_actuelle
            if match.temps_morts_restants(cote, periode) <= 0:
                raise ValidationError({'detail': "Plus de temps mort disponible pour cette équipe."})
            segment = regles.segment_temps_morts(match.reglement, periode)
            if segment != match.temps_morts_segment:
                match.temps_morts_segment = segment
                match.temps_morts_utilises_domicile = match.temps_morts_utilises_exterieur = 0
            setattr(match, f'temps_morts_utilises_{cote}', getattr(match, f'temps_morts_utilises_{cote}') + 1)
            match.chrono_en_cours = False
            match.chrono_demarre_a = None
            match.save()
            journal.enregistrer(match, 'temps_mort', auteur=request.user, cote=cote)
        return self._reponse_match(match)

    @action(detail=True, methods=['post'])
    def periode_suivante(self, request, pk=None):
        """Passe à la période suivante (prolongation au-delà du temps réglementaire), chrono arrêté."""
        self.get_object()  # permissions
        with transaction.atomic():
            match = self._match_verrouille(pk)
            match.figer_chrono(timezone.now())
            match.periode_actuelle += 1
            match.temps_restant_secondes = regles.duree_periode(match.reglement, match.periode_actuelle)
            match.shot_clock_secondes = regles.shot_clock_initial(match.reglement)
            match.chrono_en_cours = False
            match.chrono_demarre_a = None
            match.save()
            journal.enregistrer(match, 'periode', auteur=request.user)
        return self._reponse_match(match)

    @action(detail=True, methods=['get'])
    def actions(self, request, pk=None):
        """Historique du match, de la plus récente à la plus ancienne action."""
        match = self.get_object()
        return Response(ActionMatchSerializer(match.actions.all(), many=True).data)

    @action(detail=True, methods=['post'])
    def annuler_derniere_action(self, request, pk=None):
        """Annule la dernière stat ou le dernier temps mort (l'action reste dans l'historique, marquée annulée)."""
        self.get_object()  # permissions
        with transaction.atomic():
            match = self._match_verrouille(pk)
            journal.annuler_derniere_action(match)
        return self._reponse_match(match)

    @action(detail=True, methods=['patch'], url_path='stats/(?P<stat_id>[^/.]+)/update')
    def update_statistique(self, request, pk=None, stat_id=None):
        """Met à jour une statistique d'un joueur (et les fautes d'équipe pour une faute)."""
        self.get_object()  # permissions
        serializer = UpdateStatistiqueSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        champ = serializer.validated_data['champ']
        valeur = serializer.validated_data['valeur']
        ajout = serializer.validated_data['action'] == 'increment'

        with transaction.atomic():
            match = self._match_verrouille(pk)
            stat = get_object_or_404(StatistiqueJoueur.objects.select_related('joueur'), id=stat_id, match=match)

            exclusion = match.reglement['fautes_exclusion']
            if ajout and exclusion and stat.fautes >= exclusion:
                raise ValidationError({'detail': f"Joueur exclu ({exclusion} fautes) : il ne peut plus rien enregistrer."})

            avant = getattr(stat, champ)
            nouvelle_valeur = F(champ) + valeur if ajout else Greatest(F(champ) - valeur, 0)
            # Mise à jour atomique en base : deux clics simultanés ne s'écrasent pas
            StatistiqueJoueur.objects.filter(pk=stat.pk).update(**{champ: nouvelle_valeur, 'updated_at': timezone.now()})
            stat.refresh_from_db()

            cote = 'domicile' if stat.joueur.equipe_id == match.equipe_domicile_id else 'exterieur'
            variation = getattr(stat, champ) - avant
            if champ == 'fautes':
                self._compter_faute_equipe(match, cote, variation)
            match.calculer_scores_depuis_stats()
            if variation:
                journal.enregistrer(
                    match, 'stat', auteur=request.user, cote=cote, statistique=stat, champ=champ, valeur=variation,
                )

        return Response({
            'statistique': StatistiqueJoueurSerializer(stat).data,
            'match': {'score_domicile': match.score_domicile, 'score_exterieur': match.score_exterieur},
        }, status=status.HTTP_200_OK)

    @staticmethod
    def _compter_faute_equipe(match, cote, delta):
        """Reporte la variation des fautes d'un joueur sur les fautes d'équipe de la portion en cours."""
        segment = regles.segment_fautes(match.reglement, match.etat_chrono()['periode_actuelle'])
        if segment != match.fautes_equipe_segment:
            if delta <= 0:
                return  # correction d'une faute d'une portion précédente : rien à retirer
            match.fautes_equipe_segment = segment
            match.fautes_equipe_domicile = match.fautes_equipe_exterieur = 0
        champ = f'fautes_equipe_{cote}'
        setattr(match, champ, max(0, getattr(match, champ) + delta))
        match.save(update_fields=['fautes_equipe_segment', 'fautes_equipe_domicile', 'fautes_equipe_exterieur'])


class StatistiqueJoueurViewSet(viewsets.ReadOnlyModelViewSet):
    """Statistiques des joueurs, en lecture : elles se modifient par les actions du match (règles appliquées)."""
    queryset = StatistiqueJoueur.objects.select_related(
        'joueur__equipe', 'match'
    ).all()
    serializer_class = StatistiqueJoueurSerializer

    def get_queryset(self):
        queryset = StatistiqueJoueur.objects.select_related(
            'joueur__equipe', 'match'
        ).all()

        match_id = self.request.query_params.get('match', None)
        if match_id:
            queryset = queryset.filter(match_id=match_id)

        return queryset

