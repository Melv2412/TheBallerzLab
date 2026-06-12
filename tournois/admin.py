from django.contrib import admin
from .models import Tournoi, Equipe, Joueur, Match, StatistiqueJoueur


@admin.register(Tournoi)
class TournoiAdmin(admin.ModelAdmin):
    list_display = ['nom', 'date_debut', 'date_fin']
    list_filter = ['date_debut', 'date_fin']
    search_fields = ['nom']


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ['nom', 'tournoi']
    list_filter = ['tournoi']
    search_fields = ['nom']


@admin.register(Joueur)
class JoueurAdmin(admin.ModelAdmin):
    list_display = ['prenom', 'nom', 'numero_maillot', 'equipe']
    list_filter = ['equipe__tournoi', 'equipe']
    search_fields = ['prenom', 'nom']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['equipe_domicile', 'equipe_exterieur', 'tournoi', 'statut', 'score_domicile', 'score_exterieur']
    list_filter = ['tournoi', 'statut']
    search_fields = ['equipe_domicile__nom', 'equipe_exterieur__nom']


@admin.register(StatistiqueJoueur)
class StatistiqueJoueurAdmin(admin.ModelAdmin):
    list_display = ['joueur', 'match', 'points', 'passes', 'rebonds', 'contres', 'fautes']
    list_filter = ['match__tournoi', 'match']
    search_fields = ['joueur__prenom', 'joueur__nom']


