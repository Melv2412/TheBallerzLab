"""
Clôture d'un tournoi : l'organisateur le passe en lecture seule, seul un administrateur peut le rouvrir.

Un tournoi clôturé ne compte plus dans la limite de tournois actifs de son organisateur.
Restent possibles : le supprimer, changer sa visibilité, et relier un compte à un joueur existant
(un joueur peut retrouver ses stats après la fin du tournoi).
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Tournoi

MESSAGE_CLOTURE = "Ce tournoi est clôturé : il est en lecture seule. Seul un administrateur peut le rouvrir."


def exiger_tournoi_ouvert(tournoi):
    if tournoi is not None and tournoi.cloture_le is not None:
        raise ValidationError({'detail': MESSAGE_CLOTURE})


def _enregistrer(tournoi, valeur):
    tournoi.cloture_le = valeur
    tournoi.save(update_fields=['cloture_le', 'updated_at'])
    return tournoi


@transaction.atomic
def cloturer(tournoi):
    """Refusé tant qu'un match se joue ; les matchs à venir restent tels quels, sans résultat."""
    exiger_tournoi_ouvert(Tournoi.objects.select_for_update().get(pk=tournoi.pk))
    en_cours = tournoi.matchs.filter(statut='en_cours').count()
    if en_cours:
        raise ValidationError({'detail': f"Impossible de clôturer : {en_cours} match(s) en cours."})
    return _enregistrer(tournoi, timezone.now())


@transaction.atomic
def rouvrir(tournoi):
    if Tournoi.objects.select_for_update().get(pk=tournoi.pk).cloture_le is None:
        raise ValidationError({'detail': "Ce tournoi n'est pas clôturé."})
    return _enregistrer(tournoi, None)
