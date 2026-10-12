from datetime import date, timedelta

from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.models import Tournoi, Equipe, Joueur
from tournois.organisateurs import GROUPE_ORGANISATEURS


def donnees_tournoi(nom='Nouveau', fin=None):
    fin = fin or date.today() + timedelta(days=7)
    return {'nom': nom, 'date_debut': (fin - timedelta(days=1)).isoformat(), 'date_fin': fin.isoformat()}


class ValidationOrganisateurTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.groupe = Group.objects.get(name=GROUPE_ORGANISATEURS)  # créé par la migration 0010
        self.nouveau = User.objects.create_user('nouveau', password='motdepasse-solide-42')
        self.valide = User.objects.create_user('valide', password='motdepasse-solide-42')
        self.valide.groups.add(self.groupe)
        self.staff = User.objects.create_user('patron', password='motdepasse-solide-42', is_staff=True)

    def test_compte_non_valide_ne_peut_pas_creer_de_tournoi(self):
        self.client.force_authenticate(self.nouveau)
        reponse = self.client.post('/api/tournois/', donnees_tournoi())
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('attente de validation', str(reponse.data['detail']))
        self.assertFalse(Tournoi.objects.exists())

    def test_organisateur_valide_peut_creer_un_tournoi(self):
        self.client.force_authenticate(self.valide)
        reponse = self.client.post('/api/tournois/', donnees_tournoi())
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Tournoi.objects.get().organisateur, self.valide)

    def test_staff_cree_sans_validation(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post('/api/tournois/', donnees_tournoi()).status_code, status.HTTP_201_CREATED)

    def test_profil_me(self):
        self.client.force_authenticate(self.nouveau)
        reponse = self.client.get('/api/users/me/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertFalse(reponse.data['organisateur_valide'])
        self.assertEqual(reponse.data['limite_tournois_actifs'], 3)

        self.client.force_authenticate(self.valide)
        self.assertTrue(self.client.get('/api/users/me/').data['organisateur_valide'])

    def test_profil_me_exige_une_connexion(self):
        self.assertEqual(self.client.get('/api/users/me/').status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(LIMITE_TOURNOIS_ACTIFS=2)
class LimiteTournoisActifsTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password='motdepasse-solide-42')
        self.orga.groups.add(Group.objects.get(name=GROUPE_ORGANISATEURS))
        self.client.force_authenticate(self.orga)

    def test_limite_de_tournois_en_cours_ou_a_venir(self):
        for i in range(2):
            self.assertEqual(self.client.post('/api/tournois/', donnees_tournoi(f'T{i}')).status_code, status.HTTP_201_CREATED)
        reponse = self.client.post('/api/tournois/', donnees_tournoi('T3'))
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2 tournois', str(reponse.data['detail']))

    def test_un_tournoi_termine_libere_sa_place(self):
        hier = date.today() - timedelta(days=1)
        Tournoi.objects.create(nom='Fini', organisateur=self.orga, date_debut=hier, date_fin=hier)
        Tournoi.objects.create(nom='Actif', organisateur=self.orga, date_debut=date.today(), date_fin=date.today())
        self.assertEqual(self.client.post('/api/tournois/', donnees_tournoi()).status_code, status.HTTP_201_CREATED)

    def test_le_staff_n_est_pas_limite(self):
        self.orga.is_staff = True
        self.orga.save()
        for i in range(3):
            self.assertEqual(self.client.post('/api/tournois/', donnees_tournoi(f'T{i}')).status_code, status.HTTP_201_CREATED)


@override_settings(LIMITE_EQUIPES_PAR_TOURNOI=2, LIMITE_JOUEURS_PAR_EQUIPE=2)
class PlafondsEquipesJoueursTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password='motdepasse-solide-42')
        self.client.force_authenticate(self.orga)
        self.tournoi = Tournoi.objects.create(nom='T', organisateur=self.orga, date_debut=date.today(), date_fin=date.today())
        self.autre = Tournoi.objects.create(nom='T2', organisateur=self.orga, date_debut=date.today(), date_fin=date.today())

    def test_plafond_d_equipes(self):
        for nom in ('A', 'B'):
            self.assertEqual(self.client.post('/api/equipes/', {'nom': nom, 'tournoi': self.tournoi.id}).status_code, status.HTTP_201_CREATED)
        reponse = self.client.post('/api/equipes/', {'nom': 'C', 'tournoi': self.tournoi.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2 équipes', str(reponse.data['tournoi']))

    def test_deplacer_une_equipe_vers_un_tournoi_plein_est_refuse(self):
        Equipe.objects.create(nom='A', tournoi=self.tournoi)
        Equipe.objects.create(nom='B', tournoi=self.tournoi)
        equipe = Equipe.objects.create(nom='X', tournoi=self.autre)
        reponse = self.client.patch(f'/api/equipes/{equipe.id}/', {'tournoi': self.tournoi.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_modifier_une_equipe_d_un_tournoi_plein_reste_possible(self):
        Equipe.objects.create(nom='A', tournoi=self.tournoi)
        equipe = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        reponse = self.client.patch(f'/api/equipes/{equipe.id}/', {'nom': 'B2', 'tournoi': self.tournoi.id})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_plafond_de_joueurs(self):
        equipe = Equipe.objects.create(nom='A', tournoi=self.tournoi)
        for n in (1, 2):
            Joueur.objects.create(prenom='J', nom=str(n), numero_maillot=n, equipe=equipe)
        reponse = self.client.post('/api/joueurs/', {'prenom': 'J', 'nom': '3', 'numero_maillot': 3, 'equipe': equipe.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2 joueurs', str(reponse.data['equipe']))


class MigrationGroupeTests(APITestCase):
    def test_le_groupe_existe(self):
        self.assertTrue(Group.objects.filter(name=GROUPE_ORGANISATEURS).exists())
