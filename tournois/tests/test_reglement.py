from datetime import date, datetime, timedelta

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import serializers, status

from tournois import reglement as regles
from tournois.models import Joueur, Match, StatistiqueJoueur

from .test_api import BaseAPITestCase


class ValidationReglementTests(SimpleTestCase):
    def test_modification_partielle_sur_une_base(self):
        reglement = regles.valider_reglement({'fautes_bonus': 6}, base=regles.PRESETS['nba'])
        self.assertEqual(reglement['fautes_bonus'], 6)
        self.assertEqual(reglement['duree_periode_secondes'], 720)
        self.assertEqual(regles.nom_preset(reglement), 'personnalise')

    def test_presets_reconnus(self):
        for nom, preset in regles.PRESETS.items():
            self.assertEqual(regles.nom_preset(dict(preset)), nom)

    def test_valeurs_invalides(self):
        for modifications in (
            {'inconnu': 1},
            {'nb_periodes': 0},
            {'duree_periode_secondes': '600'},
            {'shot_clock_actif': 1},
            {'fautes_equipe_reset': 'jamais'},
            {'shot_clock_court_secondes': 30},  # plus long que le shot clock (24)
            {'points_victoire': 1, 'points_defaite': 2},
        ):
            with self.subTest(modifications=modifications), self.assertRaises(serializers.ValidationError):
                regles.valider_reglement(modifications)

    def test_portions_de_match(self):
        fiba = regles.FIBA
        self.assertEqual([regles.segment_fautes(fiba, p) for p in (1, 2, 4, 5, 6)], [1, 2, 4, 4, 4])
        mi_temps = {**fiba, 'fautes_equipe_reset': 'mi_temps'}
        self.assertEqual([regles.segment_fautes(mi_temps, p) for p in (1, 2, 3, 5)], [1, 1, 2, 2])
        self.assertEqual([regles.segment_temps_morts(fiba, p) for p in (1, 2, 3, 4, 5, 6)], [1, 1, 2, 2, 3, 4])
        self.assertEqual([regles.duree_periode(fiba, p) for p in (4, 5)], [600, 300])


class ReglementTournoiTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)
        self.url = '/api/tournois/interpromo/'

    def test_fiba_par_defaut_et_preset_a_la_creation(self):
        self.assertEqual(self.client.get(self.url).data['reglement_type'], 'fiba')
        self.orga.is_staff = True
        self.orga.save()
        reponse = self.client.post('/api/tournois/', {
            'nom': 'Ligue NBA', 'date_debut': '2026-02-01', 'date_fin': '2026-02-10',
            'reglement': regles.PRESETS['nba'],
        }, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertEqual(reponse.data['reglement_type'], 'nba')

    def test_modification_partielle_et_propagation_aux_matchs_a_venir(self):
        en_cours = Match.objects.create(
            tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext, statut='en_cours',
        )
        reponse = self.client.patch(self.url, {'reglement': {'duree_periode_secondes': 480, 'fautes_bonus': 6}}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['reglement_type'], 'personnalise')
        self.assertEqual(reponse.data['reglement']['nb_periodes'], 4)

        self.match.refresh_from_db()
        self.assertEqual(self.match.reglement['fautes_bonus'], 6)
        self.assertEqual(self.match.temps_restant_secondes, 480)
        en_cours.refresh_from_db()
        self.assertEqual(en_cours.reglement['fautes_bonus'], 5)

    def test_reglement_invalide_refuse(self):
        reponse = self.client.patch(self.url, {'reglement': {'nb_periodes': 99}}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nb_periodes', reponse.data['reglement'])

    def test_points_de_classement_du_reglement(self):
        self.tournoi.reglement = dict(regles.PRESETS['nba'])
        self.tournoi.save()
        self.stat.points = 3
        self.stat.save()
        Match.objects.filter(pk=self.match.pk).update(statut='termine')
        classement = self.client.get(f'{self.url}classement/').data
        self.assertEqual([e['points'] for e in classement], [1, 0])

    def test_presets_publics(self):
        self.client.force_authenticate(None)
        data = self.client.get('/api/reglements/').data
        self.assertEqual(set(data['presets']), {'fiba', 'nba', '3x3'})


class ReglementMatchTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)
        self.url = f'/api/matchs/{self.match.id}/'

    def creer_match(self, **reglement):
        reponse = self.client.post('/api/matchs/', {
            'tournoi': self.tournoi.id, 'equipe_domicile': self.dom.id, 'equipe_exterieur': self.ext.id,
            'reglement': reglement,
        }, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        return reponse.data

    def test_copie_du_reglement_a_la_creation(self):
        self.tournoi.reglement = {**regles.FIBA, 'shot_clock_actif': False, 'duree_periode_secondes': 420}
        self.tournoi.save()
        data = self.creer_match()
        self.assertEqual(data['temps_restant_secondes'], 420)
        self.assertEqual(data['shot_clock_secondes'], 0)
        self.assertEqual(data['temps_morts_domicile'], 2)

    def test_ajustement_pour_un_seul_match(self):
        data = self.creer_match(nb_periodes=2, duree_periode_secondes=1200)
        self.assertEqual(data['reglement']['nb_periodes'], 2)
        self.assertEqual(data['temps_restant_secondes'], 1200)
        self.tournoi.refresh_from_db()
        self.assertEqual(self.tournoi.reglement['nb_periodes'], 4)

    def test_tout_est_modifiable_avant_le_coup_d_envoi(self):
        reponse = self.client.patch(self.url, {'reglement': {'nb_periodes': 2, 'duree_periode_secondes': 900}}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['temps_restant_secondes'], 900)

    def test_pendant_le_match_seuls_certains_reglages(self):
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        reponse = self.client.patch(self.url, {'reglement': {'nb_periodes': 2}}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

        reponse = self.client.patch(self.url, {'reglement': {'shot_clock_actif': False}}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['shot_clock_secondes'], 0)
        reponse = self.client.patch(self.url, {'shot_clock_secondes': 24}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

        reponse = self.client.patch(self.url, {'reglement': {'shot_clock_actif': True}}, format='json')
        self.assertEqual(reponse.data['shot_clock_secondes'], 24)

    def test_shot_clock_limite_au_reglement(self):
        reponse = self.client.patch(self.url, {'shot_clock_secondes': 30}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class DeroulementMatchTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)
        self.url = f'/api/matchs/{self.match.id}/'
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        self.stat_ext = StatistiqueJoueur.objects.create(
            joueur=Joueur.objects.create(prenom='Paul', nom='Martin', numero_maillot=7, equipe=self.ext),
            match=self.match,
        )

    def faute(self, stat=None, action='increment'):
        stat = stat or self.stat
        return self.client.patch(
            f'{self.url}stats/{stat.id}/update/', {'champ': 'fautes', 'action': action, 'valeur': 1}, format='json'
        )

    def etat(self):
        return self.client.get(self.url).data

    def changer_reglement(self, **modifications):
        self.match.refresh_from_db()
        self.match.reglement = {**self.match.reglement, **modifications}
        self.match.save()

    def test_fautes_d_equipe_et_bonus_par_periode(self):
        for _ in range(3):
            self.faute()
        data = self.etat()
        self.assertEqual((data['fautes_domicile'], data['bonus_domicile']), (3, False))
        self.faute()
        self.assertTrue(self.etat()['bonus_domicile'])  # 4 fautes : la 5e donnera des lancers francs

        self.client.post(f'{self.url}periode_suivante/')
        data = self.etat()
        self.assertEqual((data['fautes_domicile'], data['bonus_domicile']), (0, False))
        self.faute(self.stat_ext)
        self.assertEqual(self.etat()['fautes_exterieur'], 1)

    def test_seuil_de_bonus_reglable(self):
        self.changer_reglement(fautes_bonus=6, fautes_exclusion=0)
        for _ in range(4):
            self.faute()
        self.assertFalse(self.etat()['bonus_domicile'])
        self.faute()
        self.assertTrue(self.etat()['bonus_domicile'])

    def test_remise_a_zero_par_mi_temps(self):
        self.changer_reglement(fautes_equipe_reset='mi_temps')
        self.faute()
        self.client.post(f'{self.url}periode_suivante/')
        self.assertEqual(self.etat()['fautes_domicile'], 1)
        self.client.post(f'{self.url}periode_suivante/')
        self.assertEqual(self.etat()['fautes_domicile'], 0)

    def test_prolongation_continue_la_derniere_periode(self):
        Match.objects.filter(pk=self.match.pk).update(periode_actuelle=4)
        self.faute()
        reponse = self.client.post(f'{self.url}periode_suivante/')
        self.assertEqual(reponse.data['periode_actuelle'], 5)
        self.assertEqual(reponse.data['temps_restant_secondes'], 300)
        self.assertEqual(reponse.data['fautes_domicile'], 1)

    def test_prolongation_refusee_sans_egalite(self):
        Match.objects.filter(pk=self.match.pk).update(periode_actuelle=4, score_domicile=2)
        reponse = self.client.post(f'{self.url}periode_suivante/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Pas d'égalité", reponse.data['detail'])
        self.assertEqual(self.etat()['periode_actuelle'], 4)

        Match.objects.filter(pk=self.match.pk).update(periode_actuelle=5, score_exterieur=4)
        self.assertEqual(self.client.post(f'{self.url}periode_suivante/').status_code, status.HTTP_400_BAD_REQUEST)

        Match.objects.filter(pk=self.match.pk).update(score_domicile=4)  # égalité : nouvelle prolongation
        self.assertEqual(self.client.post(f'{self.url}periode_suivante/').data['periode_actuelle'], 6)

    def test_periodes_normales_libres_meme_avec_un_ecart(self):
        Match.objects.filter(pk=self.match.pk).update(periode_actuelle=3, score_domicile=10)
        self.assertEqual(self.client.post(f'{self.url}periode_suivante/').data['periode_actuelle'], 4)

    def test_correction_d_une_faute(self):
        self.faute()
        self.faute(action='decrement')
        self.assertEqual(self.etat()['fautes_domicile'], 0)
        self.faute(action='decrement')  # déjà à 0 : rien ne bouge
        self.assertEqual(self.etat()['fautes_domicile'], 0)

    def test_temps_morts_par_mi_temps_et_prolongation(self):
        url = f'{self.url}temps_mort/'
        for _ in range(2):
            self.assertEqual(self.client.post(url, {'equipe': 'domicile'}).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(url, {'equipe': 'domicile'}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.etat()['temps_morts_exterieur'], 2)

        Match.objects.filter(pk=self.match.pk).update(periode_actuelle=2)
        self.client.post(f'{self.url}periode_suivante/')  # 3e quart-temps : 2e mi-temps
        self.assertEqual(self.etat()['temps_morts_domicile'], 3)
        Match.objects.filter(pk=self.match.pk).update(periode_actuelle=5)
        self.assertEqual(self.etat()['temps_morts_domicile'], 1)

    def test_temps_mort_arrete_le_chrono(self):
        Match.objects.filter(pk=self.match.pk).update(
            chrono_en_cours=True, chrono_demarre_a=timezone.now() - timedelta(seconds=10),
        )
        data = self.client.post(f'{self.url}temps_mort/', {'equipe': 'exterieur'}).data
        self.assertFalse(data['chrono_en_cours'])
        self.assertAlmostEqual(data['temps_restant_secondes'], 590, delta=1)
        self.assertEqual(data['temps_morts_exterieur'], 1)

    def test_fin_du_temps_reglementaire(self):
        demarre = timezone.now() - timedelta(seconds=10)
        Match.objects.filter(pk=self.match.pk).update(
            periode_actuelle=4, temps_restant_secondes=5, chrono_en_cours=True, chrono_demarre_a=demarre,
            shot_clock_secondes=0,
        )
        data = self.etat()  # 0-0 : prolongation
        self.assertEqual((data['periode_actuelle'], data['temps_restant_secondes']), (5, 300))

        Match.objects.filter(pk=self.match.pk).update(
            periode_actuelle=4, temps_restant_secondes=5, chrono_en_cours=True, chrono_demarre_a=demarre,
            shot_clock_secondes=0, score_domicile=2,
        )
        data = self.etat()  # un vainqueur : le match reste à 0, pas de prolongation
        self.assertEqual((data['periode_actuelle'], data['temps_restant_secondes']), (4, 0))
        self.assertFalse(data['chrono_en_cours'])

    def test_joueur_exclu_bloque_par_le_serveur(self):
        for _ in range(5):
            self.assertEqual(self.faute().status_code, status.HTTP_200_OK)
        reponse = self.client.patch(
            f'{self.url}stats/{self.stat.id}/update/', {'champ': 'points', 'action': 'increment', 'valeur': 2},
            format='json',
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.faute(action='decrement').status_code, status.HTTP_200_OK)  # correction possible

    def test_exclusion_non_depassee_par_un_ajout_de_plusieurs_fautes(self):
        for _ in range(3):
            self.faute()
        reponse = self.client.patch(
            f'{self.url}stats/{self.stat.id}/update/', {'champ': 'fautes', 'action': 'increment', 'valeur': 4},
            format='json',
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2 faute(s)', reponse.data['detail'])
        self.stat.refresh_from_db()
        self.assertEqual(self.stat.fautes, 3)
        reponse = self.client.patch(
            f'{self.url}stats/{self.stat.id}/update/', {'champ': 'fautes', 'action': 'increment', 'valeur': 2},
            format='json',
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)  # 5 : exactement la limite

    def test_sans_exclusion(self):
        self.changer_reglement(fautes_exclusion=0)
        for _ in range(7):
            self.assertEqual(self.faute().status_code, status.HTTP_200_OK)


class VerrousMatchTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)
        self.url = f'/api/matchs/{self.match.id}/'

    def test_match_termine_fige(self):
        self.stat.points = 2
        self.stat.save()
        self.assertEqual(self.client.patch(self.url, {'statut': 'termine'}).status_code, status.HTTP_200_OK)

        maj_stat = {'champ': 'points', 'action': 'increment', 'valeur': 2}
        refus = (
            self.client.patch(f'{self.url}stats/{self.stat.id}/update/', maj_stat, format='json'),
            self.client.post(f'{self.url}temps_mort/', {'equipe': 'domicile'}),
            self.client.post(f'{self.url}periode_suivante/'),
            self.client.post(f'{self.url}initialiser_stats/'),
            self.client.patch(self.url, {'chrono_en_cours': True}),
        )
        for reponse in refus:
            self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertEqual(self.client.patch(self.url, {'statut': 'en_cours'}).status_code, status.HTTP_200_OK)
        reponse = self.client.patch(f'{self.url}stats/{self.stat.id}/update/', maj_stat, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_equipes_figees_des_qu_il_y_a_des_stats(self):
        autre = self.tournoi.equipes.create(nom='C')
        reponse = self.client.patch(self.url, {'equipe_exterieur': autre.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

        self.stat.delete()
        reponse = self.client.patch(self.url, {'equipe_exterieur': autre.id})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)


class DatesTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)

    def test_fin_avant_le_debut_refusee(self):
        reponse = self.client.patch('/api/tournois/interpromo/', {'date_fin': '2025-12-31'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_match_hors_des_dates_du_tournoi(self):
        reponse = self.client.patch(f'/api/matchs/{self.match.id}/', {'date_match': '2026-03-01T15:00:00Z'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        reponse = self.client.patch(f'/api/matchs/{self.match.id}/', {'date_match': '2026-01-02T15:00:00Z'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_dates_du_tournoi_ne_peuvent_pas_exclure_un_match(self):
        Match.objects.filter(pk=self.match.pk).update(
            date_match=timezone.make_aware(datetime(2026, 1, 2, 15, 0)),
        )
        reponse = self.client.patch('/api/tournois/interpromo/', {'date_fin': date(2026, 1, 1).isoformat()})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
