"""
Qui peut créer des tournois, et combien.

Tout le monde peut créer un compte, mais seuls les organisateurs validés par
l'équipe THE LAB (groupe « Organisateurs », géré dans l'admin Django) peuvent
créer des tournois. Les comptes staff n'ont ni validation ni limite.

Type de compte : un compte créé en mode organisateur (ou un joueur qui le demande)
entre dans le groupe « Demandes organisateur » jusqu'à sa validation ; les autres
sont des comptes joueurs, à qui on ne parle pas de validation.
"""
from django.conf import settings
from django.contrib.auth.models import Group
from django.utils import timezone

GROUPE_ORGANISATEURS = 'Organisateurs'
GROUPE_DEMANDES = 'Demandes organisateur'

ORGANISATEUR, EN_ATTENTE, JOUEUR = 'organisateur', 'organisateur_en_attente', 'joueur'


def est_organisateur_valide(user):
    if not user.is_authenticated:
        return False
    return user.is_staff or user.groups.filter(name=GROUPE_ORGANISATEURS).exists()


def nb_tournois_actifs(user):
    """Tournois en cours ou à venir (date de fin pas encore passée)."""
    return user.tournois_crees.filter(date_fin__gte=timezone.localdate()).count()


def limite_tournois_atteinte(user):
    return not user.is_staff and nb_tournois_actifs(user) >= settings.LIMITE_TOURNOIS_ACTIFS


def type_compte(user):
    if est_organisateur_valide(user):
        return ORGANISATEUR
    if user.groups.filter(name=GROUPE_DEMANDES).exists():
        return EN_ATTENTE
    return JOUEUR


def demander_validation(user):
    """Le compte attend la validation de l'équipe THE LAB (sans effet s'il est déjà organisateur)."""
    if not est_organisateur_valide(user):
        Group.objects.get_or_create(name=GROUPE_DEMANDES)[0].user_set.add(user)


def valider(users):
    Group.objects.get_or_create(name=GROUPE_ORGANISATEURS)[0].user_set.add(*users)
    Group.objects.get_or_create(name=GROUPE_DEMANDES)[0].user_set.remove(*users)
