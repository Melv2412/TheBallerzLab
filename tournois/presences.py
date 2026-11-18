"""
Présences d'un match terminé : l'organisateur indique quels joueurs sans aucune stat sont entrés sur le terrain.

Les joueurs qui ont une stat ont forcément joué : ils ne sont jamais demandés.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Joueur, Match, StatistiqueJoueur
from .services import STATS_NON_NULLES


def _joueurs_sans_stat(match):
    """[(joueur, présence confirmée)] : domicile d'abord, puis par numéro de maillot."""
    lignes = StatistiqueJoueur.objects.filter(match=match)
    avec_stats = lignes.filter(STATS_NON_NULLES).values_list('joueur_id', flat=True)
    lignes_vides = dict(lignes.exclude(STATS_NON_NULLES).values_list('joueur_id', 'presence_confirmee'))
    # L'effectif actuel, plus les joueurs retirés depuis qui ont une ligne dans ce match
    joueurs = Joueur.objects.filter(
        Q(equipe_id__in=[match.equipe_domicile_id, match.equipe_exterieur_id], retire=False)
        | Q(pk__in=lignes_vides)
    ).exclude(pk__in=avec_stats).select_related('equipe')
    tries = sorted(joueurs, key=lambda j: (j.equipe_id != match.equipe_domicile_id, j.numero_maillot, j.pk))
    return [(joueur, lignes_vides.get(joueur.pk, False)) for joueur in tries]


def presences_du_match(match):
    return [
        {
            'joueur': joueur.pk,
            'nom': f"{joueur.prenom} {joueur.nom}",
            'numero': joueur.numero_maillot,
            'equipe': joueur.equipe_id,
            'equipe_nom': joueur.equipe.nom,
            'present': present,
        }
        for joueur, present in _joueurs_sans_stat(match)
    ]


@transaction.atomic
def enregistrer_presences(match_id, presents):
    """
    `presents` remplace les présences confirmées du match. Écritures directes en base : le score et le
    score par période d'un match terminé ne sont pas recalculés.
    """
    match = Match.objects.select_for_update().get(pk=match_id)
    if match.statut != 'termine':
        raise ValidationError({'detail': "Les présences se confirment une fois le match terminé."})
    candidats = {joueur.pk for joueur, _ in _joueurs_sans_stat(match)}
    if presents - candidats:
        raise ValidationError({'presents': "La liste a changé : recharge la page et recommence."})

    lignes = StatistiqueJoueur.objects.filter(match=match, joueur_id__in=candidats)
    maintenant = timezone.now()
    lignes.filter(joueur_id__in=presents).update(presence_confirmee=True, updated_at=maintenant)
    lignes.exclude(joueur_id__in=presents).update(presence_confirmee=False, updated_at=maintenant)
    # Un joueur ajouté après le lancement des stats n'a pas encore de ligne dans ce match
    sans_ligne = presents - set(lignes.values_list('joueur_id', flat=True))
    StatistiqueJoueur.objects.bulk_create(
        StatistiqueJoueur(joueur_id=joueur_id, match=match, presence_confirmee=True) for joueur_id in sans_ligne
    )
    return match
