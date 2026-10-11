import base64
from datetime import date

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.models import Tournoi, Equipe, Joueur, Match, StatistiqueJoueur


class BaseAPITestCase(APITestCase):
    def setUp(self):
        cache.clear()  # remet à zéro les compteurs de limitation
        self.orga = User.objects.create_user('orga', password='motdepasse-solide-42')
        self.intrus = User.objects.create_user('intrus', password='motdepasse-solide-42')

        self.tournoi = Tournoi.objects.create(
            nom='Interpromo', organisateur=self.orga,
            date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
        )
        self.dom = Equipe.objects.create(nom='A', tournoi=self.tournoi)
        self.ext = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        self.joueur = Joueur.objects.create(prenom='Jean', nom='Dupont', numero_maillot=4, equipe=self.dom)
        self.match = Match.objects.create(
            tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext,
        )
        self.stat = StatistiqueJoueur.objects.create(joueur=self.joueur, match=self.match)

        # Tournoi d'un autre organisateur
        self.autre_tournoi = Tournoi.objects.create(
            nom='Autre', organisateur=self.intrus,
            date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
        )
        self.autre_equipe = Equipe.objects.create(nom='C', tournoi=self.autre_tournoi)


class UtilisateursTests(BaseAPITestCase):
    def test_inscription_possible(self):
        reponse = self.client.post('/api/users/', {
            'username': 'nouveau', 'email': 'n@example.com', 'password': 'motdepasse-solide-42',
        })
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', reponse.data)
        self.assertTrue(User.objects.get(username='nouveau').check_password('motdepasse-solide-42'))

    def test_mot_de_passe_trop_faible_refuse(self):
        reponse = self.client.post('/api/users/', {'username': 'faible', 'password': '123'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_liste_des_utilisateurs_inaccessible(self):
        self.assertEqual(self.client.get('/api/users/').status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_impossible_de_modifier_ou_supprimer_un_compte(self):
        url = f'/api/users/{self.orga.id}/'
        self.assertEqual(self.client.patch(url, {'username': 'pirate'}).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(User.objects.filter(username='orga').exists())


class PermissionsTests(BaseAPITestCase):
    def test_lecture_publique(self):
        self.assertEqual(self.client.get('/api/tournois/interpromo/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(f'/api/tournois/{self.tournoi.id}/').status_code, status.HTTP_200_OK)

    def test_organisateur_peut_ajouter_une_equipe(self):
        self.client.force_authenticate(self.orga)
        reponse = self.client.post('/api/equipes/', {'nom': 'D', 'tournoi': self.tournoi.id})
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)

    def test_intrus_ne_peut_pas_ajouter_une_equipe(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.post('/api/equipes/', {'nom': 'D', 'tournoi': self.tournoi.id})
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_intrus_ne_peut_pas_ajouter_un_joueur(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.post('/api/joueurs/', {
            'prenom': 'X', 'nom': 'Y', 'numero_maillot': 99, 'equipe': self.dom.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_intrus_ne_peut_pas_creer_un_match(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.post('/api/matchs/', {
            'tournoi': self.tournoi.id, 'equipe_domicile': self.dom.id, 'equipe_exterieur': self.ext.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_impossible_de_deplacer_son_equipe_vers_le_tournoi_d_un_autre(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.patch(f'/api/equipes/{self.autre_equipe.id}/', {'tournoi': self.tournoi.id})
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)
        self.autre_equipe.refresh_from_db()
        self.assertEqual(self.autre_equipe.tournoi, self.autre_tournoi)

    def test_intrus_ne_peut_pas_reinitialiser_les_playoffs(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.post('/api/tournois/interpromo/reset_playoffs/', {})
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_tournoi_sans_organisateur_reserve_au_staff(self):
        self.tournoi.organisateur = None
        self.tournoi.save()
        url = '/api/tournois/interpromo/'

        self.client.force_authenticate(self.intrus)
        self.assertEqual(self.client.patch(url, {'limite_fautes': 6}).status_code, status.HTTP_403_FORBIDDEN)

        self.intrus.is_staff = True
        self.intrus.save()
        self.assertEqual(self.client.patch(url, {'limite_fautes': 6}).status_code, status.HTTP_200_OK)


class ValidationMatchTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)

    def test_equipe_contre_elle_meme_refusee(self):
        reponse = self.client.post('/api/matchs/', {
            'tournoi': self.tournoi.id, 'equipe_domicile': self.dom.id, 'equipe_exterieur': self.dom.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_equipe_d_un_autre_tournoi_refusee(self):
        reponse = self.client.post('/api/matchs/', {
            'tournoi': self.tournoi.id, 'equipe_domicile': self.dom.id, 'equipe_exterieur': self.autre_equipe.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stat_pour_un_joueur_hors_du_match_refusee(self):
        etranger = Joueur.objects.create(prenom='E', nom='T', numero_maillot=1, equipe=self.autre_equipe)
        reponse = self.client.post('/api/statistiques/', {'joueur': etranger.id, 'match': self.match.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class MiseAJourStatistiqueTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.url = f'/api/matchs/{self.match.id}/stats/{self.stat.id}/update/'
        self.client.force_authenticate(self.orga)

    def test_increment_met_a_jour_le_score(self):
        reponse = self.client.patch(self.url, {'champ': 'points', 'action': 'increment', 'valeur': 3})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['statistique']['points'], 3)
        self.assertEqual(reponse.data['match']['score_domicile'], 3)

    def test_decrement_ne_descend_pas_sous_zero(self):
        self.client.patch(self.url, {'champ': 'rebonds', 'action': 'increment', 'valeur': 2})
        reponse = self.client.patch(self.url, {'champ': 'rebonds', 'action': 'decrement', 'valeur': 5})
        self.assertEqual(reponse.data['statistique']['rebonds'], 0)

    def test_valeur_negative_refusee(self):
        reponse = self.client.patch(self.url, {'champ': 'points', 'action': 'increment', 'valeur': -50})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.stat.refresh_from_db()
        self.assertEqual(self.stat.points, 0)

    def test_champ_invalide_refuse(self):
        reponse = self.client.patch(self.url, {'champ': 'score_domicile', 'action': 'increment'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_intrus_ne_peut_pas_modifier_les_stats(self):
        self.client.force_authenticate(self.intrus)
        reponse = self.client.patch(self.url, {'champ': 'points', 'action': 'increment', 'valeur': 2})
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)


class ClassementTests(BaseAPITestCase):
    def test_classement_par_slug_et_par_id(self):
        self.match.statut = 'termine'
        self.match.save()
        self.stat.points = 10
        self.stat.save()

        for lookup in ('interpromo', self.tournoi.id):
            reponse = self.client.get(f'/api/tournois/{lookup}/classement/')
            self.assertEqual(reponse.status_code, status.HTTP_200_OK)
            self.assertEqual(reponse.data[0]['nom'], 'A')
            self.assertEqual(reponse.data[0]['gagnes'], 1)

    def test_tournoi_au_nom_numerique_accessible(self):
        Tournoi.objects.create(nom='2025', date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2))
        self.assertEqual(self.client.get('/api/tournois/tournoi-2025/classement/').status_code, status.HTTP_200_OK)


class LimitationTentativesTests(BaseAPITestCase):
    def test_trop_de_tentatives_de_connexion_bloquees(self):
        identifiants = {'username': 'orga', 'password': 'mauvais'}
        for _ in range(10):
            self.assertEqual(self.client.post('/api/token/', identifiants).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post('/api/token/', identifiants).status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class TailleImageTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)

    @override_settings(TAILLE_MAX_IMAGE_MO=0)
    def test_logo_trop_lourd_refuse(self):
        # 1x1 GIF valide ; avec une limite à 0 Mo, toute image est trop lourde
        gif = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
        logo = SimpleUploadedFile('logo.gif', gif, content_type='image/gif')
        reponse = self.client.post(
            '/api/equipes/', {'nom': 'D', 'tournoi': self.tournoi.id, 'logo': logo}, format='multipart',
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('logo', reponse.data)
