"""Profil d'un athlète : stats de carrière, tournois joués et palmarès (matchs terminés uniquement)."""
from collections import defaultdict

from .models import StatistiqueJoueur
from .phases_finales import phases_actives, series_de_la_phase
from .services import A_JOUE, evaluation

CHAMPS = ['points', 'passes', 'rebonds', 'contres', 'fautes']
ELIMINATION = {
    '8eme': "Éliminé en 8e de finale",
    'quart': "Éliminé en quart de finale",
    'demi': "Éliminé en demi-finale",
    'finale': "Finaliste",
}
EN_COURS = {
    '8eme': "En 8e de finale",
    'quart': "En quart de finale",
    'demi': "En demi-finale",
    'finale': "En finale",
}


def resultat_equipe(tournoi, equipe_id):
    """
    Jusqu'où l'équipe est allée dans le tableau final :
    {'code': 'champion' | 'elimine' | 'en_cours' | 'poule', 'libelle': ...}
    """
    matchs = list(tournoi.matchs.exclude(phase='poule'))
    atteinte = None
    for phase in phases_actives(tournoi):
        for serie in series_de_la_phase(tournoi, phase, [m for m in matchs if m.phase == phase]):
            if equipe_id in serie['equipes']:
                atteinte = (phase, serie['vainqueur'])
    if atteinte is None:
        return {'code': 'poule', 'libelle': "Phase de poule"}
    phase, vainqueur = atteinte
    if vainqueur is None:
        return {'code': 'en_cours', 'libelle': EN_COURS[phase]}
    if vainqueur == equipe_id:
        if phase == 'finale':
            return {'code': 'champion', 'libelle': "Champion"}
        return {'code': 'en_cours', 'libelle': EN_COURS[phase]}  # qualifié, tour suivant pas encore créé
    return {'code': 'elimine', 'libelle': ELIMINATION[phase]}


def _cumul(stats):
    totaux = {champ: sum(getattr(s, champ) for s in stats) for champ in CHAMPS}
    totaux['matchs'] = len(stats)
    totaux['moyennes'] = {
        champ: round(totaux[champ] / len(stats), 1) if stats else 0 for champ in CHAMPS
    }
    return totaux


def profil_athlete(athlete, photo_url=None):
    joueurs = list(
        athlete.joueurs.select_related('equipe__tournoi').order_by('-equipe__tournoi__date_debut', '-id')
    )
    # Seuls les matchs réellement joués comptent : une ligne à 0 sans présence confirmée est une absence
    stats = list(
        StatistiqueJoueur.objects.filter(A_JOUE, joueur__athlete=athlete, match__statut='termine')
    )
    # MVP (même règle que la page du match) : il faut toutes les stats de chaque match joué
    stats_des_matchs = defaultdict(list)
    for stat in StatistiqueJoueur.objects.filter(match__in={s.match_id for s in stats}):
        stats_des_matchs[stat.match_id].append(stat)
    mvp_par_joueur = defaultdict(int)
    for liste in stats_des_matchs.values():
        meilleur = max(liste, key=evaluation)
        if evaluation(meilleur) > 0:
            mvp_par_joueur[meilleur.joueur_id] += 1

    par_joueur = defaultdict(list)
    for stat in stats:
        par_joueur[stat.joueur_id].append(stat)

    tournois = []
    for joueur in joueurs:
        if joueur.retire and not par_joueur[joueur.id]:
            continue  # retiré sans avoir joué : ce tournoi ne fait pas partie de son parcours
        tournoi = joueur.equipe.tournoi
        ligne = _cumul(par_joueur[joueur.id])
        ligne.update({
            'tournoi_nom': tournoi.nom,
            'tournoi_slug': tournoi.slug,
            'date_debut': tournoi.date_debut,
            'equipe_nom': joueur.equipe.nom,
            'numero': joueur.numero_maillot,
            'mvp': mvp_par_joueur[joueur.id],
            'resultat': resultat_equipe(tournoi, joueur.equipe_id),
        })
        tournois.append(ligne)

    carriere = _cumul(stats)
    carriere['tournois'] = len({t['tournoi_slug'] for t in tournois})  # deux équipes du même tournoi = un tournoi
    carriere['mvp'] = sum(mvp_par_joueur[j.id] for j in joueurs)
    carriere['titres'] = sum(1 for t in tournois if t['resultat']['code'] == 'champion')
    return {
        'id': athlete.pk,
        'prenom': athlete.prenom,
        'nom': athlete.nom,
        'photo': photo_url,
        'compte_verifie': athlete.utilisateur_id is not None,  # le joueur a relié son compte
        'carriere': carriere,
        'tournois': tournois,
    }
