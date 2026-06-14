from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TournoiViewSet, EquipeViewSet, JoueurViewSet,
    MatchViewSet, StatistiqueJoueurViewSet, UserViewSet
)

router = DefaultRouter()
router.register(r'tournois', TournoiViewSet, basename='tournoi')
router.register(r'equipes', EquipeViewSet, basename='equipe')
router.register(r'joueurs', JoueurViewSet, basename='joueur')
router.register(r'matchs', MatchViewSet, basename='match')
router.register(r'statistiques', StatistiqueJoueurViewSet, basename='statistique')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]


