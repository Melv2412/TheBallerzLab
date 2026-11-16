"""
Règlement d'un tournoi ou d'un match : préréglages (FIBA par défaut, NBA, 3x3) et réglages personnalisés.

Le tournoi a un règlement ; chaque match en reçoit une copie à sa création. Modifier le règlement du tournoi
met à jour les matchs à venir, jamais ceux en cours ou terminés.
"""
from rest_framework import serializers

FIBA = {
    'nb_periodes': 4,
    'duree_periode_secondes': 600,
    'duree_prolongation_secondes': 300,
    'shot_clock_actif': True,
    'shot_clock_secondes': 24,
    'shot_clock_court_secondes': 14,
    # Fautes personnelles avant exclusion (0 = jamais exclu)
    'fautes_exclusion': 5,
    # Lancers francs à partir de la Xe faute d'équipe dans la période
    'fautes_bonus': 5,
    # Remise à zéro des fautes d'équipe : chaque période, chaque mi-temps ou jamais
    'fautes_equipe_reset': 'periode',
    'temps_morts_premiere_mi_temps': 2,
    'temps_morts_seconde_mi_temps': 3,
    'temps_morts_prolongation': 1,
    # Points au classement
    'points_victoire': 2,
    'points_defaite': 1,
}

PRESETS = {
    'fiba': FIBA,
    'nba': {
        **FIBA,
        'duree_periode_secondes': 720,
        'fautes_exclusion': 6,
        'temps_morts_premiere_mi_temps': 3,
        'temps_morts_seconde_mi_temps': 4,
        'temps_morts_prolongation': 2,
        'points_victoire': 1,
        'points_defaite': 0,
    },
    # 3x3 : la prolongation officielle se joue au premier à 2 points ; ici, une prolongation chronométrée
    '3x3': {
        **FIBA,
        'nb_periodes': 1,
        'duree_periode_secondes': 600,
        'duree_prolongation_secondes': 120,
        'shot_clock_secondes': 12,
        'shot_clock_court_secondes': 12,
        'fautes_exclusion': 0,
        'fautes_bonus': 7,
        'fautes_equipe_reset': 'match',
        'temps_morts_premiere_mi_temps': 1,
        'temps_morts_seconde_mi_temps': 0,
        'temps_morts_prolongation': 0,
    },
}

RESETS_FAUTES = ('periode', 'mi_temps', 'match')

# (minimum, maximum) des réglages numériques
BORNES = {
    'nb_periodes': (1, 8),
    'duree_periode_secondes': (60, 3600),
    'duree_prolongation_secondes': (60, 1800),
    'shot_clock_secondes': (5, 60),
    'shot_clock_court_secondes': (1, 60),
    'fautes_exclusion': (0, 20),
    'fautes_bonus': (1, 30),
    'temps_morts_premiere_mi_temps': (0, 10),
    'temps_morts_seconde_mi_temps': (0, 10),
    'temps_morts_prolongation': (0, 5),
    'points_victoire': (0, 10),
    'points_defaite': (0, 10),
}

# Réglages qu'on peut encore changer pendant un match : ils n'invalident pas les stats déjà saisies
REGLAGES_MODIFIABLES_EN_COURS = {
    'shot_clock_actif',
    'shot_clock_secondes',
    'shot_clock_court_secondes',
    'duree_periode_secondes',
    'duree_prolongation_secondes',
    'temps_morts_premiere_mi_temps',
    'temps_morts_seconde_mi_temps',
    'temps_morts_prolongation',
}


def nom_preset(reglement):
    """Nom du préréglage identique au règlement, sinon 'personnalise'."""
    for nom, preset in PRESETS.items():
        if reglement == preset:
            return nom
    return 'personnalise'


def valider_reglement(modifications, base=None):
    """
    Applique `modifications` (dict partiel) sur `base` (FIBA par défaut) et renvoie le règlement complet validé.
    Lève serializers.ValidationError avec un message par réglage invalide.
    """
    if not isinstance(modifications, dict):
        raise serializers.ValidationError("Le règlement doit être un objet.")
    reglement = {**FIBA, **(base or {})}
    erreurs = {}

    for cle, valeur in modifications.items():
        if cle not in FIBA:
            erreurs[cle] = "Réglage inconnu."
        elif cle == 'shot_clock_actif':
            if not isinstance(valeur, bool):
                erreurs[cle] = "Doit valoir vrai ou faux."
        elif cle == 'fautes_equipe_reset':
            if valeur not in RESETS_FAUTES:
                erreurs[cle] = "Choix possibles : periode, mi_temps, match."
        else:
            minimum, maximum = BORNES[cle]
            if isinstance(valeur, bool) or not isinstance(valeur, int) or not minimum <= valeur <= maximum:
                erreurs[cle] = f"Nombre entier entre {minimum} et {maximum}."
        if cle not in erreurs:
            reglement[cle] = valeur

    if not erreurs:
        if reglement['shot_clock_court_secondes'] > reglement['shot_clock_secondes']:
            erreurs['shot_clock_court_secondes'] = "La remise courte ne peut pas dépasser la durée du shot clock."
        if reglement['points_defaite'] > reglement['points_victoire']:
            erreurs['points_defaite'] = "Une défaite ne peut pas rapporter plus qu'une victoire."
    if erreurs:
        raise serializers.ValidationError(erreurs)
    return reglement


# --- Calculs dérivés du règlement -----------------------------------------------------------------

def duree_periode(reglement, periode):
    """Durée en secondes d'une période (les périodes au-delà du temps réglementaire sont des prolongations)."""
    if periode > reglement['nb_periodes']:
        return reglement['duree_prolongation_secondes']
    return reglement['duree_periode_secondes']


def shot_clock_initial(reglement):
    return reglement['shot_clock_secondes'] if reglement['shot_clock_actif'] else 0


def mi_temps(reglement, periode):
    """1 ou 2 pendant le temps réglementaire (une seule « mi-temps » si le match n'a qu'une période)."""
    nb = reglement['nb_periodes']
    return 1 if nb < 2 or periode <= nb // 2 else 2


def segment_fautes(reglement, periode):
    """Portion du match sur laquelle se cumulent les fautes d'équipe. Les prolongations prolongent la dernière période."""
    nb = reglement['nb_periodes']
    periode = min(periode, nb)
    if reglement['fautes_equipe_reset'] == 'periode':
        return periode
    if reglement['fautes_equipe_reset'] == 'mi_temps':
        return mi_temps(reglement, periode)
    return 1


def segment_temps_morts(reglement, periode):
    """Portion du match qui a sa propre dotation de temps morts : chaque mi-temps, puis chaque prolongation."""
    nb = reglement['nb_periodes']
    if periode > nb:
        return 2 + (periode - nb)  # 3 = 1re prolongation, 4 = 2e...
    return mi_temps(reglement, periode)


def dotation_temps_morts(reglement, segment):
    if segment == 1:
        return reglement['temps_morts_premiere_mi_temps']
    if segment == 2:
        return reglement['temps_morts_seconde_mi_temps']
    return reglement['temps_morts_prolongation']
