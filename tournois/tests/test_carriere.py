from datetime import date

from rest_framework import status

from tournois.carriere import resultat_equipe
from tournois.models import Equipe, Joueur, Match, StatistiqueJoueur, Tournoi

from .test_api import BaseAPITestCase


class ProfilAthleteTests(BaseAPITestCase):
    """Page profil : cumul de carrière sur plusieurs tournois, MVP et palmarès."""

    def setUp(self):
        super().setUp()
        self.fiche = self.joueur.athlete
        self.adverse = Joueur.objects.create(prenom='Paul', nom='Martin', numero_maillot=7, equipe=self.ext)
        # Finale gagnée par l'équipe de Jean : 20 points, il est MVP
        self.match.phase = 'finale'
        self.match.statut = 'termine'
        self.match.score_domicile, self.match.score_exterieur = 20, 10
        self.match.save()
        self.stat.points, self.stat.rebonds = 20, 4
        self.stat.save()
        StatistiqueJoueur.objects.create(joueur=self.adverse, match=self.match, points=10)

        # Deuxième tournoi, plus récent, même athlète : un match terminé et un match à venir (non compté)
        t2 = Tournoi.objects.create(
            nom='Été', organisateur=self.intrus, date_debut=date(2026, 6, 1), date_fin=date(2026, 6, 2),
        )
        e1, e2 = Equipe.objects.create(nom='X', tournoi=t2), Equipe.objects.create(nom='Y', tournoi=t2)
        self.ailleurs = Joueur.objects.create(
            prenom='Jean', nom='Dupont', numero_maillot=9, equipe=e1, athlete=self.fiche,
        )
        termine = Match.objects.create(
            tournoi=t2, equipe_domicile=e1, equipe_exterieur=e2, statut='termine', score_domicile=10, score_exterieur=12,
        )
        a_venir = Match.objects.create(tournoi=t2, equipe_domicile=e1, equipe_exterieur=e2)
        StatistiqueJoueur.objects.create(joueur=self.ailleurs, match=termine, points=10, passes=2, fautes=3)
        StatistiqueJoueur.objects.create(joueur=self.ailleurs, match=a_venir, points=50)
        rival = Joueur.objects.create(prenom='R', nom='V', numero_maillot=1, equipe=e2)
        StatistiqueJoueur.objects.create(joueur=rival, match=termine, points=12, rebonds=5)

    def test_profil_public_avec_cumul_et_palmares(self):
        self.client.force_authenticate(None)
        reponse = self.client.get(f'/api/athletes/{self.fiche.id}/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        carriere = reponse.data['carriere']
        self.assertEqual((carriere['matchs'], carriere['points'], carriere['passes']), (2, 30, 2))
        self.assertEqual(carriere['moyennes']['points'], 15.0)
        self.assertEqual((carriere['tournois'], carriere['mvp'], carriere['titres']), (2, 1, 1))
        self.assertNotIn('email', reponse.data)

        recent, ancien = reponse.data['tournois']  # le plus récent d'abord
        self.assertEqual((recent['tournoi_nom'], recent['numero'], recent['matchs']), ('Été', 9, 1))
        self.assertEqual(recent['resultat']['code'], 'poule')
        self.assertEqual((ancien['tournoi_nom'], ancien['mvp']), ('Interpromo', 1))
        self.assertEqual(ancien['resultat'], {'code': 'champion', 'libelle': 'Champion'})

    def test_stats_du_match_menent_au_profil(self):
        reponse = self.client.get(f'/api/matchs/{self.match.id}/')
        athletes = {s['joueur']: s['athlete'] for s in reponse.data['statistiques']}
        self.assertEqual(athletes[self.joueur.id], self.fiche.id)

    def test_pas_de_liste_des_athletes(self):
        self.assertEqual(self.client.get('/api/athletes/').status_code, status.HTTP_404_NOT_FOUND)

    def test_resultats_du_tableau_final(self):
        self.assertEqual(resultat_equipe(self.tournoi, self.ext.id)['libelle'], 'Finaliste')
        self.match.statut = 'en_cours'
        self.match.save()
        self.assertEqual(resultat_equipe(self.tournoi, self.dom.id)['libelle'], 'En finale')
        self.tournoi.has_demis = True
        self.tournoi.save()
        demi = Match.objects.create(
            tournoi=self.tournoi, phase='demi', equipe_domicile=self.autre_equipe, equipe_exterieur=self.dom,
            statut='termine', score_domicile=5, score_exterieur=8,
        )
        self.assertEqual(resultat_equipe(self.tournoi, demi.equipe_domicile_id)['libelle'], 'Éliminé en demi-finale')
