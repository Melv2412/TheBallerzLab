"""
Calculs métier du tournoi (classement, MVP), séparés des vues pour être testables et réutilisables.
"""
from collections import Counter

from django.core.files.storage import default_storage
from django.db.models import Count, F, Q, Sum

from .classement import analyser_classement
from .models import StatistiqueJoueur

# Évaluation simplifiée d'une ligne de stats : PTS + AST + REB + BLK - FAUTES
EVALUATION = F('points') + F('passes') + F('rebonds') + F('contres') - F('fautes')

STATS_NON_NULLES = (
    Q(points__gt=0) | Q(passes__gt=0) | Q(rebonds__gt=0) | Q(contres__gt=0) | Q(fautes__gt=0)
)
# A joué = au moins une stat, ou présence confirmée par l'organisateur
A_JOUE = STATS_NON_NULLES | Q(presence_confirmee=True)


def evaluation(stat):
    return stat.points + stat.passes + stat.rebonds + stat.contres - stat.fautes


def filtrer_par_type(matchs_ou_stats, type_classement, champ_phase='phase'):
    """`type_classement` : 'poule', 'elimination', ou autre chose pour tout garder."""
    if type_classement == 'poule':
        return matchs_ou_stats.filter(**{champ_phase: 'poule'})
    if type_classement == 'elimination':
        return matchs_ou_stats.exclude(**{champ_phase: 'poule'})
    return matchs_ou_stats


def analyse_du_classement(tournoi, type_classement=None):
    """Classement (FIBA ou % de victoires, selon le règlement) sur les matchs terminés et égalités parfaites (2 requêtes, calcul en mémoire)."""
    matchs = filtrer_par_type(tournoi.matchs.filter(statut='termine'), type_classement)
    equipes = tournoi.equipes.values_list('id', 'nom')
    scores = matchs.values_list(
        'equipe_domicile_id', 'equipe_exterieur_id', 'score_domicile', 'score_exterieur', 'forfait',
    )
    reglement = tournoi.reglement
    # Les égalités tranchées concernent les places qualificatives, donc le classement de poule
    decisions = [d['equipes'] for d in tournoi.departage_poule] if type_classement == 'poule' else ()
    return analyser_classement(
        equipes, scores, reglement['points_victoire'], reglement['points_defaite'], decisions,
        reglement.get('mode_classement', 'points'),
    )


def classement_du_tournoi(tournoi, type_classement=None):
    return analyse_du_classement(tournoi, type_classement)[0]


def _url_photo(nom):
    return default_storage.url(nom) if nom else None


def meilleurs_joueurs(tournoi, type_classement=None, limite=5):
    """
    Joueurs à la meilleure évaluation moyenne sur les matchs terminés où ils ont joué, hors forfaits (2 requêtes).
    Pour éviter qu'un seul gros match suffise, un joueur doit avoir joué au moins la moitié des matchs de son équipe.
    """
    stats = filtrer_par_type(
        StatistiqueJoueur.objects.filter(
            A_JOUE, joueur__equipe__tournoi=tournoi, match__statut='termine', match__forfait='',
        ),
        type_classement,
        champ_phase='match__phase',
    )
    totaux = (
        stats.values(
            'joueur_id', 'joueur__prenom', 'joueur__nom', 'joueur__numero_maillot',
            'joueur__equipe_id', 'joueur__equipe__nom', 'joueur__athlete_id', 'joueur__photo', 'joueur__athlete__photo',
        )
        .annotate(nb_matchs=Count('id'), total_eval=Sum(EVALUATION), total_points=Sum('points'))
        .order_by('joueur__equipe', 'joueur__numero_maillot')
    )
    matchs_par_equipe = Counter()
    matchs_joues = filtrer_par_type(tournoi.matchs.filter(statut='termine', forfait=''), type_classement)
    for domicile, exterieur in matchs_joues.values_list('equipe_domicile_id', 'equipe_exterieur_id'):
        matchs_par_equipe.update((domicile, exterieur))

    joueurs = [
        {
            'id': t['joueur_id'],
            'nom': f"{t['joueur__prenom']} {t['joueur__nom']}",
            'numero': t['joueur__numero_maillot'],
            'equipe': t['joueur__equipe__nom'],
            'athlete': t['joueur__athlete_id'],
            # Photo de l'inscription, sinon celle de la fiche athlète (comme dans les effectifs)
            'photo': _url_photo(t['joueur__photo'] or t['joueur__athlete__photo']),
            'moyenne_eval': round(t['total_eval'] / t['nb_matchs'], 1),
            'total_points': t['total_points'],
            'nb_matchs': t['nb_matchs'],
        }
        for t in totaux
        if t['nb_matchs'] * 2 >= matchs_par_equipe[t['joueur__equipe_id']]
    ]
    joueurs.sort(key=lambda j: j['moyenne_eval'], reverse=True)
    return joueurs[:limite]


def mvp_du_match(stats):
    """Meilleure évaluation d'un match (stats déjà chargées), ou None si personne n'a d'évaluation positive."""
    meilleur = max(stats, key=evaluation, default=None)
    if meilleur is None or evaluation(meilleur) <= 0:
        return None
    joueur = meilleur.joueur
    return {
        'nom': f"{joueur.prenom} {joueur.nom}",
        'numero': joueur.numero_maillot,
        'equipe': joueur.equipe.nom,
        'evaluation': evaluation(meilleur),
        'stats': {
            'pts': meilleur.points,
            'ast': meilleur.passes,
            'reb': meilleur.rebonds,
            'blk': meilleur.contres,
            'fouls': meilleur.fautes,
        },
    }
