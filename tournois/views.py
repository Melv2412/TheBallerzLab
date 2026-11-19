import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import EmailValidator
from django.db import DatabaseError, connection, transaction
from django.db.models import Count, F, Q
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.cache import patch_cache_control
from django.utils.crypto import constant_time_compare
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle

from . import cloture, corbeille, forfaits, inscription_equipes, invitations, journal, organisateurs, protections
from . import reglement as regles
from .athletes import chercher_par_email
from .carriere import profil_athlete
from .models import Athlete, DemandeEquipe, Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from .organisateurs import est_organisateur_valide, limite_tournois_atteinte, nb_tournois_actifs
from .phases_finales import (
    departager_qualification,
    egalite_qualification,
    generer_phases_finales,
    resume_phases_finales,
    verrouiller_tournoi,
)
from .presences import enregistrer_presences, presences_du_match
from .serializers import (
    ActionMatchSerializer,
    EquipeSerializer,
    ForfaitSerializer,
    JoueurSerializer,
    MatchListSerializer,
    MatchSerializer,
    PhotoAthleteSerializer,
    PresencesSerializer,
    SaisieFeuilleSerializer,
    StatistiqueJoueurSerializer,
    TournoiSerializer,
    UpdateStatistiqueSerializer,
    UserSerializer,
)
from .services import classement_du_tournoi, meilleurs_joueurs

try:
    from botocore.exceptions import BotoCoreError, ClientError
    ERREURS_STOCKAGE = (BotoCoreError, ClientError)
except ImportError:
    ERREURS_STOCKAGE = ()

logger = logging.getLogger(__name__)


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
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def taches_quotidiennes(request):
    """Cron Vercel : garde la base éveillée puis, avec le bon secret, purge la corbeille et les images."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return Response({'status': 'erreur', 'database': False}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if not settings.CRON_SECRET:
        return Response({'status': 'ok', 'database': True, 'taches': 'non_configurees'})
    if not constant_time_compare(request.headers.get('Authorization', ''), f'Bearer {settings.CRON_SECRET}'):
        return Response({'detail': "Accès refusé."}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({'status': 'ok', 'database': True, 'taches': corbeille.taches_quotidiennes()})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def corbeille_tournois(request):
    """Tournois que l'utilisateur peut restaurer (les siens ; le staff voit aussi ceux sans organisateur)."""
    proprietaire = Q(organisateur=request.user)
    if request.user.is_staff:
        proprietaire |= Q(organisateur__isnull=True)
    tournois = Tournoi.objects.filter(proprietaire, supprime_le__isnull=False).order_by('-supprime_le')
    return Response([corbeille.element_corbeille(tournoi) for tournoi in tournois])


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


def filtre_visibles(user, chemin=''):
    """Tournois que ce compte peut voir : les publics, les siens, et tous pour le staff."""
    if user.is_authenticated and user.is_staff:
        return Q()
    visibles = Q(**{f'{chemin}prive': False})
    if user.is_authenticated:
        visibles |= Q(**{f'{chemin}organisateur': user})
    return visibles


def peut_voir(user, tournoi):
    if not tournoi.prive or (user.is_authenticated and user.is_staff):
        return True
    return user.is_authenticated and tournoi.organisateur_id == user.id


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Seul l'organisateur du tournoi peut modifier l'objet, et plus rien ne change une fois le tournoi clôturé."""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        tournoi = get_tournoi(obj)
        if not peut_modifier(request.user, tournoi):
            return False
        permis_si_cloture = getattr(view, 'permis_si_cloture', None)
        if not (permis_si_cloture and permis_si_cloture(request)):
            cloture.exiger_tournoi_ouvert(tournoi)
        return True


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
        tournoi = self.get_tournoi_cible(serializer)
        if tournoi is not None and tournoi.supprime_le is not None:
            raise NotFound("Ce tournoi est dans la corbeille.")
        if not peut_modifier(self.request.user, tournoi):
            raise PermissionDenied("Vous n'êtes pas l'organisateur de ce tournoi.")
        cloture.exiger_tournoi_ouvert(tournoi)

    def perform_create(self, serializer):
        self.verifier_organisateur(serializer)
        enregistrer_avec_fichiers(serializer)

    def perform_update(self, serializer):
        self.verifier_organisateur(serializer)
        enregistrer_avec_fichiers(serializer)


class StockageIndisponible(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = 'stockage_indisponible'


def enregistrer_avec_fichiers(serializer):
    """Enregistre l'objet ; un échec du stockage des images (Supabase Storage en prod) devient une 503 lisible."""
    try:
        with transaction.atomic():
            serializer.save()
    except (OSError, *ERREURS_STOCKAGE) as erreur:
        logger.exception("Échec de l'enregistrement d'un fichier dans le stockage")
        code = getattr(erreur, 'response', {}).get('Error', {}).get('Code') or type(erreur).__name__
        raise StockageIndisponible(
            f"Impossible d'enregistrer l'image pour le moment (stockage indisponible, code : {code}). "
            "Réessaie plus tard ou enregistre sans image."
        ) from erreur


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
            'type_compte': organisateurs.type_compte(user),
            'tournois_actifs': nb_tournois_actifs(user),
            'limite_tournois_actifs': None if user.is_staff else settings.LIMITE_TOURNOIS_ACTIFS,
            'athlete': getattr(invitations.fiche_du_compte(user), 'pk', None),  # lien « Mon profil »
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[])
    def devenir_organisateur(self, request):
        """Un compte joueur demande à organiser des tournois : il attend la validation de l'équipe THE LAB."""
        organisateurs.demander_validation(request.user)
        return self.me(request)


class TournoiViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les tournois."""
    serializer_class = TournoiSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom']
    ACTIONS_CORBEILLE = ('restaurer', 'supprimer_definitivement')
    ACTIONS_SI_CLOTURE = ('destroy', *ACTIONS_CORBEILLE)

    def permis_si_cloture(self, request):
        """Un tournoi clôturé peut encore être supprimé, ou passer de public à privé et inversement."""
        return self.action in self.ACTIONS_SI_CLOTURE or (
            self.action == 'partial_update' and list(request.data) == ['prive']
        )

    def get_queryset(self):
        # Un tournoi de la corbeille n'existe plus, sauf pour le restaurer ou l'effacer
        hors_corbeille = self.action not in self.ACTIONS_CORBEILLE
        # Les compteurs sont calculés par la base en une seule requête
        return Tournoi.objects.filter(
            filtre_visibles(self.request.user), supprime_le__isnull=hors_corbeille,
        ).select_related('organisateur').annotate(
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
                "Un tournoi libère sa place une fois clôturé ou sa date de fin passée."
            )})
        # L'organisateur est l'utilisateur connecté
        serializer.save(organisateur=user)

    def _verifier_confirmation(self, request, tournoi):
        saisie = request.data.get('confirmation') if isinstance(request.data, dict) else None
        if not corbeille.nom_confirme(saisie, tournoi.nom):
            raise ValidationError({'confirmation': "Retape exactement le nom du tournoi pour confirmer."})

    def destroy(self, request, *args, **kwargs):
        """Le nom retapé est exigé. Tournoi commencé : corbeille de 30 jours ; sinon, effacement immédiat."""
        tournoi = self.get_object()
        self._verifier_confirmation(request, tournoi)
        return Response({'resultat': corbeille.supprimer(tournoi), 'jours': corbeille.DUREE_CORBEILLE.days})

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def apercu_suppression(self, request, slug=None):
        """Ce que la suppression fera perdre (organisateur uniquement)."""
        tournoi = self.get_object()
        if not peut_modifier(request.user, tournoi):
            raise PermissionDenied("Vous n'êtes pas l'organisateur de ce tournoi.")
        return Response(corbeille.apercu(tournoi))

    @action(detail=True, methods=['post'])
    def restaurer(self, request, slug=None):
        tournoi = self.get_object()
        organisateur = tournoi.organisateur
        if (
            organisateur is not None and tournoi.cloture_le is None
            and tournoi.date_fin >= timezone.localdate()
            and organisateurs.limite_tournois_atteinte(organisateur)
        ):
            raise ValidationError({'detail': (
                f"Tu as déjà {settings.LIMITE_TOURNOIS_ACTIFS} tournois en cours ou à venir : "
                "impossible de restaurer celui-ci pour le moment."
            )})
        corbeille.restaurer(tournoi)
        return Response(self.get_serializer(tournoi).data)

    @action(detail=True, methods=['post'])
    def supprimer_definitivement(self, request, slug=None):
        """Efface tout de suite un tournoi de la corbeille (le nom retapé est exigé)."""
        tournoi = self.get_object()
        self._verifier_confirmation(request, tournoi)
        tournoi.delete()
        return Response({'resultat': 'supprime'})

    @action(detail=True, methods=['post'])
    def cloturer(self, request, slug=None):
        """L'organisateur passe le tournoi en lecture seule."""
        return Response(self.get_serializer(cloture.cloturer(self.get_object())).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def rouvrir(self, request, slug=None):
        """Réservé aux administrateurs : l'organisateur ne rouvre pas seul un tournoi clôturé."""
        return Response(self.get_serializer(cloture.rouvrir(self.get_object())).data)

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

    @action(detail=True, methods=['get'])
    def egalite_qualification(self, request, slug=None):
        """Égalité parfaite sur une place qualificative, à trancher avant de créer le tableau."""
        return Response({'egalite': egalite_qualification(self.get_object())})

    @action(detail=True, methods=['post'])
    def departager_qualification(self, request, slug=None):
        """`{ordre: [ids]}` : choix de l'organisateur ; `{tirage: true}` : tirage au sort par le serveur."""
        tournoi = self.get_object()
        donnees = request.data if isinstance(request.data, dict) else {}
        if donnees.get('tirage') is True:
            return Response({'egalite': departager_qualification(tournoi)})
        if donnees.get('ordre') is None:
            raise ValidationError({'detail': "Choisissez un ordre ou le tirage au sort."})
        return Response({'egalite': departager_qualification(tournoi, donnees['ordre'])})

    @action(detail=True, methods=['post'])
    def generer_phases_finales(self, request, slug=None):
        """Crée le premier tour des phases finales d'après le classement de poule."""
        tournoi = self.get_object()  # vérifie que l'utilisateur est l'organisateur
        generer_phases_finales(tournoi)
        return Response(resume_phases_finales(tournoi), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def lien_inscription(self, request, slug=None):
        """Lien d'inscription des équipes (organisateur) : `regenerer` remplace le lien, `desactiver` le supprime."""
        tournoi = self.get_object()  # vérifie que l'utilisateur est l'organisateur
        code = inscription_equipes.code_inscription(
            tournoi, regenerer=bool(request.data.get('regenerer')), desactiver=bool(request.data.get('desactiver')),
        )
        return Response({'code': code})

    @action(detail=True, methods=['post'])
    def reset_playoffs(self, request, slug=None):
        """Réinitialise les playoffs pour ce tournoi (soit tout, soit à partir d'une phase)."""
        tournoi = self.get_object()  # vérifie que l'utilisateur est l'organisateur
        with transaction.atomic():
            verrouiller_tournoi(tournoi)  # pas de tour suivant créé pendant la suppression
            return self._reinitialiser_playoffs(tournoi, request.data.get('phase', None))

    def _reinitialiser_playoffs(self, tournoi, phase):
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
        queryset = Equipe.objects.filter(
            filtre_visibles(self.request.user, 'tournoi__'), tournoi__supprime_le__isnull=True,
        ).select_related('tournoi').annotate(
            nb_joueurs=Count('joueurs', filter=Q(joueurs__retire=False)),
        ).order_by(*Equipe._meta.ordering)
        tournoi_param = self.request.query_params.get('tournoi', None)
        if tournoi_param:
            if tournoi_param.isdigit():
                queryset = queryset.filter(tournoi_id=tournoi_param)
            else:
                queryset = queryset.filter(tournoi__slug=tournoi_param)
        return queryset

    @action(detail=True, methods=['post'])
    def invitation(self, request, pk=None):
        """Code du lien d'invitation de l'équipe (organisateur) ; `regenerer` invalide l'ancien lien."""
        equipe = self.get_object()
        code = invitations.code_invitation(equipe, regenerer=bool(request.data.get('regenerer')))
        return Response({'code': code})

    @action(detail=True, methods=['post'])
    def forfait_general(self, request, pk=None):
        """L'équipe abandonne le tournoi : elle perd par forfait tous ses matchs restants."""
        return Response({'matchs': forfaits.forfait_general(self.get_object())})

    def perform_destroy(self, equipe):
        with transaction.atomic():
            verrouiller_tournoi(equipe.tournoi)
            if protections.equipe_a_joue(equipe):
                raise ValidationError({'detail': (
                    "Cette équipe a déjà un match commencé : la supprimer effacerait des résultats."
                )})
            equipe.delete()


class RechercheAthleteThrottle(UserRateThrottle):
    """Limite par compte la recherche de fiches par email (pas de test d'emails en masse)."""
    scope = 'recherche_athlete'


class JoueurViewSet(OrganisateurRequisMixin, viewsets.ModelViewSet):
    """ViewSet pour gérer les joueurs."""
    queryset = Joueur.objects.select_related('equipe', 'equipe__tournoi').all()
    serializer_class = JoueurSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = protections.annoter_stats_joueurs(
            Joueur.objects.filter(
                filtre_visibles(self.request.user, 'equipe__tournoi__'), equipe__tournoi__supprime_le__isnull=True,
            ).select_related('equipe', 'equipe__tournoi', 'athlete')
        )
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

    @action(
        detail=False, methods=['get'], url_path='recherche_athlete',
        permission_classes=[permissions.IsAuthenticated],
        throttle_classes=[RechercheAthleteThrottle],
    )
    def recherche_athlete(self, request):
        """Retrouve une fiche athlète par son email exact (organisateurs validés, email jamais renvoyé)."""
        if not est_organisateur_valide(request.user):
            raise PermissionDenied("Réservé aux organisateurs validés.")
        email = request.query_params.get('email', '')
        try:
            EmailValidator()(email)
        except DjangoValidationError as erreur:
            raise ValidationError({'email': "Adresse email invalide."}) from erreur
        fiche = chercher_par_email(email)
        if fiche is None:
            return Response({'detail': "Aucune fiche avec cet email."}, status=status.HTTP_404_NOT_FOUND)
        tournois = (
            fiche.joueurs.filter(equipe__tournoi__supprime_le__isnull=True, equipe__tournoi__prive=False)
            .values('equipe__tournoi_id').distinct().count()
        )
        return Response({'athlete': fiche.pk, 'prenom': fiche.prenom, 'nom': fiche.nom, 'nb_tournois': tournois})


    def permis_si_cloture(self, request):
        # « C'est moi » reste possible après la clôture : l'organisateur doit pouvoir corriger une erreur
        return self.action == 'delier'

    @action(detail=True, methods=['post'])
    def delier(self, request, pk=None):
        """L'organisateur détache le compte relié à ce joueur (ce n'était pas la bonne personne)."""
        joueur = self.get_object()
        try:
            invitations.delier(joueur)
        except invitations.InvitationRefusee as erreur:
            raise ValidationError({'detail': str(erreur)}) from erreur
        return Response(self.get_serializer(Joueur.objects.select_related('athlete').get(pk=joueur.pk)).data)

    @action(detail=True, methods=['post'])
    def retirer(self, request, pk=None):
        """Retire le joueur de l'effectif : il ne joue plus, ses stats restent dans les matchs joués."""
        joueur = protections.retirer_de_l_effectif(self.get_object())
        return Response(self.get_serializer(self.get_queryset().get(pk=joueur.pk)).data)

    @action(detail=True, methods=['post'])
    def reintegrer(self, request, pk=None):
        """Remet dans l'effectif un joueur retiré."""
        joueur = protections.remettre_dans_l_effectif(self.get_object())
        return Response(self.get_serializer(self.get_queryset().get(pk=joueur.pk)).data)

    def perform_destroy(self, joueur):
        with transaction.atomic():
            verrouiller_tournoi(joueur.equipe.tournoi)
            if protections.joueur_a_des_stats(Joueur.objects.get(pk=joueur.pk)):
                raise ValidationError({'detail': (
                    "Ce joueur a des stats : retire-le de l'effectif pour garder ses résultats."
                )})
            joueur.delete()


class InvitationThrottle(UserRateThrottle):
    """Limite par compte les tentatives pour rejoindre une équipe."""
    scope = 'invitation'


class InvitationViewSet(viewsets.GenericViewSet):
    """Page du lien d'invitation d'une équipe (publique) et inscription du joueur connecté."""
    queryset = Equipe.objects.filter(tournoi__supprime_le__isnull=True).select_related('tournoi')
    lookup_field = 'code_invitation'
    lookup_url_kwarg = 'code'
    lookup_value_regex = '[A-Za-z0-9_-]+'
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, code=None):
        equipe = self.get_object()
        tournoi = equipe.tournoi
        joueurs = equipe.joueurs.filter(retire=False).select_related('athlete').order_by('numero_maillot')
        user = request.user
        moi = None
        if user.is_authenticated:
            fiche = invitations.fiche_du_compte(user)
            inscrit = invitations.inscription_dans_le_tournoi(user, tournoi.pk)
            moi = {
                'fiche': {'id': fiche.pk, 'prenom': fiche.prenom, 'nom': fiche.nom} if fiche else None,
                'inscription': {
                    'joueur': inscrit.pk, 'equipe': inscrit.equipe_id, 'equipe_nom': inscrit.equipe.nom,
                    'numero_maillot': inscrit.numero_maillot,
                } if inscrit else None,
            }
        return Response({
            'equipe': {
                'id': equipe.pk, 'nom': equipe.nom,
                'logo': request.build_absolute_uri(equipe.logo.url) if equipe.logo else None,
            },
            'tournoi': {
                'nom': tournoi.nom, 'slug': tournoi.slug, 'date_debut': tournoi.date_debut, 'date_fin': tournoi.date_fin,
                'visible': peut_voir(user, tournoi),  # tournoi privé : le lien marche, la page reste fermée
            },
            'inscriptions_ouvertes': tournoi.inscriptions_actives,
            'joueurs': [
                {
                    'id': j.pk, 'prenom': j.prenom, 'nom': j.nom, 'numero_maillot': j.numero_maillot,
                    'compte_lie': j.athlete.utilisateur_id is not None,
                }
                for j in joueurs
            ],
            'moi': moi,
        })

    @action(
        detail=True, methods=['post'],
        permission_classes=[permissions.IsAuthenticated], throttle_classes=[InvitationThrottle],
    )
    def rejoindre(self, request, code=None):
        """`{joueur}` : « c'est moi » ; sinon `{numero_maillot, prenom, nom}` : nouveau joueur dans l'équipe."""
        equipe = self.get_object()
        donnees = request.data
        try:
            if donnees.get('joueur') not in (None, ''):
                joueur = invitations.reclamer(request.user, equipe, self._entier(donnees, 'joueur'))
                code_retour = status.HTTP_200_OK
            else:
                numero = self._entier(donnees, 'numero_maillot')
                if not 0 <= numero <= 99:
                    raise ValidationError({'numero_maillot': "Le numéro doit être entre 0 et 99."})
                joueur = invitations.s_inscrire(
                    request.user, equipe, numero,
                    prenom=str(donnees.get('prenom') or ''), nom=str(donnees.get('nom') or ''),
                )
                code_retour = status.HTTP_201_CREATED
        except invitations.InvitationRefusee as erreur:
            raise ValidationError({'detail': str(erreur)}) from erreur
        joueur = Joueur.objects.select_related('equipe__tournoi', 'athlete').get(pk=joueur.pk)
        return Response(JoueurSerializer(joueur, context={'request': request}).data, status=code_retour)

    @staticmethod
    def _entier(donnees, champ):
        try:
            return int(donnees.get(champ))
        except (TypeError, ValueError) as erreur:
            raise ValidationError({champ: "Nombre attendu."}) from erreur


def _demande_json(demande, avec_lien=False):
    equipe = demande.equipe
    statut = demande.statut
    if statut == DemandeEquipe.ACCEPTEE and equipe is None:
        statut = DemandeEquipe.REFUSEE  # équipe supprimée après acceptation : le capitaine peut redemander
    donnees = {
        'id': demande.pk, 'nom': demande.nom, 'statut': statut,
        'equipe': equipe.pk if equipe else None, 'created_at': demande.created_at,
    }
    if avec_lien and equipe is not None:
        donnees['code_invitation'] = invitations.code_invitation(equipe)
    return donnees


class InscriptionViewSet(viewsets.GenericViewSet):
    """Page du lien d'inscription d'un tournoi (publique) : le capitaine connecté propose son équipe."""
    queryset = Tournoi.objects.filter(supprime_le__isnull=True).select_related('organisateur')
    lookup_field = 'code_inscription'
    lookup_url_kwarg = 'code'
    lookup_value_regex = '[A-Za-z0-9_-]+'
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, code=None):
        tournoi = self.get_object()
        demande = inscription_equipes.demande_du_compte(request.user, tournoi)
        return Response({
            'tournoi': {
                'nom': tournoi.nom, 'slug': tournoi.slug, 'date_debut': tournoi.date_debut, 'date_fin': tournoi.date_fin,
                'organisateur_nom': getattr(tournoi.organisateur, 'username', None),
                'visible': peut_voir(request.user, tournoi),
            },
            'inscriptions_ouvertes': tournoi.inscriptions_actives,
            'nb_equipes': tournoi.equipes.count(),
            'limite_equipes': settings.LIMITE_EQUIPES_PAR_TOURNOI,
            'ma_demande': _demande_json(demande, avec_lien=True) if demande else None,
        })

    @action(
        detail=True, methods=['post'],
        permission_classes=[permissions.IsAuthenticated], throttle_classes=[InvitationThrottle],
    )
    def demander(self, request, code=None):
        """`{nom}` : propose l'équipe à l'organisateur (ou renomme la demande en attente)."""
        tournoi = self.get_object()
        try:
            demande = inscription_equipes.demander(request.user, tournoi, request.data.get('nom'))
        except invitations.InvitationRefusee as erreur:
            raise ValidationError({'detail': str(erreur)}) from erreur
        return Response(_demande_json(demande), status=status.HTTP_201_CREATED)


