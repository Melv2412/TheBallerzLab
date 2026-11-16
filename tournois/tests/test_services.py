from types import SimpleNamespace

from django.test import SimpleTestCase

from tournois.services import mvp_du_match


def stat(nom, points=0, passes=0, rebonds=0, contres=0, fautes=0):
    joueur = SimpleNamespace(prenom='P', nom=nom, numero_maillot=1, equipe=SimpleNamespace(nom='E'))
    return SimpleNamespace(joueur=joueur, points=points, passes=passes, rebonds=rebonds, contres=contres, fautes=fautes)


class MvpDuMatchTests(SimpleTestCase):
    def test_meilleure_evaluation(self):
        mvp = mvp_du_match([stat('A', points=10), stat('B', points=8, passes=4), stat('C', points=20, fautes=5)])
        self.assertEqual((mvp['nom'], mvp['evaluation']), ('P C', 15))

    def test_egalite_premier_joueur_garde(self):
        self.assertEqual(mvp_du_match([stat('A', points=4), stat('B', rebonds=4)])['nom'], 'P A')

    def test_aucune_evaluation_positive(self):
        self.assertIsNone(mvp_du_match([stat('A'), stat('B', fautes=2)]))
        self.assertIsNone(mvp_du_match([]))
