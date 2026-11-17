from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AthleteViewSet,
    EquipeViewSet,
    InvitationViewSet,
    JoueurViewSet,
    MatchViewSet,
    StatistiqueJoueurViewSet,
    TournoiViewSet,
    UserViewSet,
    health,
    reglements,
)

router = DefaultRouter()
router.register(r'tournois', TournoiViewSet, basename='tournoi')
router.register(r'equipes', EquipeViewSet, basename='equipe')
router.register(r'joueurs', JoueurViewSet, basename='joueur')
router.register(r'athletes', AthleteViewSet, basename='athlete')
router.register(r'invitations', InvitationViewSet, basename='invitation')
router.register(r'matchs', MatchViewSet, basename='match')
router.register(r'statistiques', StatistiqueJoueurViewSet, basename='statistique')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('health/', health, name='health'),
    path('reglements/', reglements, name='reglements'),
    path('', include(router.urls)),
]


