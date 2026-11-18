"""
Lien d'inscription d'un tournoi : les capitaines proposent leur équipe.

L'organisateur envoie /inscription/<code> (un seul lien pour le tournoi). Le capitaine connecté
propose le nom de son équipe ; l'organisateur accepte (l'équipe est créée) ou refuse.
Une fois acceptée, le capitaine reçoit le lien d'invitation de son équipe pour ses joueurs (voir invitations.py).
"""
import secrets

from django.conf import settings
from django.db import transaction

from .invitations import InvitationRefusee, code_invitation
from .models import DemandeEquipe, Equipe, Tournoi
from .phases_finales import verrouiller_tournoi


def code_inscription(tournoi, regenerer=False, desactiver=False):
    """Code actuel du lien du tournoi ; un nouveau code (ou aucun) rend l'ancien lien inutilisable."""
    if desactiver:
        tournoi.code_inscription = None
    elif regenerer or not tournoi.code_inscription:
        tournoi.code_inscription = secrets.token_urlsafe(16)
    else:
        return tournoi.code_inscription
    tournoi.save(update_fields=['code_inscription', 'updated_at'])
    return tournoi.code_inscription


def demande_du_compte(user, tournoi):
    if not user.is_authenticated:
        return None
    return DemandeEquipe.objects.select_related('equipe').filter(tournoi=tournoi, capitaine=user).first()


def est_active(demande):
    """En attente, ou acceptée et l'équipe existe toujours."""
    return demande.statut == DemandeEquipe.EN_ATTENTE or (
        demande.statut == DemandeEquipe.ACCEPTEE and demande.equipe_id is not None
    )


def _verifier_nom_libre(tournoi, nom, sauf_demande=None):
    if Equipe.objects.filter(tournoi=tournoi, nom__iexact=nom).exists():
        raise InvitationRefusee(f"Une équipe s'appelle déjà « {nom} » dans ce tournoi.")
    autres = DemandeEquipe.objects.filter(tournoi=tournoi, nom__iexact=nom, statut=DemandeEquipe.EN_ATTENTE)
    if sauf_demande is not None:
        autres = autres.exclude(pk=sauf_demande.pk)
    if autres.exists():
        raise InvitationRefusee(f"Une équipe « {nom} » est déjà en attente de validation.")


def _verifier_place(tournoi):
    if tournoi.equipes.count() >= settings.LIMITE_EQUIPES_PAR_TOURNOI:
        raise InvitationRefusee(f"Le tournoi est complet ({settings.LIMITE_EQUIPES_PAR_TOURNOI} équipes maximum).")


@transaction.atomic
def demander(user, tournoi, nom):
    """Le capitaine propose son équipe (ou renomme sa demande en attente, ou retente après un refus)."""
    verrouiller_tournoi(tournoi)
    tournoi = Tournoi.objects.get(pk=tournoi.pk)  # relu après le verrou
    if not (tournoi.inscriptions_actives and tournoi.code_inscription):
        raise InvitationRefusee("Les inscriptions de ce tournoi sont fermées. Contacte l'organisateur.")
    nom = ' '.join(str(nom or '').split())
    if not nom:
        raise InvitationRefusee("Indique le nom de ton équipe.")
    if len(nom) > 200:
        raise InvitationRefusee("Le nom de l'équipe est trop long (200 caractères maximum).")

    demande = demande_du_compte(user, tournoi)
    if demande is not None and demande.statut == DemandeEquipe.ACCEPTEE and demande.equipe_id is not None:
        raise InvitationRefusee("Ton équipe est déjà inscrite dans ce tournoi.")
    _verifier_nom_libre(tournoi, nom, sauf_demande=demande)
    _verifier_place(tournoi)

    if demande is None:
        return DemandeEquipe.objects.create(tournoi=tournoi, capitaine=user, nom=nom)
    demande.nom, demande.statut, demande.equipe = nom, DemandeEquipe.EN_ATTENTE, None
    demande.save(update_fields=['nom', 'statut', 'equipe', 'updated_at'])
    return demande


def _demande_en_attente(demande):
    demande = DemandeEquipe.objects.select_related('tournoi').get(pk=demande.pk)  # relue après le verrou
    if demande.statut != DemandeEquipe.EN_ATTENTE:
        raise InvitationRefusee("Cette demande a déjà été traitée.")
    return demande


@transaction.atomic
def accepter(demande):
    """L'organisateur accepte : l'équipe est créée avec son lien d'invitation pour le capitaine."""
    verrouiller_tournoi(demande.tournoi)
    demande = _demande_en_attente(demande)
    tournoi = demande.tournoi
    if Equipe.objects.filter(tournoi=tournoi, nom__iexact=demande.nom).exists():
        raise InvitationRefusee(f"Une équipe s'appelle déjà « {demande.nom} » : refuse la demande ou renomme l'équipe existante.")
    _verifier_place(tournoi)
    equipe = Equipe.objects.create(nom=demande.nom, tournoi=tournoi)
    code_invitation(equipe)
    demande.statut, demande.equipe = DemandeEquipe.ACCEPTEE, equipe
    demande.save(update_fields=['statut', 'equipe', 'updated_at'])
    return demande


@transaction.atomic
def refuser(demande):
    verrouiller_tournoi(demande.tournoi)
    demande = _demande_en_attente(demande)
    demande.statut = DemandeEquipe.REFUSEE
    demande.save(update_fields=['statut', 'updated_at'])
    return demande
