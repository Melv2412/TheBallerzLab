"""
Classement d'un tournoi selon les règles FIBA (Règlement officiel, annexe D - Classement des équipes).

- Victoire : 2 points, défaite : 1 point (réglables dans le règlement du tournoi).
- Équipes à égalité de points, départagées dans cet ordre :
    1. points de classement dans les matchs entre elles ;
    2. différence de points dans les matchs entre elles ;
    3. points marqués dans les matchs entre elles ;
    4. différence de points sur tous les matchs ;
    5. points marqués sur tous les matchs.
  Dès qu'un critère sépare une partie des équipes, on recommence à 1 pour celles encore à égalité.
- Égalité parfaite : la FIBA prévoit un tirage au sort ; ici, ordre alphabétique (stable et reproductible).

Un match nul n'existe pas au basket : un match terminé sur une égalité (données anciennes) est ignoré.

Forfait : le vainqueur reçoit ses points de victoire, l'équipe forfait 0. Un double forfait compte comme
une défaite à 0 point pour chacune, sans vainqueur.
"""

POINTS_VICTOIRE = 2
POINTS_DEFAITE = 1
BAREME_FIBA = (POINTS_VICTOIRE, POINTS_DEFAITE)


def _forfait(rencontre):
    return rencontre[4] if len(rencontre) > 4 else ''


def _bilan(ids, rencontres, bareme=BAREME_FIBA):
    """Bilan de chaque équipe de `ids` sur les rencontres données."""
    bilan = {
        i: {'joues': 0, 'gagnes': 0, 'perdus': 0, 'points_pour': 0, 'points_contre': 0, 'points': 0}
        for i in ids
    }
    for rencontre in rencontres:
        domicile, exterieur, score_dom, score_ext = rencontre[:4]
        forfait = _forfait(rencontre)
        for equipe, cote, pour, contre in (
            (domicile, 'domicile', score_dom, score_ext),
            (exterieur, 'exterieur', score_ext, score_dom),
        ):
            stats = bilan.get(equipe)
            if stats is None:
                continue
            stats['joues'] += 1
            stats['points_pour'] += pour
            stats['points_contre'] += contre
            if forfait in (cote, 'double'):
                stats['perdus'] += 1
            elif pour > contre:
                stats['gagnes'] += 1
                stats['points'] += bareme[0]
            else:
                stats['perdus'] += 1
                stats['points'] += bareme[1]
    for stats in bilan.values():
        stats['difference'] = stats['points_pour'] - stats['points_contre']
    return bilan


def _departager(ids, rencontres, general, noms, bareme):
    """Ordonne des équipes à égalité de points (critères FIBA, appliqués récursivement)."""
    if len(ids) <= 1:
        return list(ids)

    groupe = set(ids)
    entre_elles = _bilan(ids, [r for r in rencontres if r[0] in groupe and r[1] in groupe], bareme)
    criteres = (
        lambda i: entre_elles[i]['points'],
        lambda i: entre_elles[i]['difference'],
        lambda i: entre_elles[i]['points_pour'],
        lambda i: general[i]['difference'],
        lambda i: general[i]['points_pour'],
    )
    for critere in criteres:
        valeurs = {i: critere(i) for i in ids}
        paliers = sorted(set(valeurs.values()), reverse=True)
        if len(paliers) > 1:
            ordre = []
            for valeur in paliers:
                ordre += _departager([i for i in ids if valeurs[i] == valeur], rencontres, general, noms, bareme)
            return ordre

    return sorted(ids, key=lambda i: noms[i].lower())


def calculer_classement(equipes, scores, points_victoire=POINTS_VICTOIRE, points_defaite=POINTS_DEFAITE):
    """
    equipes : itérable de (id, nom)
    scores : itérable de (equipe_domicile_id, equipe_exterieur_id, score_domicile, score_exterieur[, forfait])
             des matchs terminés
    """
    noms = dict(equipes)
    rencontres = [r for r in scores if (r[2] != r[3] or _forfait(r)) and r[0] in noms and r[1] in noms]
    bareme = (points_victoire, points_defaite)
    general = _bilan(noms, rencontres, bareme)

    ordre = []
    for points in sorted({stats['points'] for stats in general.values()}, reverse=True):
        ordre += _departager([i for i in noms if general[i]['points'] == points], rencontres, general, noms, bareme)

    return [{'id': i, 'nom': noms[i], **general[i]} for i in ordre]
