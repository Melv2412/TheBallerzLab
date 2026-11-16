"""
Calculs métier du tournoi (classement, MVP), séparés des vues pour être testables et réutilisables.
"""
from django.db.models import Count, F, Sum

from .classement import calculer_classement
from .models import StatistiqueJoueur

# Évaluation simplifiée d'une ligne de stats : PTS + AST + REB + BLK - FAUTES
EVALUATION = F('points') + F('passes') + F('rebonds') + F('contres') - F('fautes')


def evaluation(stat):
    return stat.points + stat.passes + stat.rebonds + stat.contres - stat.fautes


def filtrer_par_type(matchs_ou_stats, type_classement, champ_phase='phase'):
    """`type_classement` : 'poule', 'elimination', ou autre chose pour tout garder."""
    if type_classement == 'poule':
        return matchs_ou_stats.filter(**{champ_phase: 'poule'})
    if type_classement == 'elimination':
        return matchs_ou_stats.exclude(**{champ_phase: 'poule'})
    return matchs_ou_stats


def classement_du_tournoi(tournoi, type_classement=None):
    """Classement FIBA sur les matchs terminés (2 requêtes, calcul en mémoire)."""
    matchs = filtrer_par_type(tournoi.matchs.filter(statut='termine'), type_classement)
    equipes = tournoi.equipes.values_list('id', 'nom')
    scores = matchs.values_list('equipe_domicile_id', 'equipe_exterieur_id', 'score_domicile', 'score_exterieur')
    reglement = tournoi.reglement
    return calculer_classement(equipes, scores, reglement['points_victoire'], reglement['points_defaite'])


def meilleurs_joueurs(tournoi, type_classement=None, limite=5):
    """Joueurs à la meilleure évaluation moyenne sur les matchs terminés (1 requête)."""
    stats = filtrer_par_type(
        StatistiqueJoueur.objects.filter(joueur__equipe__tournoi=tournoi, match__statut='termine'),
        type_classement,
        champ_phase='match__phase',
    )
    totaux = (
        stats.values('joueur_id', 'joueur__prenom', 'joueur__nom', 'joueur__numero_maillot', 'joueur__equipe__nom')
        .annotate(nb_matchs=Count('id'), total_eval=Sum(EVALUATION), total_points=Sum('points'))
        .order_by('joueur__equipe', 'joueur__numero_maillot')
    )
    joueurs = [
        {
            'id': t['joueur_id'],
            'nom': f"{t['joueur__prenom']} {t['joueur__nom']}",
            'numero': t['joueur__numero_maillot'],
            'equipe': t['joueur__equipe__nom'],
            'moyenne_eval': round(t['total_eval'] / t['nb_matchs'], 1),
            'total_points': t['total_points'],
            'nb_matchs': t['nb_matchs'],
        }
        for t in totaux
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
