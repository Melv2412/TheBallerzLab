"""
Suppression d'un tournoi.

Sans match commencé, il est effacé tout de suite. Sinon il passe 30 jours dans la corbeille : invisible
partout, restaurable par son organisateur, puis effacé pour de bon (avec ses images) par la tâche quotidienne.
Son nom reste pris pendant ce temps, pour que la restauration ne puisse pas créer de doublon.
"""
import logging
import math
import time
from datetime import timedelta

from django.db import DatabaseError, transaction
from django.utils import timezone

from . import images
from .models import Joueur, Tournoi
from .phases_finales import verrouiller_tournoi

logger = logging.getLogger(__name__)

DUREE_CORBEILLE = timedelta(days=30)
# Tâche quotidienne : secondes écoulées à ne pas dépasser à la fin de chaque étape (Vercel coupe à 30 s)
FIN_PURGE, FIN_FILE, FIN_ORPHELINES = 8, 16, 22


def _normaliser(texte):
    return ' '.join(str(texte or '').split()).casefold()


def nom_confirme(saisie, nom):
    """Le nom retapé correspond-il ? (majuscules et espaces en trop ne comptent pas)"""
    return bool(_normaliser(saisie)) and _normaliser(saisie) == _normaliser(nom)


def a_des_resultats(tournoi):
    return tournoi.matchs.filter(statut__in=['en_cours', 'termine']).exists()


def apercu(tournoi):
    """Ce que la suppression fera perdre."""
    joueurs = Joueur.objects.filter(equipe__tournoi=tournoi)
    return {
        'equipes': tournoi.equipes.count(),
        'joueurs': joueurs.count(),
        'matchs': tournoi.matchs.count(),
        'matchs_termines': tournoi.matchs.filter(statut='termine').count(),
        'images': tournoi.equipes.filter(logo__gt='').count() + joueurs.filter(photo__gt='').count(),
        'corbeille': a_des_resultats(tournoi),
        'jours': DUREE_CORBEILLE.days,
    }


def element_corbeille(tournoi):
    fin = tournoi.supprime_le + DUREE_CORBEILLE
    return {
        'nom': tournoi.nom,
        'slug': tournoi.slug,
        'supprime_le': tournoi.supprime_le,
        'efface_le': fin,
        'jours_restants': max(math.ceil((fin - timezone.now()) / timedelta(days=1)), 0),
        'apercu': apercu(tournoi),
    }


@transaction.atomic
def supprimer(tournoi):
    """Renvoie 'corbeille' si le tournoi y est placé, 'supprime' s'il est effacé."""
    verrouiller_tournoi(tournoi)
    if a_des_resultats(tournoi):
        Tournoi.objects.filter(pk=tournoi.pk).update(supprime_le=timezone.now())
        return 'corbeille'
    tournoi.delete()
    return 'supprime'


def restaurer(tournoi):
    Tournoi.objects.filter(pk=tournoi.pk).update(supprime_le=None)
    tournoi.supprime_le = None


def purger_expires(limite_secondes):
    """Efface pour de bon les tournois restés 30 jours dans la corbeille."""
    fin = time.monotonic() + limite_secondes
    limite = timezone.now() - DUREE_CORBEILLE
    purges = 0
    for pk in list(Tournoi.objects.filter(supprime_le__lte=limite).order_by('supprime_le').values_list('pk', flat=True)):
        if time.monotonic() >= fin:
            break
        try:
            with transaction.atomic():
                # Relu sous verrou : il vient peut-être d'être restauré
                tournoi = Tournoi.objects.select_for_update().filter(pk=pk, supprime_le__lte=limite).first()
                if tournoi is not None:
                    tournoi.delete()
                    purges += 1
        except DatabaseError:
            logger.exception("Tournoi %s non purgé de la corbeille", pk)
    return purges


def taches_quotidiennes():
    """Purge la corbeille, efface les images en attente puis repère celles que plus rien n'utilise."""
    debut = time.monotonic()
    bilan = {'erreurs': []}
    etapes = [
        ('tournois_purges', FIN_PURGE, purger_expires),
        ('images', FIN_FILE, images.traiter_file),
        ('orphelines', FIN_ORPHELINES, images.reperer_orphelines),
    ]
    for nom, fin_etape, tache in etapes:
        try:
            bilan[nom] = tache(max(fin_etape - (time.monotonic() - debut), 0))
        except (DatabaseError, *images.ERREURS_STOCKAGE):
            logger.exception("Tâche quotidienne : échec de l'étape %s", nom)
            bilan['erreurs'].append(nom)
    return bilan
