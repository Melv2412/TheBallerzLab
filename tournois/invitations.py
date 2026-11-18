"""
Lien d'invitation d'équipe : chaque joueur rejoint son équipe avec son compte.

L'organisateur envoie /invitation/<code> au capitaine. Le joueur connecté :
- soit réclame un joueur déjà saisi par l'organisateur (« C'est toi ? #7 Paul Martin ») ;
- soit s'inscrit avec son numéro (si les inscriptions du tournoi sont ouvertes).
Dans les deux cas, sa fiche athlète est reliée à son compte : une seule fiche par personne.
"""
import secrets

from django.conf import settings
from django.db import transaction

from .athletes import ConflitAthlete, supprimer_si_orpheline, verifier_un_par_tournoi
from .models import Athlete, Equipe, Joueur
from .phases_finales import verrouiller_tournoi


class InvitationRefusee(Exception):
    """Le joueur ne peut pas rejoindre l'équipe (message affiché tel quel)."""


def code_invitation(equipe, regenerer=False):
    """Code actuel de l'équipe ; un nouveau code rend l'ancien lien inutilisable."""
    if regenerer or not equipe.code_invitation:
        equipe.code_invitation = secrets.token_urlsafe(16)
        equipe.save(update_fields=['code_invitation', 'updated_at'])
    return equipe.code_invitation


def fiche_du_compte(user):
    return Athlete.objects.filter(utilisateur=user).first() if user.is_authenticated else None


def inscription_dans_le_tournoi(user, tournoi_id):
    """Le joueur du compte dans ce tournoi, s'il y est déjà."""
    if not user.is_authenticated:
        return None
    return (
        Joueur.objects.filter(athlete__utilisateur=user, equipe__tournoi_id=tournoi_id, retire=False)
        .select_related('equipe').first()
    )


def _verifier_pas_deja_inscrit(fiche, equipe):
    try:
        verifier_un_par_tournoi(fiche, equipe.tournoi_id, equipe_id=equipe.pk)
    except ConflitAthlete as erreur:
        raise InvitationRefusee(str(erreur).replace(f"{fiche.prenom} {fiche.nom} joue", "Tu joues")) from erreur


@transaction.atomic
def reclamer(user, equipe, joueur_id):
    """« C'est moi » : relie le joueur saisi par l'organisateur au compte (même inscriptions fermées)."""
    verrouiller_tournoi(equipe.tournoi)
    joueur = Joueur.objects.select_related('athlete').filter(pk=joueur_id, equipe=equipe, retire=False).first()
    if joueur is None:
        raise InvitationRefusee("Ce joueur ne fait pas partie de l'équipe.")
    fiche_joueur = joueur.athlete
    if fiche_joueur.utilisateur_id == user.id:
        return joueur
    if fiche_joueur.utilisateur_id is not None:
        raise InvitationRefusee("Ce joueur est déjà relié à un autre compte. Demande à l'organisateur.")

    fiche = fiche_du_compte(user)
    if fiche is None:  # premier lien du compte : la fiche du joueur devient la sienne
        fiche_joueur.utilisateur = user
        fiche_joueur.save(update_fields=['utilisateur', 'updated_at'])
        return joueur
    _verifier_pas_deja_inscrit(fiche, equipe)
    joueur.athlete = fiche  # le compte a déjà sa fiche : le joueur la rejoint
    joueur.save(update_fields=['athlete', 'updated_at'])
    supprimer_si_orpheline(fiche_joueur.pk)
    return joueur


@transaction.atomic
def s_inscrire(user, equipe, numero_maillot, prenom='', nom=''):
    """Nouveau joueur dans l'équipe, au nom de la fiche du compte (ou du prénom/nom donnés pour la première fois)."""
    verrouiller_tournoi(equipe.tournoi)
    equipe = Equipe.objects.select_related('tournoi').get(pk=equipe.pk)  # relu après le verrou
    if not equipe.tournoi.inscriptions_ouvertes:
        raise InvitationRefusee("Les inscriptions de ce tournoi sont fermées. Demande à l'organisateur.")
    fiche = fiche_du_compte(user)
    if fiche is not None:
        _verifier_pas_deja_inscrit(fiche, equipe)
    elif not (prenom.strip() and nom.strip()):
        raise InvitationRefusee("Indique ton prénom et ton nom.")
    effectif = equipe.joueurs.filter(retire=False)
    if effectif.count() >= settings.LIMITE_JOUEURS_PAR_EQUIPE:
        raise InvitationRefusee(f"L'équipe est complète ({settings.LIMITE_JOUEURS_PAR_EQUIPE} joueurs maximum).")
    if effectif.filter(numero_maillot=numero_maillot).exists():
        raise InvitationRefusee(f"Le numéro {numero_maillot} est déjà pris dans l'équipe.")

    if fiche is None:
        fiche = Athlete.objects.create(prenom=prenom.strip()[:100], nom=nom.strip()[:100], utilisateur=user)
    return Joueur.objects.create(
        athlete=fiche, prenom=fiche.prenom, nom=fiche.nom, numero_maillot=numero_maillot, equipe=equipe,
    )


@transaction.atomic
def delier(joueur):
    """L'organisateur détache ce joueur du compte (mauvaise personne) ; ses autres tournois restent au compte."""
    fiche = Athlete.objects.select_for_update().get(pk=joueur.athlete_id)
    if fiche.utilisateur_id is None:
        raise InvitationRefusee("Ce joueur n'est relié à aucun compte.")
    if fiche.joueurs.count() == 1:
        fiche.utilisateur = None
        fiche.save(update_fields=['utilisateur', 'updated_at'])
    else:
        joueur.athlete = Athlete.objects.create(prenom=joueur.prenom, nom=joueur.nom)
        joueur.save(update_fields=['athlete', 'updated_at'])
    return joueur
