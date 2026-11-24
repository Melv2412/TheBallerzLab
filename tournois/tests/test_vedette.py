from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.models import Athlete, Equipe, Joueur, Match, Tournoi

MOT_DE_PASSE = 'motdepasse-solide-42'
URL = '/api/tournois/vedette/'


class TournoiVedetteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password=MOT_DE_PASSE)
        self.joueur_compte = User.objects.create_user('joueur', password=MOT_DE_PASSE)
        self.inconnu = User.objects.create_user('inconnu', password=MOT_DE_PASSE)
        aujourd_hui = timezone.localdate()
        self.en_cours = self.tournoi('En cours', aujourd_hui - timedelta(days=2), aujourd_hui + timedelta(days=5))
        self.a = Equipe.objects.create(nom='A', tournoi=self.en_cours)
        self.b = Equipe.objects.create(nom='B', tournoi=self.en_cours)
        athlete = Athlete.objects.create(prenom='Jean', nom='Dupont', utilisateur=self.joueur_compte)
        Joueur.objects.create(prenom='Jean', nom='Dupont', numero_maillot=4, equipe=self.a, athlete=athlete)
        # Jamais en vedette : à venir, fini, clôturé, privé (pour un visiteur)
        self.tournoi('À venir', aujourd_hui + timedelta(days=3), aujourd_hui + timedelta(days=9))
        self.tournoi('Fini', aujourd_hui - timedelta(days=9), aujourd_hui - timedelta(days=1))
        self.tournoi('Clôturé', aujourd_hui - timedelta(days=2), aujourd_hui + timedelta(days=5), cloture_le=timezone.now())
        self.prive = self.tournoi('Privé', aujourd_hui - timedelta(days=2), aujourd_hui + timedelta(days=5), prive=True)

    def tournoi(self, nom, debut, fin, **champs):
        return Tournoi.objects.create(nom=nom, organisateur=self.orga, date_debut=debut, date_fin=fin, **champs)

    def match(self, statut, score_dom=0, score_ext=0, **champs):
        return Match.objects.create(
            tournoi=self.en_cours, equipe_domicile=self.a, equipe_exterieur=self.b,
            statut=statut, score_domicile=score_dom, score_exterieur=score_ext, **champs,
        )

    def vedette(self, compte=None, **params):
        self.client.force_authenticate(compte)
        reponse = self.client.get(URL, params)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        return reponse.data

    def test_visiteur_voit_un_tournoi_public_en_cours(self):
        donnees = self.vedette()
        self.assertEqual(donnees['tournoi']['slug'], self.en_cours.slug)
        self.assertEqual(donnees['tournoi']['equipes_count'], 2)
        self.assertEqual(donnees['tournoi']['joueurs_count'], 1)
        self.assertIsNone(donnees['match'])

    def test_compte_connecte_voit_seulement_ses_tournois(self):
        self.assertEqual(self.vedette(self.joueur_compte)['tournoi']['slug'], self.en_cours.slug)
        self.assertIsNone(self.vedette(self.inconnu)['tournoi'])
        # L'organisateur voit aussi son tournoi privé en cours
        slugs = {self.vedette(self.orga)['tournoi']['slug'] for _ in range(20)}
        self.assertLessEqual(slugs, {self.en_cours.slug, self.prive.slug})

    def test_garder_le_meme_tournoi_pendant_la_visite(self):
        donnees = self.vedette(self.orga, garder=self.prive.slug)
        self.assertEqual(donnees['tournoi']['slug'], self.prive.slug)
        # Un tournoi qui n'est plus en vedette (ici : fini) est remplacé par un autre
        self.assertIn(self.vedette(garder='fini')['tournoi']['slug'], {self.en_cours.slug})

    def test_match_en_direct_puis_dernier_match_joue(self):
        self.match('termine', 60, 50, date_match=timezone.now() - timedelta(days=2))
        dernier = self.match('termine', 70, 72, date_match=timezone.now() - timedelta(days=1))
        self.assertEqual(self.vedette()['match']['id'], dernier.id)
        direct = self.match('en_cours', 12, 10)
        match = self.vedette()['match']
        self.assertEqual(match['id'], direct.id)
        self.assertEqual(match['equipe_domicile']['nom'], 'A')
        self.assertEqual((match['score_domicile'], match['score_exterieur']), (12, 10))


class CarteTournoiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password=MOT_DE_PASSE)
        aujourd_hui = timezone.localdate()
        self.tournoi = Tournoi.objects.create(
            nom='Coupe', organisateur=self.orga, date_debut=aujourd_hui, date_fin=aujourd_hui + timedelta(days=9),
        )
        self.url = f'/api/tournois/{self.tournoi.slug}/'
        self.client.force_authenticate(self.orga)

    def test_couleur_de_la_palette_seulement(self):
        reponse = self.client.patch(self.url, {'carte_couleur': '#1d4ed8'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['carte_couleur'], '#1d4ed8')
        reponse = self.client.patch(self.url, {'carte_couleur': '#123456'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        reponse = self.client.patch(self.url, {'carte_couleur': ''}, format='json')
        self.assertEqual(reponse.data['carte_couleur'], '')

    def test_champion_d_un_tournoi_cloture(self):
        a = Equipe.objects.create(nom='A', tournoi=self.tournoi)
        b = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        Match.objects.create(
            tournoi=self.tournoi, phase='finale', equipe_domicile=a, equipe_exterieur=b,
            statut='termine', score_domicile=50, score_exterieur=61,
        )
        self.assertIsNone(self.client.get(self.url).data['champion'])
        Tournoi.objects.filter(pk=self.tournoi.pk).update(cloture_le=timezone.now())
        self.assertEqual(self.client.get(self.url).data['champion']['nom'], 'B')
