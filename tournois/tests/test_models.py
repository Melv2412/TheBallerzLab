from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase

from tournois.models import Tournoi, Equipe, Joueur, Match, StatistiqueJoueur


def creer_tournoi(nom='Interpromo', organisateur=None):
    return Tournoi.objects.create(
        nom=nom, organisateur=organisateur,
        date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
    )


class SlugTournoiTests(TestCase):
    def test_slug_genere_depuis_le_nom(self):
        self.assertEqual(creer_tournoi('Tournoi des Quartiers').slug, 'tournoi-des-quartiers')

    def test_noms_donnant_le_meme_slug_ne_plantent_pas(self):
        t1 = creer_tournoi('Été 2025')
        t2 = creer_tournoi('Ete 2025')
        self.assertEqual(t1.slug, 'ete-2025')
        self.assertEqual(t2.slug, 'ete-2025-2')

    def test_slug_jamais_numerique(self):
        self.assertEqual(creer_tournoi('2025').slug, 'tournoi-2025')

    def test_slug_conserve_apres_renommage(self):
        tournoi = creer_tournoi('Ancien nom')
        tournoi.nom = 'Nouveau nom'
        tournoi.save()
        self.assertEqual(tournoi.slug, 'ancien-nom')


class ScoreMatchTests(TestCase):
    def test_score_calcule_depuis_les_stats(self):
        tournoi = creer_tournoi(organisateur=User.objects.create_user('orga', password='x'))
        dom = Equipe.objects.create(nom='A', tournoi=tournoi)
        ext = Equipe.objects.create(nom='B', tournoi=tournoi)
        match = Match.objects.create(tournoi=tournoi, equipe_domicile=dom, equipe_exterieur=ext)
        j1 = Joueur.objects.create(prenom='a', nom='a', numero_maillot=1, equipe=dom)
        j2 = Joueur.objects.create(prenom='b', nom='b', numero_maillot=2, equipe=ext)

        StatistiqueJoueur.objects.create(joueur=j1, match=match, points=12)
        StatistiqueJoueur.objects.create(joueur=j2, match=match, points=7)

        match.refresh_from_db()
        self.assertEqual((match.score_domicile, match.score_exterieur), (12, 7))
