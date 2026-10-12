"""
Qui peut créer des tournois, et combien.

Tout le monde peut créer un compte, mais seuls les organisateurs validés par
l'équipe THE LAB (groupe « Organisateurs », géré dans l'admin Django) peuvent
créer des tournois. Les comptes staff n'ont ni validation ni limite.
"""
from django.conf import settings
from django.utils import timezone

GROUPE_ORGANISATEURS = 'Organisateurs'


def est_organisateur_valide(user):
    if not user.is_authenticated:
        return False
    return user.is_staff or user.groups.filter(name=GROUPE_ORGANISATEURS).exists()


def nb_tournois_actifs(user):
    """Tournois en cours ou à venir (date de fin pas encore passée)."""
    return user.tournois_crees.filter(date_fin__gte=timezone.localdate()).count()


def limite_tournois_atteinte(user):
    return not user.is_staff and nb_tournois_actifs(user) >= settings.LIMITE_TOURNOIS_ACTIFS
