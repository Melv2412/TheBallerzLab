from django.contrib.auth.models import User
from rest_framework import status

from tournois.carriere import profil_athlete
from tournois.models import Joueur, Match, StatistiqueJoueur
from tournois.services import meilleurs_joueurs

from .test_protection_resultats import BaseProtection


class BasePresences(BaseProtection):
    def setUp(self):
        super().setUp()
        self.url = f'/api/matchs/{self.match.id}/presences/'

    def ligne_vide(self, joueur=None, match=None, **valeurs):
        return StatistiqueJoueur.objects.create(joueur=joueur or self.joueur, match=match or self.match, **valeurs)

    def second_match(self):
        match = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext)
        self.terminer(match)
        return match


class MoyennesTests(BasePresences):
    def setUp(self):
        super().setUp()
        self.donner_stats(points=10)
        self.terminer()
        self.autre_match = self.second_match()

    def test_ligne_a_zero_ne_compte_pas_comme_match_joue(self):
        self.ligne_vide(match=self.autre_match)
        carriere = profil_athlete(self.joueur.athlete)['carriere']
        self.assertEqual(carriere['matchs'], 1)
        self.assertEqual(carriere['moyennes']['points'], 10.0)

    def test_presence_confirmee_compte_dans_la_moyenne(self):
        self.ligne_vide(match=self.autre_match, presence_confirmee=True)
        profil = profil_athlete(self.joueur.athlete)
        self.assertEqual(profil['carriere']['matchs'], 2)
        self.assertEqual(profil['carriere']['moyennes']['points'], 5.0)
        self.assertEqual(profil['tournois'][0]['matchs'], 2)

    def test_top_joueurs_ignore_les_absents(self):
        self.ligne_vide(match=self.autre_match)
        meilleur = meilleurs_joueurs(self.tournoi)[0]
        self.assertEqual((meilleur['nb_matchs'], meilleur['moyenne_eval']), (1, 10.0))

    def test_top_joueurs_compte_les_presents(self):
        self.ligne_vide(match=self.autre_match, presence_confirmee=True)
        meilleur = meilleurs_joueurs(self.tournoi)[0]
        self.assertEqual((meilleur['nb_matchs'], meilleur['moyenne_eval']), (2, 5.0))

    def test_absences_ne_valident_pas_le_seuil_du_top(self):
        troisieme = self.second_match()
        self.ligne_vide(match=self.autre_match)
        self.ligne_vide(match=troisieme)
        self.assertEqual(meilleurs_joueurs(self.tournoi), [])  # 1 match joué sur 3 pour son équipe

    def test_retire_absent_sort_du_parcours(self):
        remplacant = Joueur.objects.create(prenom='Leo', nom='Roy', numero_maillot=9, equipe=self.dom, retire=True)
        self.ligne_vide(joueur=remplacant)
        self.assertEqual(profil_athlete(remplacant.athlete)['tournois'], [])


class ListePresencesTests(BasePresences):
    def setUp(self):
        super().setUp()
        self.donner_stats(points=10)
        self.terminer()

    def test_liste_uniquement_les_joueurs_sans_stat(self):
        self.ligne_vide(joueur=self.adverse)
        sans_ligne = Joueur.objects.create(prenom='Leo', nom='Roy', numero_maillot=9, equipe=self.dom)
        donnees = self.client.get(self.url).data
        self.assertEqual([j['joueur'] for j in donnees], [sans_ligne.id, self.adverse.id])  # domicile d'abord
        self.assertFalse(any(j['present'] for j in donnees))

    def test_retire_visible_seulement_s_il_a_une_ligne(self):
        Joueur.objects.create(prenom='Sans', nom='Ligne', numero_maillot=9, equipe=self.dom, retire=True)
        avec_ligne = Joueur.objects.create(prenom='Avec', nom='Ligne', numero_maillot=8, equipe=self.dom, retire=True)
        self.ligne_vide(joueur=avec_ligne)
        ids = [j['joueur'] for j in self.client.get(self.url).data]
        self.assertEqual(ids, [avec_ligne.id, self.adverse.id])


class EnregistrementPresencesTests(BasePresences):
    def setUp(self):
        super().setUp()
        self.ligne = self.ligne_vide(joueur=self.adverse)

    def envoyer(self, presents):
        return self.client.post(self.url, {'presents': presents}, format='json')

    def test_confirme_puis_corrige_sans_toucher_au_score(self):
        self.terminer()
        reponse = self.envoyer([self.adverse.id])
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertTrue(next(j for j in reponse.data if j['joueur'] == self.adverse.id)['present'])
        self.ligne.refresh_from_db()
        self.assertTrue(self.ligne.presence_confirmee)
        self.match.refresh_from_db()
        self.assertEqual((self.match.statut, self.match.score_domicile, self.match.score_exterieur), ('termine', 10, 2))

        self.assertEqual(self.envoyer([]).status_code, status.HTTP_200_OK)
        self.ligne.refresh_from_db()
        self.assertFalse(self.ligne.presence_confirmee)

    def test_cree_la_ligne_d_un_joueur_qui_n_en_a_pas(self):
        self.terminer()
        self.assertEqual(self.envoyer([self.joueur.id]).status_code, status.HTTP_200_OK)
        ligne = StatistiqueJoueur.objects.get(joueur=self.joueur, match=self.match)
        self.assertTrue(ligne.presence_confirmee)
        self.assertEqual(ligne.points, 0)

    def test_refuse_avant_la_fin_du_match(self):
        self.assertEqual(self.envoyer([self.adverse.id]).status_code, status.HTTP_400_BAD_REQUEST)

    def test_refuse_un_joueur_avec_des_stats_ou_hors_match(self):
        self.donner_stats()
        self.terminer()
        self.assertEqual(self.envoyer([self.joueur.id]).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.envoyer([999999]).status_code, status.HTTP_400_BAD_REQUEST)

    def test_reserve_a_l_organisateur(self):
        self.terminer()
        self.client.force_authenticate(User.objects.create_user('autre', password='motdepasse-solide-42'))
        self.assertEqual(self.envoyer([self.adverse.id]).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.envoyer([self.adverse.id]).status_code, status.HTTP_401_UNAUTHORIZED)


class PresenceProtegeeTests(BasePresences):
    def test_joueur_present_ne_se_supprime_pas(self):
        self.ligne_vide(presence_confirmee=True)
        self.terminer()
        reponse = self.client.delete(f'/api/joueurs/{self.joueur.id}/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Joueur.objects.filter(pk=self.joueur.pk).exists())

    def test_retrait_garde_la_presence_d_un_match_rouvert(self):
        ligne = self.ligne_vide(presence_confirmee=True)
        reponse = self.client.post(f'/api/joueurs/{self.joueur.id}/retirer/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertTrue(StatistiqueJoueur.objects.filter(pk=ligne.pk).exists())
