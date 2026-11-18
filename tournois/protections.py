"""
Protection des résultats : ce qui a été joué ne disparaît pas et ne change pas de sens après coup.

Une ligne de stats à 0 partout ne compte pas comme une stat : « Initialiser les stats » en crée une pour
chaque joueur, même s'il n'est jamais entré sur le terrain.
"""
from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from rest_framework.exceptions import ValidationError

from .athletes import ConflitAthlete, verifier_un_par_tournoi
from .models import Joueur, Match, StatistiqueJoueur
from .phases_finales import verrouiller_tournoi

STATS_NON_NULLES = (
    Q(points__gt=0) | Q(passes__gt=0) | Q(rebonds__gt=0) | Q(contres__gt=0) | Q(fautes__gt=0)
)


def stats_reelles():
    return StatistiqueJoueur.objects.filter(STATS_NON_NULLES)


def annoter_stats_joueurs(joueurs):
    """Ajoute `a_stats` à chaque joueur, en une seule requête."""
    return joueurs.annotate(a_stats=Exists(stats_reelles().filter(joueur=OuterRef('pk'))))


def joueur_a_des_stats(joueur):
    annotation = getattr(joueur, 'a_stats', None)
    if annotation is not None:
        return annotation
    return stats_reelles().filter(joueur=joueur).exists()


def matchs_commences(matchs):
    """Les matchs du queryset qui ont démarré, d'après leur statut, leur chrono ou leurs stats."""
    avec_stats = matchs.annotate(a_stats=Exists(stats_reelles().filter(match=OuterRef('pk'))))
    return [match for match in avec_stats if match.a_commence or match.a_stats]


def equipe_a_joue(equipe):
    return bool(matchs_commences(
        Match.objects.filter(Q(equipe_domicile=equipe) | Q(equipe_exterieur=equipe))
    ))


def phases_commencees(tournoi):
    return {match.phase for match in matchs_commences(tournoi.matchs.exclude(phase='poule'))}


@transaction.atomic
def retirer_de_l_effectif(joueur):
    """Le joueur quitte l'équipe pour la suite ; ses stats restent dans les matchs déjà joués."""
    verrouiller_tournoi(joueur.equipe.tournoi)
    joueur.retire = True
    joueur.save(update_fields=['retire', 'updated_at'])
    # Ses lignes vides des matchs pas terminés disparaissent : il n'apparaît plus à la table de marque
    joueur.statistiques.exclude(match__statut='termine').exclude(STATS_NON_NULLES).delete()
    return joueur


@transaction.atomic
def remettre_dans_l_effectif(joueur):
    equipe = joueur.equipe
    verrouiller_tournoi(equipe.tournoi)
    try:
        verifier_un_par_tournoi(joueur.athlete, equipe.tournoi_id, sauf_joueur=joueur)
    except ConflitAthlete as erreur:
        raise ValidationError({'detail': str(erreur)}) from erreur
    actifs = Joueur.objects.filter(equipe=equipe, retire=False).exclude(pk=joueur.pk)
    if actifs.count() >= settings.LIMITE_JOUEURS_PAR_EQUIPE:
        raise ValidationError({'detail': (
            f"L'équipe est complète ({settings.LIMITE_JOUEURS_PAR_EQUIPE} joueurs maximum)."
        )})
    if actifs.filter(numero_maillot=joueur.numero_maillot).exists():
        raise ValidationError({'detail': (
            f"Le numéro {joueur.numero_maillot} est repris par un autre joueur : change d'abord l'un des deux numéros."
        )})
    joueur.retire = False
    joueur.save(update_fields=['retire', 'updated_at'])
    return joueur
