from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group, User
from django.db.models import Count

from .athletes import ConflitAthlete, fusionner
from .models import ActionMatch, Athlete, DemandeEquipe, Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from .organisateurs import GROUPE_ORGANISATEURS

admin.site.unregister(User)

admin.site.site_header = "THE LAB · Administration"
admin.site.site_title = "THE LAB Admin"
admin.site.index_title = "Tableau de bord"


@admin.register(User)
class UtilisateurAdmin(UserAdmin):
    """Utilisateurs, avec la validation des organisateurs en un clic."""
    list_display = ['username', 'email', 'organisateur_valide', 'nb_tournois', 'date_joined', 'last_login', 'is_active']
    list_filter = ['groups', 'is_staff', 'is_active']
    ordering = ['-date_joined']
    actions = ['valider_organisateurs', 'retirer_validation']

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('groups', 'tournois_crees')

    @admin.display(boolean=True, description='Organisateur validé')
    def organisateur_valide(self, obj):
        return obj.is_staff or any(g.name == GROUPE_ORGANISATEURS for g in obj.groups.all())

    @admin.display(description='Tournois')
    def nb_tournois(self, obj):
        return len(obj.tournois_crees.all())

    @admin.action(description='Valider comme organisateur (peut créer des tournois)')
    def valider_organisateurs(self, request, queryset):
        groupe, _ = Group.objects.get_or_create(name=GROUPE_ORGANISATEURS)
        groupe.user_set.add(*queryset)
        self.message_user(request, f'{queryset.count()} organisateur(s) validé(s).', messages.SUCCESS)

    @admin.action(description='Retirer la validation organisateur')
    def retirer_validation(self, request, queryset):
        groupe, _ = Group.objects.get_or_create(name=GROUPE_ORGANISATEURS)
        groupe.user_set.remove(*queryset)
        self.message_user(request, f'Validation retirée pour {queryset.count()} compte(s).', messages.WARNING)


@admin.register(Tournoi)
class TournoiAdmin(admin.ModelAdmin):
    list_display = ['nom', 'organisateur', 'date_debut', 'date_fin']
    list_filter = ['date_debut', 'date_fin', 'organisateur']
    search_fields = ['nom']


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ['nom', 'tournoi']
    list_filter = ['tournoi']
    search_fields = ['nom']


class JoueurInline(admin.TabularInline):
    model = Joueur
    fields = ['prenom', 'nom', 'numero_maillot', 'equipe']
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(DemandeEquipe)
class DemandeEquipeAdmin(admin.ModelAdmin):
    list_display = ['nom', 'tournoi', 'capitaine', 'statut', 'equipe', 'created_at']
    list_filter = ['statut']
    search_fields = ['nom', 'tournoi__nom', 'capitaine__username']
    raw_id_fields = ['tournoi', 'capitaine', 'equipe']


@admin.register(Athlete)
class AthleteAdmin(admin.ModelAdmin):
    """Fiches athlètes ; les doublons se regroupent avec l'action « Fusionner »."""
    list_display = ['nom', 'prenom', 'email', 'nb_inscriptions', 'created_at']
    search_fields = ['nom', 'prenom', 'email']
    ordering = ['nom', 'prenom']
    inlines = [JoueurInline]
    actions = ['fusionner_fiches']

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(nb=Count('joueurs'))

    @admin.display(description='Inscriptions', ordering='nb')
    def nb_inscriptions(self, obj):
        return obj.nb

    @admin.action(description='Fusionner les fiches sélectionnées (même personne)')
    def fusionner_fiches(self, request, queryset):
        try:
            cible = fusionner(queryset)
        except ConflitAthlete as erreur:
            self.message_user(request, str(erreur), messages.ERROR)
            return
        self.message_user(request, f'Fiches regroupées dans « {cible} ».', messages.SUCCESS)


@admin.register(Joueur)
class JoueurAdmin(admin.ModelAdmin):
    list_display = ['prenom', 'nom', 'numero_maillot', 'equipe', 'athlete']
    list_filter = ['equipe__tournoi', 'equipe']
    search_fields = ['prenom', 'nom', 'athlete__email']
    autocomplete_fields = ['athlete']


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


@admin.register(ActionMatch)
class ActionMatchAdmin(admin.ModelAdmin):
    """Historique des matchs, en lecture seule (trace de qui a saisi quoi)."""
    list_display = ['match', 'periode', 'type', 'cote', 'joueur_libelle', 'champ', 'valeur', 'annulee', 'auteur', 'created_at']
    list_filter = ['type', 'annulee', 'match__tournoi']
    search_fields = ['joueur_libelle']
    list_select_related = ['match__equipe_domicile', 'match__equipe_exterieur', 'match__tournoi', 'auteur']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


