from django.contrib.auth.models import User
from rest_framework import status

from tournois.carriere import profil_athlete
from tournois.classement import calculer_classement
from tournois.models import Equipe, Match, StatistiqueJoueur, Tournoi
from tournois.phases_finales import generer_phases_finales, series_de_la_phase
from tournois.services import classement_du_tournoi, meilleurs_joueurs

from .test_protection_resultats import BaseProtection


class BaseForfait(BaseProtection):
    def setUp(self):
        super().setUp()
        self.url = f'/api/matchs/{self.match.id}/forfait/'

    def declarer(self, equipe='exterieur', match=None, **valeurs):
        url = f'/api/matchs/{match.id}/forfait/' if match else self.url
        return self.client.post(url, {'equipe': equipe, **valeurs}, format='json')

    def activer_finale(self, victoires=1):
        Tournoi.objects.filter(pk=self.tournoi.pk).update(
            has_8emes=False, has_quarts=False, has_demis=False, has_finale=True, victoires_requises_finale=victoires,
        )
        self.tournoi.refresh_from_db()

    def activer_demis(self):
        Tournoi.objects.filter(pk=self.tournoi.pk).update(
            has_8emes=False, has_quarts=False, has_demis=True, has_finale=True,
            victoires_requises_demi=1, victoires_requises_finale=1,
        )
        self.tournoi.refresh_from_db()


class DeclarationTests(BaseForfait):
    def test_score_par_defaut_et_match_termine(self):
        reponse = self.declarer('exterieur')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['forfait'], 'exterieur')
        self.assertEqual(reponse.data['statut'], 'termine')
        self.assertEqual((reponse.data['score_domicile'], reponse.data['score_exterieur']), (20, 0))

    def test_score_modifiable_ensuite(self):
        self.declarer('domicile')
        reponse = self.declarer('domicile', score_vainqueur=25, score_perdant=3)
        self.assertEqual((reponse.data['score_domicile'], reponse.data['score_exterieur']), (3, 25))

    def test_le_vainqueur_doit_avoir_plus_de_points(self):
        reponse = self.declarer('domicile', score_vainqueur=5, score_perdant=5)
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.match.refresh_from_db()
        self.assertEqual(self.match.forfait, '')

    def test_match_deja_termine_refuse(self):
        self.terminer()
        self.assertEqual(self.declarer().status_code, status.HTTP_400_BAD_REQUEST)

    def test_chrono_arrete(self):
        Match.objects.filter(pk=self.match.pk).update(chrono_en_cours=True)
        self.declarer()
        self.match.refresh_from_db()
        self.assertFalse(self.match.chrono_en_cours)
        self.assertIsNone(self.match.chrono_demarre_a)

    def test_reserve_a_l_organisateur(self):
        self.client.force_authenticate(User.objects.create_user('autre', password='motdepasse-solide-42'))
        self.assertEqual(self.declarer().status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.declarer().status_code, status.HTTP_401_UNAUTHORIZED)

    def test_champ_non_modifiable_directement(self):
        self.client.patch(f'/api/matchs/{self.match.id}/', {'forfait': 'double'}, format='json')
        self.match.refresh_from_db()
        self.assertEqual(self.match.forfait, '')

    def test_visible_dans_la_liste(self):
        self.declarer()
        reponse = self.client.get('/api/matchs/', {'tournoi': self.tournoi.id})
        donnees = reponse.data['results'] if isinstance(reponse.data, dict) else reponse.data
        self.assertEqual(donnees[0]['forfait'], 'exterieur')


