from rest_framework import status

from tournois.models import ActionMatch, Joueur, Match, StatistiqueJoueur

from .test_api import BaseAPITestCase


class HistoriqueTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.orga)
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        self.url = f'/api/matchs/{self.match.id}/'
        self.stat_ext = StatistiqueJoueur.objects.create(
            joueur=Joueur.objects.create(prenom='Paul', nom='Martin', numero_maillot=7, equipe=self.ext),
            match=self.match,
        )

    def saisir(self, champ, action='increment', valeur=1, stat=None):
        stat = stat or self.stat
        return self.client.patch(
            f'{self.url}stats/{stat.id}/update/', {'champ': champ, 'action': action, 'valeur': valeur}, format='json',
        )

    def annuler(self):
        return self.client.post(f'{self.url}annuler_derniere_action/')

    def etat(self):
        return self.client.get(self.url).data

    def test_chaque_action_est_enregistree(self):
        self.saisir('points', valeur=3)
        self.saisir('points', action='decrement', valeur=5)  # seuls 3 points sont réellement retirés
        self.saisir('passes', action='decrement')  # déjà à 0 : rien n'est enregistré
        actions = self.client.get(f'{self.url}actions/').data
        self.assertEqual([(a['champ'], a['valeur']) for a in actions], [('points', -3), ('points', 3)])
        self.assertEqual(actions[0]['periode'], 1)
        self.assertEqual(actions[0]['joueur_libelle'], '#4 Jean Dupont')
        self.assertEqual(actions[0]['cote'], 'domicile')

    def test_annuler_les_dernieres_actions(self):
        self.saisir('points', valeur=2)
        self.saisir('points', valeur=3, stat=self.stat_ext)
        self.assertEqual(self.etat()['derniere_action']['valeur'], 3)

        data = self.annuler().data
        self.assertEqual((data['score_domicile'], data['score_exterieur']), (2, 0))
        self.assertEqual(data['derniere_action']['valeur'], 2)
        data = self.annuler().data
        self.assertEqual((data['score_domicile'], data['score_exterieur']), (0, 0))
        self.assertIsNone(data['derniere_action'])
        self.assertEqual(self.annuler().status_code, status.HTTP_400_BAD_REQUEST)

        actions = self.client.get(f'{self.url}actions/').data
        self.assertTrue(all(a['annulee'] for a in actions))  # toujours visibles dans l'historique

    def test_annuler_une_faute_corrige_les_fautes_d_equipe(self):
        self.saisir('fautes')
        self.saisir('fautes')
        self.assertEqual(self.etat()['fautes_domicile'], 2)
        self.annuler()
        self.assertEqual(self.etat()['fautes_domicile'], 1)
        self.stat.refresh_from_db()
        self.assertEqual(self.stat.fautes, 1)

    def test_faute_d_une_periode_precedente(self):
        self.saisir('fautes')
        self.client.post(f'{self.url}periode_suivante/')
        self.saisir('fautes', stat=self.stat_ext)
        self.annuler()  # faute extérieure de la 2e période
        self.assertEqual(self.etat()['fautes_exterieur'], 0)
        data = self.annuler().data  # faute domicile de la 1re période : le changement de période est sauté
        self.assertEqual(data['fautes_domicile'], 0)
        self.stat.refresh_from_db()
        self.assertEqual(self.stat.fautes, 0)
        self.assertEqual(data['periode_actuelle'], 2)

    def test_annuler_un_temps_mort(self):
        self.client.post(f'{self.url}temps_mort/', {'equipe': 'exterieur'})
        self.assertEqual(self.etat()['temps_morts_exterieur'], 1)
        self.assertEqual(self.annuler().data['temps_morts_exterieur'], 2)

    def test_verrous(self):
        self.saisir('points', valeur=2)
        Match.objects.filter(pk=self.match.pk).update(statut='termine')
        self.assertEqual(self.annuler().status_code, status.HTTP_400_BAD_REQUEST)

        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        self.client.force_authenticate(self.intrus)
        self.assertEqual(self.annuler().status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(ActionMatch.objects.filter(annulee=True).exists())

    def test_historique_public(self):
        self.saisir('points', valeur=2)
        self.client.force_authenticate(None)
        self.assertEqual(len(self.client.get(f'{self.url}actions/').data), 1)
