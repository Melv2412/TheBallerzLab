import base64
from datetime import date, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.models import Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from tournois.organisateurs import GROUPE_ORGANISATEURS
from tournois.serializers import MatchSerializer
from tournois.views import MatchViewSet


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


class HealthTests(APITestCase):
    def test_health_accessible_sans_connexion(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'status': 'ok', 'database': True})


class PaginationTests(BaseAPITestCase):
    def test_les_listes_sont_paginees(self):
        for i in range(55):
            Equipe.objects.create(nom=f'P{i}', tournoi=self.tournoi)
        reponse = self.client.get('/api/equipes/')
        self.assertEqual(reponse.data['count'], 58)
        self.assertEqual(len(reponse.data['results']), 50)
        self.assertIsNotNone(reponse.data['next'])

    def test_taille_de_page_demandee_plafonnee(self):
        reponse = self.client.get('/api/equipes/?page_size=10000')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(len(reponse.data['results']), 3)


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
        self.assertEqual(self.client.patch(url, {'has_demis': True}).status_code, status.HTTP_403_FORBIDDEN)

        self.intrus.is_staff = True
        self.intrus.save()
        self.assertEqual(self.client.patch(url, {'has_demis': True}).status_code, status.HTTP_200_OK)


class NomTournoiTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        groupe = Group.objects.get(name=GROUPE_ORGANISATEURS)
        self.orga.groups.add(groupe)
        self.intrus.groups.add(groupe)

    def creer(self, utilisateur, nom):
        self.client.force_authenticate(utilisateur)
        return self.client.post('/api/tournois/', {'nom': nom, 'date_debut': '2026-03-01', 'date_fin': '2026-03-02'})

    def test_meme_nom_possible_pour_deux_organisateurs(self):
        reponse = self.creer(self.intrus, 'Interpromo')  # déjà utilisé par l'organisateur « orga »
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertNotEqual(reponse.data['slug'], 'interpromo')  # le slug reste unique

    def test_meme_nom_refuse_pour_le_meme_organisateur(self):
        reponse = self.creer(self.orga, 'interpromo')  # la casse ne compte pas
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nom', reponse.data)
        autre = Tournoi.objects.create(
            nom='Ete', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
        )
        reponse = self.client.patch(f'/api/tournois/{autre.slug}/', {'nom': 'Interpromo'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        reponse = self.client.patch('/api/tournois/interpromo/', {'nom': 'Interpromo', 'date_fin': '2026-01-03'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)  # son propre nom inchangé


class ValidationMatchTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)

    def test_heure_du_match_saisie_a_l_heure_francaise(self):
        # Le formulaire envoie l'heure sans fuseau : 20h00 doit rester 20h00 à Paris (19h00 UTC en hiver)
        reponse = self.client.post('/api/matchs/', {
            'tournoi': self.tournoi.id, 'equipe_domicile': self.dom.id, 'equipe_exterieur': self.ext.id,
            'date_match': '2026-01-01T20:00',
        })
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        match = Match.objects.get(pk=reponse.data['id'])
        self.assertEqual(match.date_match.astimezone(dt_timezone.utc).hour, 19)
        self.assertTrue(reponse.data['date_match'].startswith('2026-01-01T20:00:00+01:00'))

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

    def test_stats_non_modifiables_hors_des_actions_du_match(self):
        # Création / modification directes interdites : elles contourneraient exclusion, verrou et fautes d'équipe
        etranger = Joueur.objects.create(prenom='E', nom='T', numero_maillot=1, equipe=self.autre_equipe)
        reponse = self.client.post('/api/statistiques/', {'joueur': etranger.id, 'match': self.match.id})
        self.assertEqual(reponse.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        reponse = self.client.patch(f'/api/statistiques/{self.stat.id}/', {'points': 50})
        self.assertEqual(reponse.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


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

    def test_premiere_stat_passe_le_match_en_cours(self):
        self.assertEqual(self.match.statut, 'a_venir')
        self.client.patch(self.url, {'champ': 'rebonds', 'action': 'decrement', 'valeur': 1})  # rien ne change
        self.match.refresh_from_db()
        self.assertEqual(self.match.statut, 'a_venir')

        reponse = self.client.patch(self.url, {'champ': 'points', 'action': 'increment', 'valeur': 2})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['match']['statut'], 'en_cours')
        self.match.refresh_from_db()
        self.assertEqual((self.match.statut, self.match.score_domicile), ('en_cours', 2))

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

    def test_score_non_modifiable_directement(self):
        self.client.patch(f'/api/matchs/{self.match.id}/', {'score_domicile': 99, 'score_exterieur': 42})
        self.match.refresh_from_db()
        self.assertEqual((self.match.score_domicile, self.match.score_exterieur), (0, 0))


class ChronoTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.url = f'/api/matchs/{self.match.id}/'
        self.client.force_authenticate(self.orga)

    def demarrer_il_y_a(self, secondes, **champs):
        Match.objects.filter(pk=self.match.pk).update(
            chrono_en_cours=True, chrono_demarre_a=timezone.now() - timedelta(seconds=secondes), **champs,
        )

    def test_le_chrono_decompte_sans_ecriture(self):
        self.demarrer_il_y_a(10)
        data = self.client.get(self.url).data
        self.assertTrue(data['chrono_en_cours'])
        self.assertAlmostEqual(data['temps_restant_secondes'], 590, delta=1)
        self.assertAlmostEqual(data['shot_clock_secondes'], 14, delta=1)

    def test_pause_fige_le_temps_ecoule(self):
        self.demarrer_il_y_a(10)
        data = self.client.patch(self.url, {'chrono_en_cours': False}).data
        self.assertFalse(data['chrono_en_cours'])
        self.match.refresh_from_db()
        self.assertAlmostEqual(self.match.temps_restant_secondes, 590, delta=1)
        self.assertIsNone(self.match.chrono_demarre_a)

    def test_reprise_enregistre_l_heure_de_depart(self):
        self.client.patch(self.url, {'chrono_en_cours': True})
        self.match.refresh_from_db()
        self.assertTrue(self.match.chrono_en_cours)
        self.assertIsNotNone(self.match.chrono_demarre_a)

    def test_violation_des_24_secondes_arrete_le_chrono(self):
        self.demarrer_il_y_a(30)
        data = self.client.get(self.url).data
        self.assertFalse(data['chrono_en_cours'])
        self.assertEqual(data['shot_clock_secondes'], 0)
        self.assertAlmostEqual(data['temps_restant_secondes'], 576, delta=0.01)

    def test_fin_de_periode_passe_a_la_suivante(self):
        self.demarrer_il_y_a(20, temps_restant_secondes=5)
        data = self.client.get(self.url).data
        self.assertFalse(data['chrono_en_cours'])
        self.assertEqual(data['periode_actuelle'], 2)
        self.assertEqual(data['temps_restant_secondes'], 600)

    def test_pause_n_ecrase_pas_les_actions_enregistrees_en_meme_temps(self):
        # Le PATCH part d'un match lu avant le panier, la faute et le temps mort
        perime = Match.objects.get(pk=self.match.pk)
        url_stat = f'/api/matchs/{self.match.id}/stats/{self.stat.id}/update/'
        self.client.patch(url_stat, {'champ': 'points', 'action': 'increment', 'valeur': 2})
        self.client.patch(url_stat, {'champ': 'fautes', 'action': 'increment', 'valeur': 1})
        self.client.post(f'/api/matchs/{self.match.id}/temps_mort/', {'equipe': 'domicile'})

        with patch.object(MatchViewSet, 'get_object', return_value=perime):
            reponse = self.client.patch(self.url, {'chrono_en_cours': True})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

        self.match.refresh_from_db()
        self.assertEqual(self.match.score_domicile, 2)
        self.assertEqual(self.match.fautes_equipe_domicile, 1)
        self.assertEqual(self.match.temps_morts_utilises_domicile, 1)
        self.assertTrue(self.match.chrono_en_cours)

    def test_le_serializer_n_enregistre_que_les_champs_modifies(self):
        perime = Match.objects.get(pk=self.match.pk)
        Match.objects.filter(pk=self.match.pk).update(score_domicile=7, fautes_equipe_exterieur=3)

        serializer = MatchSerializer(perime, data={'possession_fleche': 'domicile'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        self.match.refresh_from_db()
        self.assertEqual(self.match.possession_fleche, 'domicile')
        self.assertEqual((self.match.score_domicile, self.match.fautes_equipe_exterieur), (7, 3))

    def test_reset_du_shot_clock_pendant_que_le_chrono_tourne(self):
        self.demarrer_il_y_a(10)
        self.client.patch(self.url, {'shot_clock_secondes': 24})
        self.match.refresh_from_db()
        self.assertTrue(self.match.chrono_en_cours)
        self.assertEqual(self.match.shot_clock_secondes, 24)
        self.assertAlmostEqual(self.match.temps_restant_secondes, 590, delta=1)


class ClassementTests(BaseAPITestCase):
    def test_match_nul_ne_peut_pas_etre_termine(self):
        self.client.force_authenticate(self.orga)
        reponse = self.client.patch(f'/api/matchs/{self.match.id}/', {'statut': 'termine'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('statut', reponse.data)
        self.match.refresh_from_db()
        self.assertEqual(self.match.statut, 'a_venir')

    def test_match_avec_un_vainqueur_peut_etre_termine(self):
        self.client.force_authenticate(self.orga)
        self.stat.points = 2
        self.stat.save()
        reponse = self.client.patch(f'/api/matchs/{self.match.id}/', {'statut': 'termine'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_creer_un_match_deja_termine_a_0_0_refuse(self):
        self.client.force_authenticate(self.orga)
        reponse = self.client.post('/api/matchs/', {
            'tournoi': self.tournoi.id, 'equipe_domicile': self.dom.id,
            'equipe_exterieur': self.ext.id, 'statut': 'termine',
        })
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

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


class JetonsTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        reponse = self.client.post('/api/token/', {'username': 'orga', 'password': 'motdepasse-solide-42'})
        self.refresh = reponse.data['refresh']

    def test_rafraichir_donne_un_nouveau_refresh_et_revoque_l_ancien(self):
        reponse = self.client.post('/api/token/refresh/', {'refresh': self.refresh})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertNotEqual(reponse.data['refresh'], self.refresh)
        rejoue = self.client.post('/api/token/refresh/', {'refresh': self.refresh})
        self.assertEqual(rejoue.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_deconnexion_revoque_le_refresh(self):
        reponse = self.client.post('/api/token/blacklist/', {'refresh': self.refresh})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        apres = self.client.post('/api/token/refresh/', {'refresh': self.refresh})
        self.assertEqual(apres.status_code, status.HTTP_401_UNAUTHORIZED)


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

    def test_stockage_en_panne_renvoie_503_lisible(self):
        gif = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
        logo = SimpleUploadedFile('logo.gif', gif, content_type='image/gif')
        with patch('django.core.files.storage.FileSystemStorage._save', side_effect=OSError('lecture seule')), \
                self.assertLogs('tournois.views', level='ERROR'):
            reponse = self.client.post(
                '/api/equipes/', {'nom': 'D', 'tournoi': self.tournoi.id, 'logo': logo}, format='multipart',
            )
        self.assertEqual(reponse.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('stockage indisponible', reponse.data['detail'])
        self.assertFalse(Equipe.objects.filter(nom='D').exists())


class PerformanceRequetesTests(BaseAPITestCase):
    """Le nombre de requêtes SQL ne doit pas grandir avec le nombre d'équipes ou de joueurs."""

    def setUp(self):
        super().setUp()
        # Gonfle le tournoi : 8 équipes de 6 joueurs, des matchs terminés avec stats
        equipes = [self.dom, self.ext] + [
            Equipe.objects.create(nom=f'E{i}', tournoi=self.tournoi) for i in range(6)
        ]
        for equipe in equipes:
            for n in range(1, 7):
                Joueur.objects.get_or_create(equipe=equipe, numero_maillot=n, defaults={'prenom': 'P', 'nom': f'N{n}'})
        for dom, ext in zip(equipes[::2], equipes[1::2], strict=True):
            match = Match.objects.create(tournoi=self.tournoi, equipe_domicile=dom, equipe_exterieur=ext, statut='termine')
            for joueur in Joueur.objects.filter(equipe__in=[dom, ext]):
                # +1 point pour l'équipe à domicile : pas de match nul
                bonus = 1 if joueur.equipe_id == dom.id and joueur.numero_maillot == 1 else 0
                StatistiqueJoueur.objects.create(
                    joueur=joueur, match=match, points=joueur.numero_maillot + bonus, passes=1,
                )

    def test_classement_en_requetes_constantes(self):
        with self.assertNumQueries(3):
            reponse = self.client.get('/api/tournois/interpromo/classement/')
        self.assertEqual(len(reponse.data), 8)
        self.assertEqual(sum(e['joues'] for e in reponse.data), 8)

    def test_mvp_en_requetes_constantes(self):
        with self.assertNumQueries(3):  # tournoi, stats des joueurs, matchs par équipe
            reponse = self.client.get('/api/tournois/interpromo/mvp/')
        self.assertEqual(len(reponse.data), 5)
        meilleur = reponse.data[0]
        self.assertEqual(meilleur['moyenne_eval'], 7.0)  # 6 points + 1 passe sur 1 match
        self.assertEqual(meilleur['nb_matchs'], 1)

    def test_mvp_exige_la_moitie_des_matchs_de_l_equipe(self):
        # L'équipe A joue 2 autres matchs sans ce joueur : 1 match sur 3, il sort du classement
        vedette = Joueur.objects.create(prenom='Star', nom='Unique', numero_maillot=99, equipe=self.dom)
        match_vedette = Match.objects.filter(equipe_domicile=self.dom, statut='termine').first()
        StatistiqueJoueur.objects.create(joueur=vedette, match=match_vedette, points=60)
        self.assertEqual(self.client.get('/api/tournois/interpromo/mvp/').data[0]['id'], vedette.id)

        regulier = Joueur.objects.get(equipe=self.dom, numero_maillot=1)
        for _ in range(2):
            match = Match.objects.create(
                tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext, statut='termine',
            )
            StatistiqueJoueur.objects.create(joueur=regulier, match=match, points=1)
        ids = [j['id'] for j in self.client.get('/api/tournois/interpromo/mvp/').data]
        self.assertNotIn(vedette.id, ids)

    def test_liste_des_tournois_en_une_requete(self):
        with self.assertNumQueries(2):  # page + nombre total (pagination)
            reponse = self.client.get('/api/tournois/')
        interpromo = next(t for t in reponse.data['results'] if t['slug'] == 'interpromo')
        self.assertEqual(interpromo['equipes_count'], 8)
        self.assertEqual(interpromo['matchs_count'], 5)

    def test_tous_les_joueurs_d_un_tournoi_en_une_requete(self):
        with self.assertNumQueries(2):  # page + nombre total (pagination)
            reponse = self.client.get('/api/joueurs/?tournoi=interpromo')
        self.assertEqual(reponse.data['count'], 48)
        self.assertEqual(len(reponse.data['results']), 48)

    def test_detail_du_match_ne_depend_pas_du_nombre_de_joueurs(self):
        with self.assertNumQueries(5):  # match, stats (+ joueurs, équipes), historique récent
            reponse = self.client.get(f'/api/matchs/{self.match.id}/')
        self.assertEqual(reponse.data['fautes_domicile'], 0)
