from rest_framework import viewsets, mixins, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django.db.models import Count, F, Sum
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth.models import User
from .models import Tournoi, Equipe, Joueur, Match, StatistiqueJoueur
from .serializers import (
    UserSerializer, TournoiSerializer, EquipeSerializer, JoueurSerializer,
    MatchSerializer, MatchListSerializer, StatistiqueJoueurSerializer,
    UpdateStatistiqueSerializer
)


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
        # L'organisateur est l'utilisateur connecté
        serializer.save(organisateur=self.request.user)

    @action(detail=True, methods=['get'])
    def classement(self, request, slug=None):
        """Calcule le classement des équipes du tournoi."""
        tournoi = self.get_object()
            
        matchs_termines = tournoi.matchs.filter(statut='termine')

        type_param = request.query_params.get('type', None)
        if type_param == 'poule':
            matchs_termines = matchs_termines.filter(phase='poule')
        elif type_param == 'elimination':
            matchs_termines = matchs_termines.exclude(phase='poule')

        # 2 requêtes au total (équipes + matchs), le calcul se fait en mémoire
        classement = {
            equipe.id: {
                'id': equipe.id,
                'nom': equipe.nom,
                'joues': 0,
                'gagnes': 0,
                'perdus': 0,
                'points_pour': 0,
                'points_contre': 0,
                'points': 0  # 2 pts par victoire, 1 pt par défaite
            }
            for equipe in tournoi.equipes.all()
        }

        scores = matchs_termines.values_list(
            'equipe_domicile_id', 'equipe_exterieur_id', 'score_domicile', 'score_exterieur'
        )
        for domicile, exterieur, score_dom, score_ext in scores:
            for equipe_id, pour, contre in ((domicile, score_dom, score_ext), (exterieur, score_ext, score_dom)):
                stats = classement.get(equipe_id)
                if stats is None:
                    continue
                stats['joues'] += 1
                stats['points_pour'] += pour
                stats['points_contre'] += contre
                if pour > contre:
                    stats['gagnes'] += 1
                    stats['points'] += 2
                else:
                    stats['perdus'] += 1
                    stats['points'] += 1

        classement_data = list(classement.values())
        for stats in classement_data:
            stats['difference'] = stats['points_pour'] - stats['points_contre']

        # Trier le classement par points, puis par différence
        classement_data.sort(key=lambda x: (x['points'], x['difference']), reverse=True)

        return Response(classement_data)

    @action(detail=True, methods=['get'])
    def mvp(self, request, slug=None):
        """Trouve le MVP du tournoi (meilleure évaluation moyenne)."""
        tournoi = self.get_object()
            
        stats = StatistiqueJoueur.objects.filter(joueur__equipe__tournoi=tournoi, match__statut='termine')

        type_param = request.query_params.get('type', None)
        if type_param == 'poule':
            stats = stats.filter(match__phase='poule')
        elif type_param == 'elimination':
            stats = stats.exclude(match__phase='poule')

        # Une seule requête : la base additionne les stats de chaque joueur
        totaux = (
            stats.values(
                'joueur_id', 'joueur__prenom', 'joueur__nom', 'joueur__numero_maillot', 'joueur__equipe__nom',
            )
            .annotate(
                nb_matchs=Count('id'),
                total_eval=Sum(F('points') + F('passes') + F('rebonds') + F('contres') - F('fautes')),
                total_points=Sum('points'),
            )
            .order_by('joueur__equipe', 'joueur__numero_maillot')
        )

        mvp_data = [
            {
                'id': t['joueur_id'],
                'nom': f"{t['joueur__prenom']} {t['joueur__nom']}",
                'numero': t['joueur__numero_maillot'],
                'equipe': t['joueur__equipe__nom'],
                'moyenne_eval': round(t['total_eval'] / t['nb_matchs'], 1),
                'total_points': t['total_points'],
                'nb_matchs': t['nb_matchs'],
            }
            for t in totaux
        ]

        mvp_data.sort(key=lambda x: x['moyenne_eval'], reverse=True)
        return Response(mvp_data[:5])  # Top 5 des joueurs

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

    @action(detail=True, methods=['post'])
    def initialiser_stats(self, request, pk=None):
        """Initialise les statistiques pour tous les joueurs des deux équipes."""
        match = self.get_object()
        
        # Récupérer tous les joueurs des deux équipes
        joueurs_domicile = Joueur.objects.filter(equipe=match.equipe_domicile)
        joueurs_exterieur = Joueur.objects.filter(equipe=match.equipe_exterieur)
        
        stats_crees = []
        
        # Créer les stats pour les joueurs de l'équipe domicile
        for joueur in joueurs_domicile:
            stat, created = StatistiqueJoueur.objects.get_or_create(
                joueur=joueur,
                match=match,
                defaults={'points': 0, 'passes': 0, 'rebonds': 0, 'contres': 0, 'fautes': 0}
            )
            if created:
                stats_crees.append(stat)
        
        # Créer les stats pour les joueurs de l'équipe extérieur
        for joueur in joueurs_exterieur:
            stat, created = StatistiqueJoueur.objects.get_or_create(
                joueur=joueur,
                match=match,
                defaults={'points': 0, 'passes': 0, 'rebonds': 0, 'contres': 0, 'fautes': 0}
            )
            if created:
                stats_crees.append(stat)
        
        serializer = StatistiqueJoueurSerializer(stats_crees, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='stats/(?P<stat_id>[^/.]+)/update')
    def update_statistique(self, request, pk=None, stat_id=None):
        """Met à jour une statistique spécifique d'un joueur."""
        match = self.get_object()
        stat = get_object_or_404(StatistiqueJoueur, id=stat_id, match=match)
        
        serializer = UpdateStatistiqueSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        champ = serializer.validated_data['champ']
        valeur = serializer.validated_data['valeur']

        # Mise à jour atomique en base : deux clics simultanés ne s'écrasent pas
        if serializer.validated_data['action'] == 'increment':
            nouvelle_valeur = F(champ) + valeur
        else:
            nouvelle_valeur = Greatest(F(champ) - valeur, 0)
        StatistiqueJoueur.objects.filter(pk=stat.pk).update(
            **{champ: nouvelle_valeur, 'updated_at': timezone.now()}
        )
        stat.refresh_from_db()
        match.calculer_scores_depuis_stats()

        serializer_response = StatistiqueJoueurSerializer(stat)
        match.refresh_from_db()
        
        return Response({
            'statistique': serializer_response.data,
            'match': {
                'score_domicile': match.score_domicile,
                'score_exterieur': match.score_exterieur
            }
        }, status=status.HTTP_200_OK)


class StatistiqueJoueurViewSet(OrganisateurRequisMixin, viewsets.ModelViewSet):
    """ViewSet pour gérer les statistiques des joueurs."""
    queryset = StatistiqueJoueur.objects.select_related(
        'joueur__equipe', 'match'
    ).all()
    serializer_class = StatistiqueJoueurSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = StatistiqueJoueur.objects.select_related(
            'joueur__equipe', 'match'
        ).all()
        
        match_id = self.request.query_params.get('match', None)
        if match_id:
            queryset = queryset.filter(match_id=match_id)
        
        return queryset

