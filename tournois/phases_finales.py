"""
Phases finales : séries au meilleur des N matchs et progression automatique du tableau.

- Une série = les matchs d'une phase entre les deux mêmes équipes. Elle est gagnée par la première équipe
  qui atteint le nombre de victoires requis pour la phase (réglage du tournoi).
- Quand un match éliminatoire se termine : si la série n'est pas décidée, le match suivant est créé
  (domicile et extérieur alternés) ; quand toutes les séries d'une phase sont décidées, la phase suivante
  est créée en appariant les vainqueurs comme dans un tableau classique (1re série contre dernière...).
"""
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Match

PHASES = ['8eme', 'quart', 'demi', 'finale']
LIBELLES = {'8eme': '8èmes de finale', 'quart': 'Quarts de finale', 'demi': 'Demi-finales', 'finale': 'Finale'}
ACTIVATION = {'8eme': 'has_8emes', 'quart': 'has_quarts', 'demi': 'has_demis', 'finale': 'has_finale'}
VICTOIRES_REQUISES = {
    '8eme': 'victoires_requises_8eme',
    'quart': 'victoires_requises_quart',
    'demi': 'victoires_requises_demi',
    'finale': 'victoires_requises_finale',
}
EQUIPES_PAR_PHASE = {'8eme': 16, 'quart': 8, 'demi': 4, 'finale': 2}


def phases_actives(tournoi):
    return [phase for phase in PHASES if getattr(tournoi, ACTIVATION[phase])]


def creer_match(tournoi, phase, domicile_id, exterieur_id):
    match = Match(
        tournoi=tournoi, phase=phase, equipe_domicile_id=domicile_id, equipe_exterieur_id=exterieur_id,
        reglement=dict(tournoi.reglement),
    )
    match.appliquer_reglement()
    match.save()
    return match


def series_de_la_phase(tournoi, phase, matchs=None):
    """Séries de la phase, dans l'ordre de leur premier match (l'ordre du tableau)."""
    if matchs is None:
        matchs = tournoi.matchs.filter(phase=phase)
    requises = getattr(tournoi, VICTOIRES_REQUISES[phase])
    series = {}
    for match in sorted(matchs, key=lambda m: (m.created_at, m.id)):
        cle = frozenset((match.equipe_domicile_id, match.equipe_exterieur_id))
        serie = series.setdefault(cle, {
            'equipes': [match.equipe_domicile_id, match.equipe_exterieur_id],
            'victoires': {match.equipe_domicile_id: 0, match.equipe_exterieur_id: 0},
            'matchs': [],
        })
        serie['matchs'].append(match)
        if match.statut == 'termine':
            gagnant = match.equipe_domicile_id if match.score_domicile > match.score_exterieur else match.equipe_exterieur_id
            serie['victoires'][gagnant] += 1
    for serie in series.values():
        serie['victoires_requises'] = requises
        serie['vainqueur'] = next((e for e, v in serie['victoires'].items() if v >= requises), None)
        serie['en_attente'] = [m for m in serie['matchs'] if m.statut != 'termine']
    return list(series.values())


@transaction.atomic
def generer_phases_finales(tournoi):
    """Crée le premier tour avec les meilleures équipes du classement de poule (1er contre dernier qualifié...)."""
    from .services import classement_du_tournoi

    actives = phases_actives(tournoi)
    if not actives:
        raise ValidationError({'detail': "Aucune phase finale n'est activée dans les paramètres du tournoi."})
    if tournoi.matchs.exclude(phase='poule').exists():
        raise ValidationError({'detail': "Les phases finales ont déjà commencé : réinitialisez-les d'abord."})
    restants = tournoi.matchs.filter(phase='poule').exclude(statut='termine').count()
    if restants:
        raise ValidationError({'detail': f"Il reste {restants} match(s) de poule à terminer."})

    depart = actives[0]
    nombre = EQUIPES_PAR_PHASE[depart]
    classement = classement_du_tournoi(tournoi, 'poule')
    if len(classement) < nombre:
        raise ValidationError({'detail': (
            f"Les {LIBELLES[depart].lower()} demandent {nombre} équipes : le tournoi n'en a que {len(classement)}."
        )})
    qualifies = [equipe['id'] for equipe in classement[:nombre]]
    for i in range(nombre // 2):
        creer_match(tournoi, depart, qualifies[i], qualifies[nombre - 1 - i])


@transaction.atomic
def avancer_phases_finales(tournoi):
    """
    Fait avancer le tableau après un résultat : match suivant d'une série non décidée, suppression des
    matchs devenus inutiles (série déjà gagnée, jamais commencés), puis création de la phase suivante.
    """
    actives = phases_actives(tournoi)
    tous = list(tournoi.matchs.exclude(phase='poule').prefetch_related('statistiques_joueurs'))
    for index, phase in enumerate(actives):
        series = series_de_la_phase(tournoi, phase, [m for m in tous if m.phase == phase])
        if not series:
            return

        for serie in series:
            if serie['vainqueur'] is not None:
                for match in serie['en_attente']:
                    if not match.a_commence and not match.statistiques_joueurs.all():
                        match.delete()
            elif not serie['en_attente']:
                dernier = serie['matchs'][-1]
                creer_match(tournoi, phase, dernier.equipe_exterieur_id, dernier.equipe_domicile_id)

        vainqueurs = [serie['vainqueur'] for serie in series]
        if None in vainqueurs:
            return
        suivante = actives[index + 1] if index + 1 < len(actives) else None
        if suivante is None or any(m.phase == suivante for m in tous):
            continue
        if len(vainqueurs) % 2:
            return  # tableau construit à la main avec un nombre impair de séries : pas d'appariement automatique
        for i in range(len(vainqueurs) // 2):
            creer_match(tournoi, suivante, vainqueurs[i], vainqueurs[len(vainqueurs) - 1 - i])
        return


def resume_phases_finales(tournoi):
    """État des séries de chaque phase active, pour l'affichage du tableau."""
    noms = dict(tournoi.equipes.values_list('id', 'nom'))
    matchs = list(tournoi.matchs.exclude(phase='poule'))
    resultat = []
    for phase in phases_actives(tournoi):
        series = series_de_la_phase(tournoi, phase, [m for m in matchs if m.phase == phase])
        resultat.append({
            'phase': phase,
            'libelle': LIBELLES[phase],
            'victoires_requises': getattr(tournoi, VICTOIRES_REQUISES[phase]),
            'series': [
                {
                    'equipes': [
                        {'id': equipe, 'nom': noms.get(equipe, '?'), 'victoires': serie['victoires'][equipe]}
                        for equipe in serie['equipes']
                    ],
                    'vainqueur': serie['vainqueur'],
                    'matchs': [m.id for m in serie['matchs']],
                }
                for serie in series
            ],
        })
    return resultat


def phase_suivante_commencee(match):
    """Une phase après celle de ce match a-t-elle déjà des matchs ?"""
    actives = phases_actives(match.tournoi)
    if match.phase not in actives:
        return False
    suivantes = actives[actives.index(match.phase) + 1:]
    return match.tournoi.matchs.filter(phase__in=suivantes).exists()
