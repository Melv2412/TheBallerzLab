from rest_framework import status

from tournois.models import ActionMatch, Joueur, StatistiqueJoueur

from .test_api import BaseAPITestCase


class SaisieFeuilleTests(BaseAPITestCase):
    """Feuille de match saisie après coup : totaux de chaque joueur et score par période."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)
        self.adverse = Joueur.objects.create(prenom='Paul', nom='Martin', numero_maillot=7, equipe=self.ext)
        self.url = f'/api/matchs/{self.match.id}/saisie_feuille/'

    def saisir(self, **donnees):
        donnees.setdefault('stats', [
            {'joueur': self.joueur.id, 'points': 20, 'rebonds': 5, 'fautes': 2},
            {'joueur': self.adverse.id, 'points': 15, 'passes': 3},
        ])
        return self.client.post(self.url, donnees, format='json')

    def test_saisie_complete_avec_periodes_et_fin_du_match(self):
        reponse = self.saisir(
            score_periodes={'domicile': [5, 5, 5, 5], 'exterieur': [4, 4, 4, 3]}, terminer=True,
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual((reponse.data['score_domicile'], reponse.data['score_exterieur']), (20, 15))
        self.assertEqual(reponse.data['statut'], 'termine')
        self.assertEqual(reponse.data['score_periodes'], {'domicile': [5, 5, 5, 5], 'exterieur': [4, 4, 4, 3]})
        self.assertEqual(StatistiqueJoueur.objects.get(joueur=self.adverse, match=self.match).passes, 3)
        self.stat.refresh_from_db()
        self.assertEqual((self.stat.points, self.stat.rebonds, self.stat.fautes, self.stat.passes), (20, 5, 2, 0))

    def test_sans_periodes_le_match_passe_en_cours(self):
        reponse = self.saisir()
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['statut'], 'en_cours')
        self.assertIsNone(reponse.data['score_periodes'])

    def test_periodes_qui_ne_correspondent_pas_au_score(self):
        reponse = self.saisir(score_periodes={'domicile': [5, 5, 5, 4], 'exterieur': [4, 4, 4, 3]})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('19', str(reponse.data))
        self.stat.refresh_from_db()
        self.assertEqual(self.stat.points, 0)  # rien n'est enregistré

    def test_periodes_de_longueurs_differentes_ou_trop_courtes(self):
        reponse = self.saisir(score_periodes={'domicile': [10, 10], 'exterieur': [5, 5, 5]})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        reponse = self.saisir(score_periodes={'domicile': [10, 10], 'exterieur': [10, 5]})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)  # 4 périodes au règlement

    def test_prolongation_acceptee(self):
        reponse = self.saisir(score_periodes={'domicile': [5, 5, 5, 0, 5], 'exterieur': [5, 5, 5, 0, 0]})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)

    def test_match_nul_ne_peut_pas_etre_termine(self):
        reponse = self.saisir(
            stats=[{'joueur': self.joueur.id, 'points': 10}, {'joueur': self.adverse.id, 'points': 10}], terminer=True,
        )
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.match.refresh_from_db()
        self.assertEqual((self.match.statut, self.match.score_domicile), ('a_venir', 0))

    def test_joueur_d_une_autre_equipe_refuse(self):
        etranger = Joueur.objects.create(prenom='E', nom='T', numero_maillot=1, equipe=self.autre_equipe)
        reponse = self.saisir(stats=[{'joueur': etranger.id, 'points': 2}])
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(StatistiqueJoueur.objects.filter(joueur=etranger).exists())

    def test_fautes_au_dela_de_l_exclusion_refusees(self):
        reponse = self.saisir(stats=[{'joueur': self.joueur.id, 'fautes': 6}])
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_match_termine_refuse_et_intrus_refuse(self):
        self.saisir(terminer=True)
        self.assertEqual(self.saisir().status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(self.intrus)
        self.assertEqual(self.saisir().status_code, status.HTTP_403_FORBIDDEN)

    def test_les_actions_en_direct_sont_annulees(self):
        url_stat = f'/api/matchs/{self.match.id}/stats/{self.stat.id}/update/'
        self.client.patch(url_stat, {'champ': 'points', 'action': 'increment', 'valeur': 3})
        self.saisir()
        self.assertFalse(ActionMatch.objects.filter(match=self.match, type='stat', annulee=False).exists())
        reponse = self.client.post(f'/api/matchs/{self.match.id}/annuler_derniere_action/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)  # rien à annuler
        self.stat.refresh_from_db()
        self.assertEqual(self.stat.points, 20)

    def test_periodes_effacees_si_les_stats_changent_ensuite(self):
        self.saisir(score_periodes={'domicile': [5, 5, 5, 5], 'exterieur': [4, 4, 4, 3]})
        url_stat = f'/api/matchs/{self.match.id}/stats/{self.stat.id}/update/'
        self.client.patch(url_stat, {'champ': 'points', 'action': 'increment', 'valeur': 2})
        self.match.refresh_from_db()
        self.assertIsNone(self.match.score_periodes)