class DemandeEquipeViewSet(viewsets.GenericViewSet):
    """Demandes d'équipes des tournois de l'organisateur connecté (`?tournoi=<slug ou id>`, `?statut=`)."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = DemandeEquipe.objects.select_related('tournoi', 'capitaine', 'equipe').filter(
            tournoi__organisateur=self.request.user, tournoi__supprime_le__isnull=True,
        )
        tournoi_param = self.request.query_params.get('tournoi')
        if tournoi_param:
            filtre = {'tournoi_id': tournoi_param} if tournoi_param.isdigit() else {'tournoi__slug': tournoi_param}
            queryset = queryset.filter(**filtre)
        return queryset

    @staticmethod
    def _json(demande):
        return {**_demande_json(demande), 'capitaine': demande.capitaine.username}

    def list(self, request):
        statut = request.query_params.get('statut', DemandeEquipe.EN_ATTENTE)
        return Response([self._json(d) for d in self.get_queryset().filter(statut=statut)])

    def _traiter(self, fonction):
        demande = self.get_object()
        cloture.exiger_tournoi_ouvert(demande.tournoi)
        try:
            demande = fonction(demande)
        except invitations.InvitationRefusee as erreur:
            raise ValidationError({'detail': str(erreur)}) from erreur
        return Response(self._json(DemandeEquipe.objects.select_related('capitaine', 'equipe').get(pk=demande.pk)))

    @action(detail=True, methods=['post'])
    def accepter(self, request, pk=None):
        """Crée l'équipe ; le capitaine voit alors le lien d'invitation de ses joueurs."""
        return self._traiter(inscription_equipes.accepter)

    @action(detail=True, methods=['post'])
    def refuser(self, request, pk=None):
        return self._traiter(inscription_equipes.refuser)


class AthleteViewSet(viewsets.GenericViewSet):
    """Profil public d'un athlète : stats de carrière, tournois joués, palmarès (jamais l'email)."""
    queryset = Athlete.objects.all()
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, pk=None):
        athlete = self.get_object()
        if athlete.photo:
            photo = request.build_absolute_uri(athlete.photo.url)
        else:  # à défaut, la photo ajoutée par un organisateur sur une inscription
            avec_photo = (
                athlete.joueurs.filter(equipe__tournoi__supprime_le__isnull=True, equipe__tournoi__prive=False)
                .exclude(photo='').exclude(photo__isnull=True).order_by('-created_at').first()
            )
            photo = request.build_absolute_uri(avec_photo.photo.url) if avec_photo else None
        profil = profil_athlete(athlete, photo)
        profil['photo_perso'] = bool(athlete.photo)  # photo choisie par le joueur (il peut la retirer)
        return Response(profil)

    @action(detail=True, methods=['post', 'delete'], permission_classes=[permissions.IsAuthenticated])
    def photo(self, request, pk=None):
        """Le joueur relié à la fiche change (POST, champ « photo ») ou retire (DELETE) sa photo de profil."""
        athlete = self.get_object()
        if athlete.utilisateur_id != request.user.id:
            raise PermissionDenied("Seul le joueur relié à cette fiche peut changer sa photo.")
        if request.method == 'DELETE':
            athlete.photo = None
            athlete.save(update_fields=['photo', 'updated_at'])
        else:
            serializer = PhotoAthleteSerializer(athlete, data=request.data)
            serializer.is_valid(raise_exception=True)
            enregistrer_avec_fichiers(serializer)
        return self.retrieve(request, pk)


class MatchViewSet(OrganisateurRequisMixin, viewsets.ModelViewSet):
    """ViewSet pour gérer les matchs."""
    queryset = Match.objects.select_related(
        'tournoi__organisateur', 'equipe_domicile', 'equipe_exterieur'
    ).prefetch_related('statistiques_joueurs__joueur__equipe', 'statistiques_joueurs__joueur__athlete').all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        return MatchSerializer

    def get_queryset(self):
        queryset = Match.objects.filter(
            filtre_visibles(self.request.user, 'tournoi__'), tournoi__supprime_le__isnull=True,
        ).select_related('tournoi__organisateur', 'equipe_domicile', 'equipe_exterieur')
        # La liste n'affiche pas les stats des joueurs : inutile de les charger
        if self.action != 'list':
            queryset = queryset.prefetch_related('statistiques_joueurs__joueur__equipe', 'statistiques_joueurs__joueur__athlete')

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

    def retrieve(self, request, *args, **kwargs):
        # Le navigateur revalide à chaque fois : si rien n'a changé, le serveur répond 304 sans contenu
        # (ETag calculé par ConditionalGetMiddleware)
        response = super().retrieve(request, *args, **kwargs)
        patch_cache_control(response, private=True, no_cache=True)
        return response

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

    def perform_destroy(self, match):
        with transaction.atomic():
            actuel = Match.objects.select_for_update().get(pk=match.pk)
            if actuel.statut == 'termine':
                raise ValidationError({'detail': "Match terminé : repassez-le « en cours » pour le supprimer."})
            actuel.delete()

    def update(self, request, *args, **kwargs):
        """Modification relue sous verrou : elle n'écrase pas une stat ou un temps mort enregistré au même moment."""
        partial = kwargs.pop('partial', False)
        actuel = self.get_object()  # permissions
        with transaction.atomic():
            if request.data.get('statut') == 'termine':
                # Le tableau peut avancer : tournoi verrouillé avant le match, dans le même ordre
                # que reset_playoffs, pour éviter un interblocage
                verrouiller_tournoi(actuel.tournoi)
            match = Match.objects.select_for_update().get(pk=self.kwargs['pk'])
            serializer = self.get_serializer(match, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
        return self._reponse_match(match)

    @action(detail=True, methods=['post'])
    def initialiser_stats(self, request, pk=None):
        """Initialise les statistiques pour tous les joueurs des deux équipes."""
        match = self.get_object()
        self._refuser_si_termine(match)

        stats_crees = []
        effectifs = Joueur.objects.filter(
            equipe__in=[match.equipe_domicile_id, match.equipe_exterieur_id], retire=False,
        ).select_related('athlete')
        for joueur in effectifs:
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
            if match.sans_prolongation():
                raise ValidationError({'detail': (
                    "Pas d'égalité : le match ne peut pas aller en prolongation. Termine le match."
                )})
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

    @action(detail=True, methods=['post'])
    def saisie_feuille(self, request, pk=None):
        """
        Feuille de match saisie après coup : remplace les totaux des joueurs envoyés, enregistre le score
        par période (facultatif) et peut terminer le match. Tout ou rien : une erreur n'enregistre rien.
        """
        actuel = self.get_object()  # permissions
        saisie = SaisieFeuilleSerializer(data=request.data)
        saisie.is_valid(raise_exception=True)
        donnees = saisie.validated_data

        with transaction.atomic():
            if donnees['terminer']:
                verrouiller_tournoi(actuel.tournoi)  # même ordre de verrous qu'un PATCH qui termine le match
            match = self._match_verrouille(pk)
            # L'effectif actuel, plus les joueurs retirés qui ont déjà une ligne dans ce match
            joueurs = set(Joueur.objects.filter(
                equipe_id__in=[match.equipe_domicile_id, match.equipe_exterieur_id], retire=False,
            ).values_list('id', flat=True)) | set(match.statistiques_joueurs.values_list('joueur_id', flat=True))
            exclusion = match.reglement['fautes_exclusion']

            for ligne in donnees['stats']:
                valeurs = {champ: ligne[champ] for champ in UpdateStatistiqueSerializer.CHAMPS}
                if ligne['joueur'] not in joueurs:
                    raise ValidationError({'stats': f"Le joueur n°{ligne['joueur']} ne joue pas dans ce match."})
                if exclusion and valeurs['fautes'] > exclusion:
                    raise ValidationError({'stats': f"Un joueur ne peut pas dépasser {exclusion} fautes (exclusion)."})
                StatistiqueJoueur.objects.update_or_create(joueur_id=ligne['joueur'], match=match, defaults=valeurs)

            # Les actions en direct ne correspondent plus aux stats : elles restent visibles, marquées annulées
            match.actions.filter(type='stat', annulee=False).update(annulee=True)
            match.refresh_from_db()

            periodes = donnees.get('score_periodes')
            if periodes is not None:
                if len(periodes['domicile']) < match.reglement['nb_periodes']:
                    raise ValidationError({'score_periodes': (
                        f"Le règlement de ce match prévoit {match.reglement['nb_periodes']} périodes."
                    )})
                for cote in ('domicile', 'exterieur'):
                    total = sum(periodes[cote])
                    score = getattr(match, f'score_{cote}')
                    if total != score:
                        raise ValidationError({'score_periodes': (
                            f"Les périodes de l'équipe {cote} font {total} points, "
                            f"mais ses joueurs en ont marqué {score}."
                        )})
            match.score_periodes = periodes
            if match.statut == 'a_venir':
                match.statut = 'en_cours'
            match.save(update_fields=['score_periodes', 'statut', 'updated_at'])

            if donnees['terminer']:
                fin = MatchSerializer(match, data={'statut': 'termine'}, partial=True, context={'request': request})
                fin.is_valid(raise_exception=True)
                fin.save()
        return self._reponse_match(match)

    @action(detail=True, methods=['get', 'post'])
    def presences(self, request, pk=None):
        """Joueurs sans aucune stat de ce match ; POST {"presents": [ids]} confirme ceux qui ont joué."""
        match = self.get_object()  # permissions
        if request.method == 'POST':
            saisie = PresencesSerializer(data=request.data)
            saisie.is_valid(raise_exception=True)
            match = enregistrer_presences(match.pk, set(saisie.validated_data['presents']))
        return Response(presences_du_match(match))

    @action(detail=True, methods=['post', 'delete'])
    def forfait(self, request, pk=None):
        """POST {"equipe", "score_vainqueur", "score_perdant"} déclare ou corrige le forfait ; DELETE l'annule."""
        match = self.get_object()  # permissions
        if request.method == 'DELETE':
            return self._reponse_match(forfaits.annuler_forfait(match))
        saisie = ForfaitSerializer(data=request.data)
        saisie.is_valid(raise_exception=True)
        return self._reponse_match(forfaits.declarer_forfait(match, **saisie.validated_data))

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
            stat = get_object_or_404(StatistiqueJoueur.objects.select_related('joueur__athlete'), id=stat_id, match=match)

            exclusion = match.reglement['fautes_exclusion']
            if ajout and exclusion and stat.fautes >= exclusion:
                raise ValidationError({'detail': f"Joueur exclu ({exclusion} fautes) : il ne peut plus rien enregistrer."})
            if ajout and exclusion and champ == 'fautes' and stat.fautes + valeur > exclusion:
                raise ValidationError({'detail': (
                    f"Ce joueur n'a plus que {exclusion - stat.fautes} faute(s) avant l'exclusion ({exclusion} fautes)."
                )})

            avant = getattr(stat, champ)
            nouvelle_valeur = F(champ) + valeur if ajout else Greatest(F(champ) - valeur, 0)
            # Mise à jour atomique en base : deux clics simultanés ne s'écrasent pas
            StatistiqueJoueur.objects.filter(pk=stat.pk).update(**{champ: nouvelle_valeur, 'updated_at': timezone.now()})
            stat.refresh_from_db()

            cote = 'domicile' if stat.joueur.equipe_id == match.equipe_domicile_id else 'exterieur'
            variation = getattr(stat, champ) - avant
            if variation and match.statut == 'a_venir':
                # Une stat saisie veut dire que le match se joue : il passe « en cours » tout seul
                match.statut = 'en_cours'
                match.save(update_fields=['statut', 'updated_at'])
            if champ == 'fautes':
                self._compter_faute_equipe(match, cote, variation)
            match.calculer_scores_depuis_stats()
            if variation:
                journal.enregistrer(
                    match, 'stat', auteur=request.user, cote=cote, statistique=stat, champ=champ, valeur=variation,
                )

        return Response({
            'statistique': StatistiqueJoueurSerializer(stat).data,
            'match': {
                'score_domicile': match.score_domicile, 'score_exterieur': match.score_exterieur, 'statut': match.statut,
            },
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
        'joueur__equipe', 'joueur__athlete', 'match'
    ).all()
    serializer_class = StatistiqueJoueurSerializer

    def get_queryset(self):
        queryset = StatistiqueJoueur.objects.filter(
            filtre_visibles(self.request.user, 'match__tournoi__'), match__tournoi__supprime_le__isnull=True,
        ).select_related('joueur__equipe', 'joueur__athlete', 'match')

        match_id = self.request.query_params.get('match', None)
        if match_id:
            queryset = queryset.filter(match_id=match_id)

        return queryset

