import base64
import shutil
import tempfile

from django.contrib.auth.models import Group, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status

from tournois.models import Athlete, Match
from tournois.organisateurs import EN_ATTENTE, GROUPE_DEMANDES, GROUPE_ORGANISATEURS, JOUEUR, ORGANISATEUR

from .test_api import BaseAPITestCase

GIF = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')


def image(nom='photo.gif'):
    return SimpleUploadedFile(nom, GIF, content_type='image/gif')


class TypesDeCompteTests(BaseAPITestCase):
    def inscrire(self, **extra):
        donnees = {'username': 'nouveau', 'email': 'nouveau@exemple.fr', 'password': 'motdepasse-solide-42', **extra}
        self.assertEqual(self.client.post('/api/users/', donnees).status_code, status.HTTP_201_CREATED)
        return User.objects.get(username='nouveau')

    def type_compte(self, user):
        self.client.force_authenticate(user)
        return self.client.get('/api/users/me/').data['type_compte']

    def test_inscription_organisateur_en_attente(self):
        user = self.inscrire(type='orga')
        self.assertTrue(user.groups.filter(name=GROUPE_DEMANDES).exists())
        self.assertEqual(self.type_compte(user), EN_ATTENTE)

    def test_inscription_joueur_par_defaut(self):
        user = self.inscrire()
        self.assertFalse(user.groups.exists())
        self.assertEqual(self.type_compte(user), JOUEUR)

    def test_type_invalide_refuse(self):
        reponse = self.client.post('/api/users/', {
            'username': 'x', 'email': 'x@exemple.fr', 'password': 'motdepasse-solide-42', 'type': 'admin',
        })
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('type', reponse.data)

    def test_un_joueur_demande_a_devenir_organisateur(self):
        user = self.inscrire()
        self.client.force_authenticate(user)
        reponse = self.client.post('/api/users/devenir_organisateur/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['type_compte'], EN_ATTENTE)

    def test_organisateur_valide_reste_organisateur(self):
        self.orga.groups.add(Group.objects.get(name=GROUPE_ORGANISATEURS))
        self.client.force_authenticate(self.orga)
        self.assertEqual(self.client.post('/api/users/devenir_organisateur/').data['type_compte'], ORGANISATEUR)
        self.assertFalse(self.orga.groups.filter(name=GROUPE_DEMANDES).exists())

    def test_devenir_organisateur_exige_une_connexion(self):
        self.assertEqual(self.client.post('/api/users/devenir_organisateur/').status_code, status.HTTP_401_UNAUTHORIZED)


# Les pages de l'admin chargent leurs CSS : sans « collectstatic », stockage statique simple
STATIQUE_SIMPLE = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


@override_settings(STORAGES=STATIQUE_SIMPLE)
class AdminTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.patron = User.objects.create_superuser('patron', 'patron@exemple.fr', 'motdepasse-solide-42')
        self.client.force_login(self.patron)
        self.attente = User.objects.create_user('attente', password='motdepasse-solide-42')
        Group.objects.get_or_create(name=GROUPE_DEMANDES)[0].user_set.add(self.attente)

    def test_tableau_de_bord(self):
        reponse = self.client.get('/admin/')
        self.assertEqual(reponse.status_code, 200)
        self.assertContains(reponse, 'Organisateurs en attente')
        self.assertContains(reponse, '?attente=oui')

    def test_filtre_en_attente(self):
        reponse = self.client.get('/admin/auth/user/', {'attente': 'oui'})
        self.assertEqual(list(reponse.context['cl'].queryset), [self.attente])

    def test_validation_retire_la_demande(self):
        self.client.post('/admin/auth/user/', {
            'action': 'valider_organisateurs', '_selected_action': [self.attente.pk],
        })
        self.assertEqual(set(self.attente.groups.values_list('name', flat=True)), {GROUPE_ORGANISATEURS})

    def test_reglement_lisible(self):
        reponse = self.client.get(f'/admin/tournois/tournoi/{self.tournoi.pk}/change/')
        self.assertContains(reponse, 'FIBA')
        self.assertContains(reponse, '10 min')

    def test_rouvrir_un_match(self):
        Match.objects.filter(pk=self.match.pk).update(statut='termine')
        self.client.post('/admin/tournois/match/', {'action': 'rouvrir', '_selected_action': [self.match.pk]})
        self.match.refresh_from_db()
        self.assertEqual(self.match.statut, 'en_cours')


class MigrationTypesTests(TestCase):
    def test_groupe_demandes_cree(self):
        self.assertTrue(Group.objects.filter(name=GROUPE_DEMANDES).exists())


class PhotoAthleteTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.media = tempfile.mkdtemp()
        reglage = override_settings(MEDIA_ROOT=self.media)
        reglage.enable()
        self.addCleanup(reglage.disable)
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        self.compte = User.objects.create_user('jean', password='motdepasse-solide-42')
        self.fiche = Athlete.objects.create(prenom='Jean', nom='Dupont', utilisateur=self.compte)
        self.url = f'/api/athletes/{self.fiche.pk}/photo/'

    def test_le_joueur_relie_ajoute_sa_photo(self):
        self.client.force_authenticate(self.compte)
        reponse = self.client.post(self.url, {'photo': image()}, format='multipart')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertIn('athletes/photos/', reponse.data['photo'])
        self.assertTrue(reponse.data['photo_perso'])

    def test_remplacer_efface_l_ancienne(self):
        self.client.force_authenticate(self.compte)
        self.client.post(self.url, {'photo': image('a.gif')}, format='multipart')
        self.fiche.refresh_from_db()
        ancienne = self.fiche.photo.name
        self.client.post(self.url, {'photo': image('b.gif')}, format='multipart')
        self.fiche.refresh_from_db()
        self.assertNotEqual(self.fiche.photo.name, ancienne)
        self.assertFalse(self.fiche.photo.storage.exists(ancienne))

    def test_retirer_sa_photo(self):
        self.client.force_authenticate(self.compte)
        self.client.post(self.url, {'photo': image()}, format='multipart')
        reponse = self.client.delete(self.url)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertIsNone(reponse.data['photo'])

    def test_un_autre_compte_est_refuse(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.post(self.url, {'photo': image()}, format='multipart')
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_sans_connexion_refuse(self):
        reponse = self.client.post(self.url, {'photo': image()}, format='multipart')
        self.assertEqual(reponse.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(TAILLE_MAX_IMAGE_MO=0)
    def test_photo_trop_lourde(self):
        self.client.force_authenticate(self.compte)
        reponse = self.client.post(self.url, {'photo': image()}, format='multipart')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
