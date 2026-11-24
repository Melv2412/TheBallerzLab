"""
Effacement des images du stockage (logos, photos, cartes des tournois).

Une image à effacer est d'abord notée dans FichierASupprimer, dans la même transaction que la suppression
en base : si celle-ci est annulée, rien n'est effacé, et si le stockage ne répond pas, rien n'est oublié.
Les fichiers partent ensuite par lots, juste après la réponse (temps limité : Vercel coupe à 30 s) ;
la tâche quotidienne rattrape le reste. Un fichier encore utilisé par une fiche n'est jamais effacé.
"""
import logging
import threading
import time
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db import DatabaseError
from django.db.models import F
from django.db.models.signals import post_delete, pre_delete, pre_save
from django.utils import timezone

from .models import Athlete, Equipe, FichierASupprimer, Joueur, Tournoi

try:
    from botocore.exceptions import BotoCoreError, ClientError
    ERREURS_STOCKAGE = (OSError, BotoCoreError, ClientError)
except ImportError:
    ERREURS_STOCKAGE = (OSError,)

logger = logging.getLogger(__name__)

CHAMPS_IMAGES = {Equipe: 'logo', Joueur: 'photo', Athlete: 'photo', Tournoi: 'carte_image'}
DOSSIERS = ('equipes/logos', 'joueurs/photos', 'athletes/photos', 'tournois/cartes')
TAILLE_LOT = 50
TEMPS_APRES_REQUETE = 8  # secondes accordées à l'effacement après une requête
DUREE_MAX_REQUETE = 20  # au-delà, on laisse la suite à la tâche quotidienne
DELAI_ORPHELINES = timedelta(days=1)  # laisse le temps à un envoi en cours d'être enregistré

_etat = threading.local()


def noter(noms, delai=None):
    """Note des fichiers à effacer ; sans délai, ils partiront à la fin de la requête."""
    noms = {nom for nom in noms if nom}
    if not noms:
        return
    pas_avant = timezone.now() + (delai or timedelta())
    FichierASupprimer.objects.bulk_create(
        [FichierASupprimer(nom=nom, pas_avant=pas_avant) for nom in noms], ignore_conflicts=True,
    )
    if delai is None:
        _etat.a_traiter = True


def noms_references(noms):
    """Parmi ces fichiers, ceux qu'une équipe, un joueur ou une fiche utilise encore."""
    utilises = set()
    for modele, champ in CHAMPS_IMAGES.items():
        utilises.update(modele.objects.filter(**{f'{champ}__in': noms}).values_list(champ, flat=True))
    return utilises


def traiter_file(limite_secondes):
    """Efface les fichiers notés, par lots, sans dépasser le temps donné. Un échec sera retenté plus tard."""
    fin = time.monotonic() + limite_secondes
    bilan = {'effaces': 0, 'echecs': 0}
    vus = set()
    while time.monotonic() < fin:
        lot = list(
            FichierASupprimer.objects.filter(pas_avant__lte=timezone.now()).exclude(pk__in=vus)
            .order_by('tentatives', 'pk')[:TAILLE_LOT]
        )
        if not lot:
            break
        vus.update(fichier.pk for fichier in lot)
        utilises = noms_references([fichier.nom for fichier in lot])
        termines, echecs = [], []
        for fichier in lot:
            if time.monotonic() >= fin:
                break
            if fichier.nom in utilises:
                termines.append(fichier.pk)
                continue
            try:
                default_storage.delete(fichier.nom)
            except ERREURS_STOCKAGE:
                logger.warning("Fichier %s non supprimé du stockage", fichier.nom)
                echecs.append(fichier.pk)
            else:
                termines.append(fichier.pk)
                bilan['effaces'] += 1
        FichierASupprimer.objects.filter(pk__in=termines).delete()
        FichierASupprimer.objects.filter(pk__in=echecs).update(tentatives=F('tentatives') + 1)
        bilan['echecs'] += len(echecs)
    return bilan


def reperer_orphelines(limite_secondes):
    """Note les fichiers du stockage qu'aucune fiche n'utilise ; ils seront effacés au passage suivant."""
    fin = time.monotonic() + limite_secondes
    trouvees = 0
    for dossier in DOSSIERS:
        try:
            _, fichiers = default_storage.listdir(dossier)
        except FileNotFoundError:
            continue
        # Les noms en « . » sont des marqueurs de dossier du stockage, pas des images
        noms = [f'{dossier}/{fichier}' for fichier in fichiers if not fichier.startswith('.')]
        for debut in range(0, len(noms), TAILLE_LOT):
            if time.monotonic() >= fin:
                return trouvees
            tranche = noms[debut:debut + TAILLE_LOT]
            utilises = noms_references(tranche)
            orphelines = [nom for nom in tranche if nom not in utilises]
            noter(orphelines, delai=DELAI_ORPHELINES)
            trouvees += len(orphelines)
    return trouvees


class NettoyageImagesMiddleware:
    """Efface les images notées pendant la requête, une fois celle-ci terminée (donc la base à jour)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _etat.a_traiter = False
        debut = time.monotonic()
        response = self.get_response(request)
        if _etat.a_traiter:
            _etat.a_traiter = False
            restant = min(TEMPS_APRES_REQUETE, DUREE_MAX_REQUETE - (time.monotonic() - debut))
            if restant > 0:
                try:
                    traiter_file(restant)
                except (DatabaseError, *ERREURS_STOCKAGE):
                    logger.exception("Effacement des images reporté à la tâche quotidienne")
        return response


def _nom(instance, champ):
    fichier = getattr(instance, champ)
    return fichier.name if fichier else ''


def image_supprimee(sender, instance, **kwargs):
    noter([_nom(instance, CHAMPS_IMAGES[sender])])


def image_remplacee(sender, instance, raw=False, update_fields=None, **kwargs):
    champ = CHAMPS_IMAGES[sender]
    if raw or instance._state.adding or (update_fields is not None and champ not in update_fields):
        return
    ancienne = sender.objects.filter(pk=instance.pk).values_list(champ, flat=True).first()
    if ancienne and ancienne != _nom(instance, champ):
        noter([ancienne])


def photo_du_compte(sender, instance, **kwargs):
    """Compte supprimé : sa photo de profil part, la fiche et ses stats restent pour les tournois joués."""
    fiches = Athlete.objects.filter(utilisateur=instance).exclude(photo='').exclude(photo__isnull=True)
    noter(fiches.values_list('photo', flat=True))
    fiches.update(photo=None)


for modele_image in CHAMPS_IMAGES:
    post_delete.connect(image_supprimee, sender=modele_image, dispatch_uid=f'image_supprimee_{modele_image.__name__}')
    pre_save.connect(image_remplacee, sender=modele_image, dispatch_uid=f'image_remplacee_{modele_image.__name__}')
pre_delete.connect(photo_du_compte, sender=User, dispatch_uid='photo_du_compte')
