from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework import status

from tournois.athletes import ConflitAthlete, fusionner
from tournois.models import Athlete, Equipe, Joueur, Tournoi
from tournois.organisateurs import GROUPE_ORGANISATEURS

from .test_api import BaseAPITestCase


class FichesAthletesTests(BaseAPITestCase):
    """Fiche athlète au-dessus des joueurs : création, rattachement par email, un athlète par tournoi."""

    def setUp(self):
        super().setUp()
        groupe, _ = Group.objects.get_or_create(name=GROUPE_ORGANISATEURS)
        groupe.user_set.add(self.orga, self.intrus)
        self.client.force_authenticate(self.orga)

    def creer(self, equipe, numero=10, **donnees):
        donnees = {'prenom': 'LUC', 'nom': 'PETIT', 'numero_maillot': numero, 'equipe': equipe.id, **donnees}
        return self.client.post('/api/joueurs/', donnees, format='json')

    def test_chaque_joueur_a_sa_fiche(self):
        self.assertIsNotNone(self.joueur.athlete_id)  # créé sans fiche : il en reçoit une
        reponse = self.creer(self.dom)
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        fiche = Athlete.objects.get(pk=reponse.data['athlete'])
        self.assertEqual((fiche.prenom, fiche.nom, fiche.email), ('LUC', 'PETIT', None))
        self.assertNotIn('email', reponse.data)

    def test_meme_email_dans_un_autre_tournoi_meme_fiche(self):
        premier = self.creer(self.dom, email='Luc.Petit@Exemple.fr')
        self.client.force_authenticate(self.intrus)
        second = self.creer(self.autre_equipe, email='luc.petit@exemple.fr ')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(premier.data['athlete'], second.data['athlete'])
        self.assertEqual(Athlete.objects.get(pk=second.data['athlete']).email, 'luc.petit@exemple.fr')

    def test_un_athlete_par_tournoi(self):
        self.creer(self.dom, email='luc@exemple.fr')
        reponse = self.creer(self.ext, email='luc@exemple.fr')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('joue déjà dans ce tournoi', str(reponse.data))

    def test_email_ajoute_apres_coup(self):
        url = f'/api/joueurs/{self.joueur.id}/'
        fiche = self.joueur.athlete_id
        reponse = self.client.patch(url, {'email': 'jean@exemple.fr'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['athlete'], fiche)  # la fiche actuelle reçoit l'email
        self.assertEqual(Athlete.objects.get(pk=fiche).email, 'jean@exemple.fr')

    def test_email_d_une_fiche_existante_rattache_et_supprime_l_ancienne(self):
        ailleurs = Joueur.objects.create(prenom='Jean', nom='Dupont', numero_maillot=1, equipe=self.autre_equipe)
        ailleurs.athlete.email = 'jean@exemple.fr'
        ailleurs.athlete.save()
        ancienne = self.joueur.athlete_id
        reponse = self.client.patch(f'/api/joueurs/{self.joueur.id}/', {'email': 'jean@exemple.fr'}, format='json')
        self.assertEqual(reponse.data['athlete'], ailleurs.athlete_id)
        self.assertFalse(Athlete.objects.filter(pk=ancienne).exists())

    def test_correction_du_nom_suivie_par_la_fiche(self):
        self.client.patch(f'/api/joueurs/{self.joueur.id}/', {'prenom': 'JEAN-PAUL'}, format='json')
        self.joueur.refresh_from_db()
        self.assertEqual(self.joueur.athlete.prenom, 'JEAN-PAUL')

    def test_suppression_du_dernier_joueur_supprime_la_fiche(self):
        fiche = self.joueur.athlete_id
        self.tournoi.delete()
        self.assertFalse(Athlete.objects.filter(pk=fiche).exists())

    def test_recherche_par_email_exact(self):
        self.creer(self.dom, email='luc@exemple.fr')
        url = '/api/joueurs/recherche_athlete/'
        reponse = self.client.get(url, {'email': 'LUC@exemple.fr'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual((reponse.data['prenom'], reponse.data['nb_tournois']), ('LUC', 1))
        self.assertNotIn('email', reponse.data)
        self.assertEqual(self.client.get(url, {'email': 'luc@exemple'}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(url, {'email': 'lu@exemple.fr'}).status_code, status.HTTP_404_NOT_FOUND)

    def test_recherche_reservee_aux_organisateurs(self):
        url = '/api/joueurs/recherche_athlete/?email=luc@exemple.fr'
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)
        Group.objects.get(name=GROUPE_ORGANISATEURS).user_set.remove(self.intrus)
        self.client.force_authenticate(self.intrus)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)


class FusionAthletesTests(TestCase):
    def setUp(self):
        self.t1 = Tournoi.objects.create(nom='T1', date_debut='2026-01-01', date_fin='2026-01-02')
        self.t2 = Tournoi.objects.create(nom='T2', date_debut='2026-02-01', date_fin='2026-02-02')
        self.e1 = Equipe.objects.create(nom='A', tournoi=self.t1)
        self.e1b = Equipe.objects.create(nom='B', tournoi=self.t1)
        self.e2 = Equipe.objects.create(nom='A', tournoi=self.t2)

    def joueur(self, equipe, email=None):
        joueur = Joueur.objects.create(prenom='Luc', nom='Petit', numero_maillot=5, equipe=equipe)
        if email:
            joueur.athlete.email = email
            joueur.athlete.save()
        return joueur

    def test_fusion_garde_la_fiche_avec_email(self):
        sans, avec = self.joueur(self.e1), self.joueur(self.e2, 'luc@exemple.fr')
        cible = fusionner(Athlete.objects.all())
        self.assertEqual(cible.pk, avec.athlete_id)
        self.assertEqual(Athlete.objects.count(), 1)
        sans.refresh_from_db()
        self.assertEqual(sans.athlete_id, cible.pk)

    def test_fusion_refusee_si_meme_tournoi_ou_emails_differents(self):
        self.joueur(self.e1)
        self.joueur(self.e1b)
        with self.assertRaisesMessage(ConflitAthlete, 'même tournoi'):
            fusionner(Athlete.objects.all())
        a, b = self.joueur(self.e2, 'a@exemple.fr'), Joueur.objects.filter(equipe=self.e1).first()
        b.athlete.email = 'b@exemple.fr'
        b.athlete.save()
        with self.assertRaisesMessage(ConflitAthlete, 'emails différents'):
            fusionner(Athlete.objects.filter(pk__in=[a.athlete_id, b.athlete_id]))
        self.assertEqual(Athlete.objects.count(), 3)
