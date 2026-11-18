"""
Forfaits : le résultat compte pour le tournoi (classement, séries, qualification), jamais pour les joueurs.

Un match forfait reste un match « terminé », avec un score posé à la main. Les stats déjà saisies sont
conservées mais ignorées ; elles reprennent leur place si le forfait est annulé.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Match
from .phases_finales import avancer_phases_finales, phase_suivante_commencee, verrouiller_tournoi
from .services import STATS_NON_NULLES

SCORE_VAINQUEUR = 20
SCORE_PERDANT = 0


def _refuser_si_phase_suivante(match):
    if match.phase != 'poule' and phase_suivante_commencee(match):
        raise ValidationError({'detail': (
            "La phase suivante a déjà commencé : réinitialisez-la (onglet Phase finale) avant de changer ce résultat."
        )})


def _appliquer(match, equipe, score_vainqueur, score_perdant):
    if equipe == Match.FORFAIT_DOUBLE and match.phase != 'poule':
        raise ValidationError({'equipe': "Un double forfait n'est possible qu'en poule : une série doit avoir un vainqueur."})
    match.figer_chrono(timezone.now())
    match.chrono_en_cours = False
    match.chrono_demarre_a = None
    if equipe == Match.FORFAIT_DOUBLE:
        match.score_domicile = match.score_exterieur = 0
    elif equipe == Match.FORFAIT_DOMICILE:
        match.score_domicile, match.score_exterieur = score_perdant, score_vainqueur
    else:
        match.score_domicile, match.score_exterieur = score_vainqueur, score_perdant
    match.forfait = equipe
    match.statut = 'termine'
    match.save(update_fields=[
        'forfait', 'statut', 'score_domicile', 'score_exterieur', 'chrono_en_cours', 'chrono_demarre_a',
        'temps_restant_secondes', 'shot_clock_secondes', 'periode_actuelle', 'updated_at',
    ])


@transaction.atomic
def declarer_forfait(match, equipe, score_vainqueur=SCORE_VAINQUEUR, score_perdant=SCORE_PERDANT):
    """Déclare le forfait, ou corrige celui déjà déclaré (équipe ou score)."""
    tournoi = match.tournoi
    verrouiller_tournoi(tournoi)  # le tableau peut avancer : même ordre de verrous que la fin d'un match
    match = Match.objects.select_for_update().get(pk=match.pk)
    if match.statut == 'termine' and not match.forfait:
        raise ValidationError({'detail': "Match terminé : repassez-le « en cours » pour déclarer un forfait."})
    if match.forfait and match.forfait != equipe:
        _refuser_si_phase_suivante(match)
    _appliquer(match, equipe, score_vainqueur, score_perdant)
    if match.phase != 'poule':
        avancer_phases_finales(tournoi)
    return match


@transaction.atomic
def annuler_forfait(match):
    """Le match redevient jouable, avec le score de ses stats conservées."""
    verrouiller_tournoi(match.tournoi)
    match = Match.objects.select_for_update().get(pk=match.pk)
    if not match.forfait:
        raise ValidationError({'detail': "Ce match n'est pas déclaré forfait."})
    _refuser_si_phase_suivante(match)
    match.forfait = Match.FORFAIT_AUCUN
    match.statut = 'a_venir'
    if match.a_commence or match.statistiques_joueurs.filter(STATS_NON_NULLES).exists():
        match.statut = 'en_cours'
    match.save(update_fields=['forfait', 'statut', 'updated_at'])
    match.calculer_scores_depuis_stats()
    return match


@transaction.atomic
def forfait_general(equipe):
    """L'équipe abandonne : elle perd par forfait tous ses matchs pas encore terminés. Renvoie leur nombre."""
    tournoi = equipe.tournoi
    verrouiller_tournoi(tournoi)
    total = 0
    # Dans une série, chaque défaite peut créer le match suivant : on continue jusqu'à l'élimination
    while True:
        matchs = list(
            Match.objects.select_for_update()
            .filter(Q(equipe_domicile=equipe) | Q(equipe_exterieur=equipe))
            .exclude(statut='termine')
        )
        if not matchs:
            break
        for match in matchs:
            cote = Match.FORFAIT_DOMICILE if match.equipe_domicile_id == equipe.pk else Match.FORFAIT_EXTERIEUR
            _appliquer(match, cote, SCORE_VAINQUEUR, SCORE_PERDANT)
        total += len(matchs)
        if any(match.phase != 'poule' for match in matchs):
            avancer_phases_finales(tournoi)
    if not total:
        raise ValidationError({'detail': "Cette équipe n'a plus aucun match à jouer."})
    return total
