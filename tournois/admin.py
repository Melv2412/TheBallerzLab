from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group, User
from django.db import transaction
from django.db.models import Count
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from . import organisateurs
from . import reglement as regles
from .athletes import ConflitAthlete, fusionner
from .models import ActionMatch, Athlete, DemandeEquipe, Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from .organisateurs import GROUPE_DEMANDES, GROUPE_ORGANISATEURS

admin.site.unregister(User)

admin.site.site_header = "THE LAB · Administration"
admin.site.site_title = "THE LAB Admin"
admin.site.index_title = "Tableau de bord"
admin.site.index_template = 'admin/thelab_index.html'


def lien_liste(modele, filtre=''):
    url = reverse(f'admin:{modele._meta.app_label}_{modele._meta.model_name}_changelist')
    return f'{url}?{filtre}' if filtre else url


def tableau_de_bord():
    """Chiffres de l'accueil de l'admin : (libellé, nombre, lien vers la liste, à traiter ?)."""
    return [
        ('⏳ Organisateurs en attente', User.objects.filter(groups__name=GROUPE_DEMANDES).count(),
         lien_liste(User, 'attente=oui'), True),
        ('📝 Équipes proposées en attente', DemandeEquipe.objects.filter(
            statut=DemandeEquipe.EN_ATTENTE, tournoi__supprime_le__isnull=True,
        ).count(),
         lien_liste(DemandeEquipe, f'statut__exact={DemandeEquipe.EN_ATTENTE}'), True),
        ('🔴 Matchs en cours', Match.objects.filter(statut='en_cours', tournoi__supprime_le__isnull=True).count(),
         lien_liste(Match, 'statut__exact=en_cours'), False),
        ('🏆 Tournois en cours ou à venir', Tournoi.objects.filter(
            date_fin__gte=timezone.localdate(), supprime_le__isnull=True,
        ).count(),
         lien_liste(Tournoi, 'actif=oui'), False),
        ('👤 Comptes', User.objects.count(), lien_liste(User), False),
        ('🏀 Fiches athlètes', Athlete.objects.count(), lien_liste(Athlete), False),
    ]


_index = admin.site.index


def index_avec_tableau_de_bord(request, extra_context=None):
    return _index(request, {'tableau_de_bord': tableau_de_bord(), **(extra_context or {})})


admin.site.index = index_avec_tableau_de_bord


# (clé, libellé, format) dans l'ordre d'affichage
LIBELLES_REGLEMENT = [
    ('nb_periodes', 'Périodes', ''),
    ('duree_periode_secondes', "Durée d'une période", 'duree'),
    ('duree_prolongation_secondes', "Durée d'une prolongation", 'duree'),
    ('shot_clock_actif', 'Shot clock', 'oui_non'),
    ('shot_clock_secondes', 'Shot clock (s)', ''),
    ('shot_clock_court_secondes', 'Shot clock après rebond offensif (s)', ''),
    ('fautes_exclusion', 'Fautes avant exclusion', 'zero_jamais'),
    ('fautes_bonus', "Lancers francs à partir de la faute d'équipe n°", ''),
    ('fautes_equipe_reset', "Fautes d'équipe remises à zéro", 'reset'),
    ('temps_morts_premiere_mi_temps', 'Temps morts 1re mi-temps', ''),
    ('temps_morts_seconde_mi_temps', 'Temps morts 2de mi-temps', ''),
    ('temps_morts_prolongation', 'Temps morts par prolongation', ''),
    ('points_victoire', 'Points au classement : victoire', ''),
    ('points_defaite', 'Points au classement : défaite', ''),
]
RESETS = {'periode': 'à chaque période', 'mi_temps': 'à chaque mi-temps', 'match': 'jamais'}
NOMS_PRESETS = {'fiba': 'FIBA', 'nba': 'NBA', '3x3': '3x3', 'personnalise': 'Personnalisé'}


def valeur_lisible(valeur, format_):
    if format_ == 'duree':
        minutes, secondes = divmod(int(valeur), 60)
        return f'{minutes} min {secondes:02d}' if secondes else f'{minutes} min'
    if format_ == 'oui_non':
        return 'oui' if valeur else 'non'
    if format_ == 'zero_jamais' and valeur == 0:
        return 'jamais'
    if format_ == 'reset':
        return RESETS.get(valeur, valeur)
    return valeur


def reglement_lisible(reglement):
    if not reglement:
        return '—'
    lignes = format_html_join(
        '', '<tr><td style="padding:2px 16px 2px 0">{}</td><td><b>{}</b></td></tr>',
        ((libelle, valeur_lisible(reglement[cle], format_))
         for cle, libelle, format_ in LIBELLES_REGLEMENT if cle in reglement),
    )
    return format_html('<p><b>{}</b></p><table>{}</table>', NOMS_PRESETS[regles.nom_preset(reglement)], lignes)


