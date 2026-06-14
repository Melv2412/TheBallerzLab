from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from .models import Tournoi, Equipe, Joueur, Match, StatistiqueJoueur
from .serializers import (
    UserSerializer, TournoiSerializer, EquipeSerializer, JoueurSerializer,
    MatchSerializer, MatchListSerializer, StatistiqueJoueurSerializer,
    UpdateStatistiqueSerializer
)


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Permission personnalisée : seul le propriétaire peut modifier l'objet."""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Récupérer le tournoi associé à l'objet pour trouver l'organisateur
        tournoi = None
        if isinstance(obj, Tournoi):
            tournoi = obj
        elif hasattr(obj, 'tournoi'):
            tournoi = obj.tournoi
        elif hasattr(obj, 'equipe'):
            tournoi = obj.equipe.tournoi
        elif hasattr(obj, 'joueur'):
            tournoi = obj.joueur.equipe.tournoi
        elif hasattr(obj, 'match'):
            tournoi = obj.match.tournoi
            
        if tournoi:
            if not tournoi.organisateur:
                return True # Ancien tournoi
            return tournoi.organisateur == request.user
            
        return False


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet pour l'inscription et la gestion des utilisateurs."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]


class TournoiViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les tournois."""
    serializer_class = TournoiSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter]
    search_fields = ['nom']

    def get_queryset(self):
        return Tournoi.objects.prefetch_related('equipes', 'matchs').all()

    def get_object(self):
        queryset = self.get_queryset()
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        
        # Essayer de récupérer par slug (défaut)
        try:
            return super().get_object()
        except:
            # Si échec, essayer par ID si le paramètre est numérique
            val = self.kwargs[lookup_url_kwarg]
            if val.isdigit():
                return get_object_or_404(queryset, id=val)
            raise

    def perform_create(self, serializer):
        # L'organisateur est l'utilisateur connecté
        serializer.save(organisateur=self.request.user)

    @action(detail=True, methods=['get'])
    def classement(self, request, slug=None):
        """Calcule le classement des équipes du tournoi."""
        # On cherche le tournoi par slug ou par ID
        lookup = self.kwargs.get('slug')
        if lookup.isdigit():
            tournoi = get_object_or_404(Tournoi, id=lookup)
        else:
            tournoi = get_object_or_404(Tournoi, slug=lookup)
            
        equipes = tournoi.equipes.all()
        matchs_termines = tournoi.matchs.filter(statut='termine')

        type_param = request.query_params.get('type', None)
        if type_param == 'poule':
            matchs_termines = matchs_termines.filter(phase='poule')
        elif type_param == 'elimination':
            matchs_termines = matchs_termines.exclude(phase='poule')

        classement_data = []

        for equipe in equipes:
            stats = {
                'id': equipe.id,
                'nom': equipe.nom,
                'joues': 0,
                'gagnes': 0,
                'perdus': 0,
                'points_pour': 0,
                'points_contre': 0,
                'points': 0  # 2 pts par victoire, 1 pt par défaite
            }

            # Matchs à domicile
            matchs_dom = matchs_termines.filter(equipe_domicile=equipe)
            for m in matchs_dom:
                stats['joues'] += 1
                stats['points_pour'] += m.score_domicile
                stats['points_contre'] += m.score_exterieur
                if m.score_domicile > m.score_exterieur:
                    stats['gagnes'] += 1
                    stats['points'] += 2
                else:
                    stats['perdus'] += 1
                    stats['points'] += 1

            # Matchs à l'extérieur
            matchs_ext = matchs_termines.filter(equipe_exterieur=equipe)
            for m in matchs_ext:
                stats['joues'] += 1
                stats['points_pour'] += m.score_exterieur
                stats['points_contre'] += m.score_domicile
                if m.score_exterieur > m.score_domicile:
                    stats['gagnes'] += 1
                    stats['points'] += 2
                else:
                    stats['perdus'] += 1
                    stats['points'] += 1
            
            stats['difference'] = stats['points_pour'] - stats['points_contre']
            classement_data.append(stats)

        # Trier le classement par points, puis par différence
        classement_data.sort(key=lambda x: (x['points'], x['difference']), reverse=True)

        return Response(classement_data)

    @action(detail=True, methods=['get'])
    def mvp(self, request, slug=None):
        """Trouve le MVP du tournoi (meilleure évaluation moyenne)."""
        lookup = self.kwargs.get('slug')
        if lookup.isdigit():
            tournoi = get_object_or_404(Tournoi, id=lookup)
        else:
            tournoi = get_object_or_404(Tournoi, slug=lookup)
            
        # On calcule l'évaluation pour tous les joueurs du tournoi
        joueurs = Joueur.objects.filter(equipe__tournoi=tournoi)
        
        type_param = request.query_params.get('type', None)
        
        mvp_data = []
        for joueur in joueurs:
            stats = StatistiqueJoueur.objects.filter(joueur=joueur, match__statut='termine')
            if type_param == 'poule':
                stats = stats.filter(match__phase='poule')
            elif type_param == 'elimination':
                stats = stats.exclude(match__phase='poule')
                
            if stats.exists():
                nb_matchs = stats.count()
                total_eval = sum(s.points + s.passes + s.rebonds + s.contres - s.fautes for s in stats)
                avg_eval = total_eval / nb_matchs
                
                mvp_data.append({
                    'id': joueur.id,
                    'nom': f"{joueur.prenom} {joueur.nom}",
                    'numero': joueur.numero_maillot,
                    'equipe': joueur.equipe.nom,
                    'moyenne_eval': round(avg_eval, 1),
                    'total_points': sum(s.points for s in stats),
                    'nb_matchs': nb_matchs
                })
        
        mvp_data.sort(key=lambda x: x['moyenne_eval'], reverse=True)
        return Response(mvp_data[:5])  # Top 5 des joueurs

    @action(detail=True, methods=['post'])
    def reset_playoffs(self, request, slug=None):
        """Réinitialise les playoffs pour ce tournoi (soit tout, soit à partir d'une phase)."""
        lookup = self.kwargs.get('slug')
        if lookup.isdigit():
            tournoi = get_object_or_404(Tournoi, id=lookup)
        else:
            tournoi = get_object_or_404(Tournoi, slug=lookup)
            
        if tournoi.organisateur and tournoi.organisateur != request.user:
            return Response({"error": "Vous n'êtes pas l'organisateur de ce tournoi."}, status=status.HTTP_403_FORBIDDEN)
            
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


class EquipeViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les équipes."""
    queryset = Equipe.objects.select_related('tournoi').all()
    serializer_class = EquipeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = Equipe.objects.select_related('tournoi').all()
        tournoi_param = self.request.query_params.get('tournoi', None)
        if tournoi_param:
            if tournoi_param.isdigit():
                queryset = queryset.filter(tournoi_id=tournoi_param)
            else:
                queryset = queryset.filter(tournoi__slug=tournoi_param)
        return queryset


class JoueurViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les joueurs."""
    queryset = Joueur.objects.select_related('equipe', 'equipe__tournoi').all()
    serializer_class = JoueurSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        queryset = Joueur.objects.select_related('equipe', 'equipe__tournoi').all()
        equipe_id = self.request.query_params.get('equipe', None)
        if equipe_id:
            queryset = queryset.filter(equipe_id=equipe_id)
        return queryset


class MatchViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les matchs."""
    queryset = Match.objects.select_related(
        'tournoi', 'equipe_domicile', 'equipe_exterieur'
    ).prefetch_related('statistiques_joueurs__joueur__equipe').all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        return MatchSerializer

    def get_queryset(self):
        queryset = Match.objects.select_related(
            'tournoi', 'equipe_domicile', 'equipe_exterieur'
        ).prefetch_related('statistiques_joueurs__joueur__equipe').all()
        
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
        
        action_type = serializer.validated_data['action']
        valeur = serializer.validated_data['valeur']
        champ = request.data.get('champ')  # 'points', 'passes', 'rebonds', 'contres', 'fautes'
        
        if champ not in ['points', 'passes', 'rebonds', 'contres', 'fautes']:
            return Response(
                {'error': 'Champ invalide. Utilisez: points, passes, rebonds, contres, fautes'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        valeur_actuelle = getattr(stat, champ)
        
        if action_type == 'increment':
            nouvelle_valeur = valeur_actuelle + valeur
        else:  # decrement
            nouvelle_valeur = max(0, valeur_actuelle - valeur)
        
        setattr(stat, champ, nouvelle_valeur)
        stat.save()
        
        # Le save() de StatistiqueJoueur mettra automatiquement à jour le score du match
        serializer_response = StatistiqueJoueurSerializer(stat)
        match.refresh_from_db()
        
        return Response({
            'statistique': serializer_response.data,
            'match': {
                'score_domicile': match.score_domicile,
                'score_exterieur': match.score_exterieur
            }
        }, status=status.HTTP_200_OK)


class StatistiqueJoueurViewSet(viewsets.ModelViewSet):
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

