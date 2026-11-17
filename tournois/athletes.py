"""Fiches athlètes : rattachement d'un joueur à sa fiche, règle « un athlète par tournoi », fusion des doublons."""
from django.db import transaction
from django.db.models import Count
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Athlete, Joueur


class ConflitAthlete(Exception):
    """La fiche ne peut pas être utilisée (déjà inscrite dans ce tournoi, ou fusion impossible)."""


def normaliser_email(email):
    return email.strip().lower() if email else None


def chercher_par_email(email):
    email = normaliser_email(email)
    return Athlete.objects.filter(email=email).first() if email else None


def verifier_un_par_tournoi(athlete, tournoi_id, sauf_joueur=None):
    """Refuse qu'un athlète ait deux inscriptions dans le même tournoi."""
    if athlete is None or athlete.pk is None:
        return
    autres = Joueur.objects.filter(athlete=athlete, equipe__tournoi_id=tournoi_id).select_related('equipe')
    if sauf_joueur is not None:
        autres = autres.exclude(pk=sauf_joueur.pk)
    deja = autres.first()
    if deja:
        raise ConflitAthlete(
            f"{athlete.prenom} {athlete.nom} joue déjà dans ce tournoi (équipe {deja.equipe.nom})."
        )


def supprimer_si_orpheline(athlete_id):
    """Une fiche sans aucune inscription ne sert plus à rien (sauf si un compte y est relié : c'est son profil)."""
    Athlete.objects.filter(pk=athlete_id, joueurs__isnull=True, utilisateur__isnull=True).delete()


def fiche_pour_email(joueur, email):
    """
    Fiche à utiliser pour `joueur` (déjà enregistré ou non) quand l'organisateur donne `email` :
    la fiche existante qui a cet email, sinon la fiche actuelle si elle n'en a pas encore,
    sinon une nouvelle fiche.
    """
    trouvee = chercher_par_email(email)
    if trouvee:
        return trouvee
    actuelle = joueur.athlete if joueur.athlete_id else None
    if actuelle and not actuelle.email:
        actuelle.email = normaliser_email(email)
        return actuelle
    return Athlete(prenom=joueur.prenom, nom=joueur.nom, email=normaliser_email(email))


@transaction.atomic
def fusionner(athletes):
    """
    Regroupe les fiches en une seule (celle reliée à un compte, sinon celle qui a un email, sinon la plus ancienne).
    Refusé si deux comptes ou deux emails différents, ou si deux fiches ont joué le même tournoi.
    """
    athletes = list(athletes)
    if len(athletes) < 2:
        raise ConflitAthlete("Sélectionne au moins deux fiches à fusionner.")
    emails = {a.email for a in athletes if a.email}
    if len({a.utilisateur_id for a in athletes if a.utilisateur_id}) > 1:
        raise ConflitAthlete("Ces fiches sont reliées à deux comptes différents : ce sont deux personnes.")
    if len(emails) > 1:
        raise ConflitAthlete("Ces fiches ont des emails différents : ce ne sont sans doute pas la même personne.")
    doublons = (
        Joueur.objects.filter(athlete__in=athletes)
        .values('equipe__tournoi__nom')
        .annotate(n=Count('id'))
        .filter(n__gt=1)
    )
    if doublons:
        noms = ", ".join(d['equipe__tournoi__nom'] for d in doublons)
        raise ConflitAthlete(f"Ces fiches ont joué le même tournoi ({noms}) : ce sont deux personnes différentes.")

    # La fiche reliée à un compte est gardée en priorité (sinon le compte perdrait son profil)
    cible = min(athletes, key=lambda a: (a.utilisateur_id is None, a.email is None, a.created_at, a.pk))
    autres = [a for a in athletes if a.pk != cible.pk]
    Joueur.objects.filter(athlete__in=autres).update(athlete=cible)
    Athlete.objects.filter(pk__in=[a.pk for a in autres]).delete()
    if emails and not cible.email:  # l'email d'une fiche absorbée n'est pas perdu
        cible.email = emails.pop()
        cible.save(update_fields=['email', 'updated_at'])
    return cible


@receiver(post_delete, sender=Joueur)
def nettoyer_fiche(sender, instance, **kwargs):
    supprimer_si_orpheline(instance.athlete_id)