class EnAttenteFilter(admin.SimpleListFilter):
    title = 'type de compte'
    parameter_name = 'attente'

    def lookups(self, request, model_admin):
        return [('oui', 'En attente de validation'), ('valides', 'Organisateurs validés'), ('joueurs', 'Joueurs')]

    def queryset(self, request, queryset):
        if self.value() == 'oui':
            return queryset.filter(groups__name=GROUPE_DEMANDES).distinct()
        if self.value() == 'valides':
            return queryset.filter(groups__name=GROUPE_ORGANISATEURS).distinct()
        if self.value() == 'joueurs':
            return queryset.filter(is_staff=False).exclude(groups__name__in=[GROUPE_ORGANISATEURS, GROUPE_DEMANDES])
        return queryset


class TournoiActifFilter(admin.SimpleListFilter):
    title = 'période'
    parameter_name = 'actif'

    def lookups(self, request, model_admin):
        return [('oui', 'En cours ou à venir'), ('non', 'Terminés')]

    def queryset(self, request, queryset):
        if self.value() == 'oui':
            return queryset.filter(date_fin__gte=timezone.localdate())
        if self.value() == 'non':
            return queryset.filter(date_fin__lt=timezone.localdate())
        return queryset


@admin.register(User)
class UtilisateurAdmin(UserAdmin):
    """Utilisateurs, avec la validation des organisateurs en un clic."""
    list_display = ['username', 'email', 'type_de_compte', 'nb_tournois', 'date_joined', 'last_login', 'is_active']
    list_filter = [EnAttenteFilter, 'groups', 'is_staff', 'is_active']
    ordering = ['-date_joined']
    actions = ['valider_organisateurs', 'retirer_validation']

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('groups', 'tournois_crees')

    @admin.display(description='Type de compte')
    def type_de_compte(self, obj):
        groupes = {g.name for g in obj.groups.all()}  # préchargés : pas de requête par ligne
        if obj.is_staff:
            return 'Staff'
        if GROUPE_ORGANISATEURS in groupes:
            return '✅ Organisateur'
        if GROUPE_DEMANDES in groupes:
            return '⏳ En attente'
        return 'Joueur'

    @admin.display(description='Tournois')
    def nb_tournois(self, obj):
        return len(obj.tournois_crees.all())

    @admin.action(description='Valider comme organisateur (peut créer des tournois)')
    def valider_organisateurs(self, request, queryset):
        organisateurs.valider(list(queryset))
        self.message_user(request, f'{queryset.count()} organisateur(s) validé(s).', messages.SUCCESS)

    @admin.action(description='Retirer la validation organisateur')
    def retirer_validation(self, request, queryset):
        groupe, _ = Group.objects.get_or_create(name=GROUPE_ORGANISATEURS)
        groupe.user_set.remove(*queryset)
        self.message_user(request, f'Validation retirée pour {queryset.count()} compte(s).', messages.WARNING)


@admin.register(Tournoi)
class TournoiAdmin(admin.ModelAdmin):
    list_display = ['nom', 'organisateur', 'date_debut', 'date_fin', 'cloture_le', 'supprime_le']
    list_filter = [TournoiActifFilter, 'date_debut', 'organisateur']
    search_fields = ['nom']
    readonly_fields = ['reglement_tableau']

    @admin.display(description='Règlement (lisible)')
    def reglement_tableau(self, obj):
        return reglement_lisible(obj.reglement)


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
    list_display = ['nom', 'prenom', 'email', 'utilisateur', 'nb_inscriptions', 'created_at']
    raw_id_fields = ['utilisateur']
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
    list_display = ['prenom', 'nom', 'numero_maillot', 'equipe', 'athlete', 'retire']
    list_filter = ['retire', 'equipe__tournoi', 'equipe']
    search_fields = ['prenom', 'nom', 'athlete__email']
    autocomplete_fields = ['athlete']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = [
        'equipe_domicile', 'equipe_exterieur', 'tournoi', 'statut', 'forfait', 'score_domicile', 'score_exterieur',
    ]
    list_filter = ['statut', 'tournoi']
    search_fields = ['equipe_domicile__nom', 'equipe_exterieur__nom']
    list_select_related = ['equipe_domicile', 'equipe_exterieur', 'tournoi']
    readonly_fields = ['reglement_tableau', 'forfait']
    actions = ['rouvrir']

    @admin.display(description='Règlement (lisible)')
    def reglement_tableau(self, obj):
        return reglement_lisible(obj.reglement)

    @admin.action(description='Rouvrir les matchs terminés sélectionnés (repassent « en cours »)')
    def rouvrir(self, request, queryset):
        from .serializers import MatchSerializer  # mêmes règles que l'appli (phase suivante commencée, etc.)
        termines = list(queryset.filter(statut='termine'))
        if not termines:
            self.message_user(request, 'Aucun match terminé dans la sélection.', messages.WARNING)
            return
        rouverts = 0
        for match in termines:
            serializer = MatchSerializer(match, data={'statut': 'en_cours'}, partial=True, context={'request': request})
            if serializer.is_valid():
                with transaction.atomic():
                    serializer.save()
                rouverts += 1
            else:
                erreurs = ' '.join(str(e) for champ in serializer.errors.values() for e in champ)
                self.message_user(request, f'{match} : {erreurs}', messages.ERROR)
        if rouverts:
            self.message_user(request, f'{rouverts} match(s) rouvert(s).', messages.SUCCESS)


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


