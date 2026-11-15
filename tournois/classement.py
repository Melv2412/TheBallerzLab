"""
Classement d'un tournoi selon les règles FIBA (Règlement officiel, annexe D - Classement des équipes).

- Victoire : 2 points, défaite : 1 point.
- Équipes à égalité de points, départagées dans cet ordre :
    1. points de classement dans les matchs entre elles ;
    2. différence de points dans les matchs entre elles ;
    3. points marqués dans les matchs entre elles ;
    4. différence de points sur tous les matchs ;
    5. points marqués sur tous les matchs.
  Dès qu'un critère sépare une partie des équipes, on recommence à 1 pour celles encore à égalité.
- Égalité parfaite : la FIBA prévoit un tirage au sort ; ici, ordre alphabétique (stable et reproductible).

Un match nul n'existe pas au basket : un match terminé sur une égalité (données anciennes) est ignoré.
"""

POINTS_VICTOIRE = 2
POINTS_DEFAITE = 1


def _bilan(ids, rencontres):
    """Bilan de chaque équipe de `ids` sur les rencontres données."""
    bilan = {
        i: {'joues': 0, 'gagnes': 0, 'perdus': 0, 'points_pour': 0, 'points_contre': 0, 'points': 0}
        for i in ids
    }
    for domicile, exterieur, score_dom, score_ext in rencontres:
        for equipe, pour, contre in ((domicile, score_dom, score_ext), (exterieur, score_ext, score_dom)):
            stats = bilan.get(equipe)
            if stats is None:
                continue
            stats['joues'] += 1
            stats['points_pour'] += pour
            stats['points_contre'] += contre
            if pour > contre:
                stats['gagnes'] += 1
                stats['points'] += POINTS_VICTOIRE
            else:
                stats['perdus'] += 1
                stats['points'] += POINTS_DEFAITE
    for stats in bilan.values():
        stats['difference'] = stats['points_pour'] - stats['points_contre']
    return bilan


def _departager(ids, rencontres, general, noms):
    """Ordonne des équipes à égalité de points (critères FIBA, appliqués récursivement)."""
    if len(ids) <= 1:
        return list(ids)

    groupe = set(ids)
    entre_elles = _bilan(ids, [r for r in rencontres if r[0] in groupe and r[1] in groupe])
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
                ordre += _departager([i for i in ids if valeurs[i] == valeur], rencontres, general, noms)
            return ordre

    return sorted(ids, key=lambda i: noms[i].lower())


def calculer_classement(equipes, scores):
    """
    equipes : itérable de (id, nom)
    scores : itérable de (equipe_domicile_id, equipe_exterieur_id, score_domicile, score_exterieur)
             des matchs terminés
    """
    noms = dict(equipes)
    rencontres = [r for r in scores if r[2] != r[3] and r[0] in noms and r[1] in noms]
    general = _bilan(noms, rencontres)

    ordre = []
    for points in sorted({stats['points'] for stats in general.values()}, reverse=True):
        ordre += _departager([i for i in noms if general[i]['points'] == points], rencontres, general, noms)

    return [{'id': i, 'nom': noms[i], **general[i]} for i in ordre]
