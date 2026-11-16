from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EquipeViewSet,
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
router.register(r'matchs', MatchViewSet, basename='match')
router.register(r'statistiques', StatistiqueJoueurViewSet, basename='statistique')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('health/', health, name='health'),
    path('reglements/', reglements, name='reglements'),
    path('', include(router.urls)),
]


