"""
Phases finales : séries au meilleur des N matchs et progression automatique du tableau.

- Une série = les matchs d'une phase entre les deux mêmes équipes. Elle est gagnée par la première équipe
  qui atteint le nombre de victoires requis pour la phase (réglage du tournoi).
- Quand un match éliminatoire se termine : si la série n'est pas décidée, le match suivant est créé
  (domicile et extérieur alternés) ; quand toutes les séries d'une phase sont décidées, la phase suivante
  est créée en appariant les vainqueurs comme dans un tableau classique (1re série contre dernière...).
"""
import random

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .cloture import exiger_tournoi_ouvert
from .models import Match, Tournoi

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


def verrouiller_tournoi(tournoi):
    """
    Verrouille le tournoi jusqu'à la fin de la transaction. Deux matchs terminés au même moment
    (ou un double clic sur « générer ») ne créent ainsi pas deux fois la même phase : le second
    attend le premier, puis relit les matchs et voit ceux déjà créés.
    """
    Tournoi.objects.select_for_update().filter(pk=tournoi.pk).values_list('pk', flat=True).first()


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


def egalite_qualification(tournoi):
    """
    Égalité parfaite à cheval sur la dernière place qualificative, une fois les poules terminées :
    aucun critère FIBA ne dit quelle équipe se qualifie. None s'il n'y en a pas.
    """
    from .services import analyse_du_classement

    actives = phases_actives(tournoi)
    if not actives or tournoi.matchs.filter(phase='poule').exclude(statut='termine').exists():
        return None
    nombre = EQUIPES_PAR_PHASE[actives[0]]
    classement, egalites = analyse_du_classement(tournoi, 'poule')
    if len(classement) <= nombre:
        return None
    frontiere = {classement[nombre - 1]['id'], classement[nombre]['id']}
    groupe = next((g for g in egalites if frontiere <= g), None)
    if groupe is None:
        return None
    rangs = [rang for rang, equipe in enumerate(classement) if equipe['id'] in groupe]
    decision = next((d for d in tournoi.departage_poule if set(d['equipes']) == groupe), None)
    return {
        'equipes': [{'id': classement[r]['id'], 'nom': classement[r]['nom']} for r in rangs],
        'premiere_place': rangs[0] + 1,
        'places_qualificatives': nombre - rangs[0],
        'decision': {'mode': decision['mode'], 'le': decision['le']} if decision else None,
    }


def _ordre_valide(ordre, ids):
    return (
        isinstance(ordre, list)
        and all(isinstance(i, int) and not isinstance(i, bool) for i in ordre)
        and sorted(ordre) == sorted(ids)
    )


@transaction.atomic
def departager_qualification(tournoi, ordre=None):
    """
    Tranche l'égalité : `ordre` choisi par l'organisateur, ou tirage au sort sans `ordre`.
    Le choix de l'organisateur reste modifiable jusqu'à la création du tableau ; un tirage est définitif.
    """
    verrouiller_tournoi(tournoi)
    tournoi.refresh_from_db(fields=['cloture_le', 'departage_poule'])
    exiger_tournoi_ouvert(tournoi)
    if tournoi.matchs.exclude(phase='poule').exists():
        raise ValidationError({'detail': "Les phases finales ont déjà commencé : réinitialisez-les d'abord."})
    egalite = egalite_qualification(tournoi)
    if egalite is None:
        raise ValidationError({'detail': "Aucune égalité parfaite à départager pour une place qualificative."})
    if egalite['decision'] and egalite['decision']['mode'] == 'tirage':
        raise ValidationError({'detail': "Le tirage au sort a déjà eu lieu : son résultat est définitif."})

    ids = [equipe['id'] for equipe in egalite['equipes']]
    if ordre is None:
        mode, ordre = 'tirage', ids[:]
        random.SystemRandom().shuffle(ordre)
    elif _ordre_valide(ordre, ids):
        mode = 'organisateur'
    else:
        raise ValidationError({'detail': "L'ordre doit contenir exactement les équipes à égalité."})

    autres = [d for d in tournoi.departage_poule if set(d['equipes']) != set(ids)]
    tournoi.departage_poule = [*autres, {'equipes': ordre, 'mode': mode, 'le': timezone.now().isoformat()}]
    tournoi.save(update_fields=['departage_poule', 'updated_at'])
    return egalite_qualification(tournoi)


@transaction.atomic
def generer_phases_finales(tournoi):
    """Crée le premier tour avec les meilleures équipes du classement de poule (1er contre dernier qualifié...)."""
    from .services import classement_du_tournoi

    verrouiller_tournoi(tournoi)
    tournoi.refresh_from_db(fields=['cloture_le', 'departage_poule'])
    exiger_tournoi_ouvert(tournoi)
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
    egalite = egalite_qualification(tournoi)
    if egalite and not egalite['decision']:
        noms = ', '.join(equipe['nom'] for equipe in egalite['equipes'])
        raise ValidationError({'detail': (
            f"Égalité parfaite pour une place qualificative ({noms}) : "
            "choisissez l'ordre ou lancez le tirage au sort avant de créer le tableau."
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
    verrouiller_tournoi(tournoi)
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
        if len(vainqueurs) != EQUIPES_PAR_PHASE[suivante]:
            # Tableau construit à la main, ou phases actives qui ne se suivent pas (ex. quarts puis finale) :
            # pas d'appariement automatique
            return
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