class StatsConserveesTests(BaseForfait):
    def setUp(self):
        super().setUp()
        self.stat = self.donner_stats(points=7)
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')

    def test_le_score_du_forfait_n_est_pas_recalcule(self):
        self.declarer('exterieur')
        self.stat.refresh_from_db()
        self.stat.points = 9
        self.stat.save()
        self.match.refresh_from_db()
        self.assertEqual((self.match.score_domicile, self.match.score_exterieur), (20, 0))

    def test_annulation_rend_le_match_et_ses_stats(self):
        self.declarer('domicile')
        self.assertTrue(StatistiqueJoueur.objects.filter(pk=self.stat.pk, points=7).exists())
        reponse = self.client.delete(self.url)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['forfait'], '')
        self.assertEqual(reponse.data['statut'], 'en_cours')
        self.assertEqual((reponse.data['score_domicile'], reponse.data['score_exterieur']), (7, 0))

    def test_stat_refusee_pendant_le_forfait(self):
        self.declarer()
        reponse = self.client.patch(
            f'/api/matchs/{self.match.id}/stats/{self.stat.id}/update/', {'champ': 'points', 'action': 'increment'},
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reouverture_simple_refusee(self):
        self.declarer()
        reponse = self.client.patch(f'/api/matchs/{self.match.id}/', {'statut': 'en_cours'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.match.refresh_from_db()
        self.assertEqual(self.match.statut, 'termine')


class AnnulationTests(BaseForfait):
    def test_match_jamais_commence_redevient_a_venir(self):
        self.declarer()
        self.assertEqual(self.client.delete(self.url).data['statut'], 'a_venir')

    def test_refuse_sans_forfait(self):
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_400_BAD_REQUEST)


class ClassementTests(BaseForfait):
    def ligne(self, equipe):
        return next(e for e in classement_du_tournoi(self.tournoi) if e['id'] == equipe.id)

    def test_le_forfait_donne_zero_point_au_fautif(self):
        self.declarer('exterieur')
        gagnant, fautif = self.ligne(self.dom), self.ligne(self.ext)
        self.assertEqual((gagnant['points'], gagnant['gagnes'], gagnant['points_pour']), (2, 1, 20))
        self.assertEqual((fautif['points'], fautif['perdus'], fautif['joues']), (0, 1, 1))

    def test_double_forfait_zero_chacun_sans_vainqueur(self):
        self.declarer('double')
        for equipe in (self.dom, self.ext):
            ligne = self.ligne(equipe)
            self.assertEqual((ligne['joues'], ligne['gagnes'], ligne['perdus'], ligne['points']), (1, 0, 1, 0))

    def test_les_anciens_resultats_sans_forfait_restent_valides(self):
        classement = calculer_classement([(1, 'A'), (2, 'B')], [(1, 2, 80, 70)])
        self.assertEqual([e['points'] for e in classement], [2, 1])


class SeriesTests(BaseForfait):
    def test_double_forfait_refuse_en_phase_finale(self):
        finale = self.match_final('finale')
        reponse = self.declarer('double', match=finale)
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        finale.refresh_from_db()
        self.assertEqual(finale.statut, 'a_venir')

    def test_le_forfait_donne_la_victoire_de_serie(self):
        self.activer_finale()
        finale = self.match_final('finale')
        self.declarer('domicile', match=finale)
        serie = series_de_la_phase(self.tournoi, 'finale')[0]
        self.assertEqual(serie['vainqueur'], self.ext.id)

    def test_la_serie_continue_apres_un_forfait(self):
        self.activer_finale(victoires=2)
        finale = self.match_final('finale')
        self.declarer('domicile', match=finale)
        self.assertEqual(Match.objects.filter(phase='finale').count(), 2)

    def test_poule_avec_forfait_permet_de_generer_la_finale(self):
        self.activer_finale()
        self.declarer('double')
        generer_phases_finales(self.tournoi)
        self.assertEqual(Match.objects.filter(phase='finale').count(), 1)

    def test_annulation_refusee_si_phase_suivante_creee(self):
        self.activer_demis()
        autre = Equipe.objects.create(nom='C', tournoi=self.tournoi)
        quatrieme = Equipe.objects.create(nom='D', tournoi=self.tournoi)
        demi = self.match_final('demi')
        seconde = Match.objects.create(
            tournoi=self.tournoi, phase='demi', equipe_domicile=autre, equipe_exterieur=quatrieme,
        )
        self.declarer('exterieur', match=demi)
        self.declarer('exterieur', match=seconde)
        self.assertEqual(Match.objects.filter(phase='finale').count(), 1)
        url = f'/api/matchs/{demi.id}/forfait/'
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.declarer('domicile', match=demi).status_code, status.HTTP_400_BAD_REQUEST)
        # Corriger le score sans changer le vainqueur reste possible
        self.assertEqual(self.declarer('exterieur', match=demi, score_vainqueur=30).status_code, status.HTTP_200_OK)


class StatsIndividuellesTests(BaseForfait):
    def setUp(self):
        super().setUp()
        self.donner_stats(points=30)
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        self.declarer('exterieur')

    def test_absent_de_la_carriere(self):
        carriere = profil_athlete(self.joueur.athlete)['carriere']
        self.assertEqual((carriere['matchs'], carriere['points'], carriere['mvp']), (0, 0, 0))

    def test_absent_du_top_joueurs(self):
        self.assertEqual(meilleurs_joueurs(self.tournoi), [])

    def test_ne_compte_pas_dans_la_moitie_des_matchs_de_l_equipe(self):
        joue = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext)
        self.donner_stats(match=joue, points=10)
        self.terminer(joue)
        meilleur = meilleurs_joueurs(self.tournoi)[0]
        self.assertEqual((meilleur['nb_matchs'], meilleur['moyenne_eval']), (1, 10.0))
        self.assertEqual(profil_athlete(self.joueur.athlete)['carriere']['moyennes']['points'], 10.0)

    def test_pas_de_mvp_sur_le_match(self):
        self.assertIsNone(self.client.get(f'/api/matchs/{self.match.id}/').data['mvp'])

    def test_pas_de_presences(self):
        url = f'/api/matchs/{self.match.id}/presences/'
        self.assertEqual(self.client.get(url).data, [])
        reponse = self.client.post(url, {'presents': [self.adverse.id]}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_les_stats_reviennent_apres_annulation(self):
        self.client.delete(self.url)
        self.terminer()
        self.assertEqual(profil_athlete(self.joueur.athlete)['carriere']['points'], 30)


class ForfaitGeneralTests(BaseForfait):
    def setUp(self):
        super().setUp()
        self.url_general = f'/api/equipes/{self.dom.id}/forfait_general/'
        self.autre = Equipe.objects.create(nom='C', tournoi=self.tournoi)

    def test_tous_les_matchs_restants_sont_perdus(self):
        en_cours = Match.objects.create(
            tournoi=self.tournoi, equipe_domicile=self.autre, equipe_exterieur=self.dom, statut='en_cours',
        )
        reponse = self.client.post(self.url_general)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['matchs'], 2)
        self.match.refresh_from_db()
        en_cours.refresh_from_db()
        self.assertEqual((self.match.forfait, self.match.score_exterieur), ('domicile', 20))
        self.assertEqual((en_cours.forfait, en_cours.score_domicile), ('exterieur', 20))

    def test_les_matchs_termines_ne_changent_pas(self):
        joue = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.autre)
        self.terminer(joue)
        self.client.post(self.url_general)
        joue.refresh_from_db()
        self.assertEqual((joue.forfait, joue.score_domicile), ('', 10))

    def test_serie_perdue_jusqu_au_bout(self):
        self.activer_finale(victoires=2)
        self.terminer()
        self.match_final('finale')
        self.assertEqual(self.client.post(self.url_general).data['matchs'], 2)
        serie = series_de_la_phase(self.tournoi, 'finale')[0]
        self.assertEqual(serie['vainqueur'], self.ext.id)

    def test_refuse_sans_match_restant(self):
        self.terminer()
        self.assertEqual(self.client.post(self.url_general).status_code, status.HTTP_400_BAD_REQUEST)

    def test_reserve_a_l_organisateur(self):
        self.client.force_authenticate(User.objects.create_user('autre', password='motdepasse-solide-42'))
        self.assertEqual(self.client.post(self.url_general).status_code, status.HTTP_403_FORBIDDEN)
