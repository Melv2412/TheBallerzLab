"""
Historique du match : enregistrement de chaque action et annulation de la dernière.
"""
from django.db.models import F
from django.db.models.functions import Greatest
from rest_framework.exceptions import ValidationError

from . import reglement as regles
from .models import ActionMatch, StatistiqueJoueur

# Actions qu'on peut annuler (un changement de période ne s'annule pas : on règle le chrono)
TYPES_ANNULABLES = ('stat', 'temps_mort')


def libelle_joueur(stat):
    joueur = stat.joueur
    return f"#{joueur.numero_maillot} {joueur.prenom} {joueur.nom}"


def enregistrer(match, type_action, auteur=None, etat=None, **champs):
    """Ajoute une action à l'historique, avec la période et le temps de jeu au moment de l'action."""
    etat = etat or match.etat_chrono()
    stat = champs.pop('statistique', None)
    return ActionMatch.objects.create(
        match=match,
        type=type_action,
        statistique=stat,
        joueur_libelle=libelle_joueur(stat) if stat else '',
        periode=etat['periode_actuelle'],
        temps_restant_secondes=etat['temps_restant_secondes'],
        auteur=auteur if auteur is not None and auteur.is_authenticated else None,
        **champs,
    )


def derniere_action_annulable(match):
    return match.actions.filter(annulee=False, type__in=TYPES_ANNULABLES).order_by('-id').first()


def annuler_derniere_action(match):
    """
    Applique l'inverse de la dernière action (stat, score, fautes d'équipe, temps mort) et la marque annulée.
    Les fautes d'équipe et temps morts ne sont corrigés que s'ils comptent encore (même portion de match).
    """
    action = derniere_action_annulable(match)
    if action is None:
        raise ValidationError({'detail': "Aucune action à annuler."})

    if action.type == 'stat':
        if action.statistique_id is None:
            raise ValidationError({'detail': "Le joueur de cette action n'existe plus : action impossible à annuler."})
        StatistiqueJoueur.objects.filter(pk=action.statistique_id).update(
            **{action.champ: Greatest(F(action.champ) - action.valeur, 0)}
        )
        if action.champ == 'fautes' and regles.segment_fautes(match.reglement, action.periode) == match.fautes_equipe_segment:
            champ = f'fautes_equipe_{action.cote}'
            setattr(match, champ, max(0, getattr(match, champ) - action.valeur))
            match.save(update_fields=[champ])
        match.calculer_scores_depuis_stats()

    elif regles.segment_temps_morts(match.reglement, action.periode) == match.temps_morts_segment:
        # Temps mort de la portion de match en cours : il est rendu à l'équipe
        champ = f'temps_morts_utilises_{action.cote}'
        setattr(match, champ, max(0, getattr(match, champ) - 1))
        match.save(update_fields=[champ])

    action.annulee = True
    action.save(update_fields=['annulee'])
    return action
