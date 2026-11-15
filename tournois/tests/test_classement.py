from django.test import SimpleTestCase

from tournois.classement import calculer_classement

EQUIPES = [(1, 'Alpha'), (2, 'Bravo'), (3, 'Charlie'), (4, 'Delta')]


def ordre(scores, equipes=EQUIPES):
    return [e['nom'] for e in calculer_classement(equipes, scores)]


class ClassementFibaTests(SimpleTestCase):
    def test_victoire_2_points_defaite_1_point(self):
        classement = calculer_classement(EQUIPES[:2], [(1, 2, 80, 70)])
        self.assertEqual([(e['nom'], e['points'], e['gagnes'], e['perdus']) for e in classement],
                         [('Alpha', 2, 1, 0), ('Bravo', 1, 0, 1)])
        self.assertEqual(classement[0]['difference'], 10)

    def test_confrontation_directe_avant_la_difference_generale(self):
        # Bravo et Charlie : 1 victoire, 1 défaite chacun. Charlie a une bien meilleure différence
        # générale, mais Bravo a battu Charlie : Bravo passe devant.
        scores = [
            (2, 3, 61, 60),   # Bravo bat Charlie
            (3, 4, 100, 50),  # Charlie écrase Delta
            (1, 2, 70, 60),   # Alpha bat Bravo
            (1, 4, 70, 60),   # Alpha bat Delta
        ]
        self.assertEqual(ordre(scores), ['Alpha', 'Bravo', 'Charlie', 'Delta'])

    def test_egalite_a_trois_departagee_par_la_difference_entre_elles(self):
        # Alpha, Bravo, Charlie se battent en cercle : on regarde la différence dans ces 3 matchs
        scores = [
            (1, 2, 80, 70),  # Alpha +10
            (2, 3, 90, 70),  # Bravo +20
            (3, 1, 75, 70),  # Charlie +5
        ]
        # Différences entre elles : Alpha +5, Bravo +10, Charlie -15
        self.assertEqual(ordre(scores, EQUIPES[:3]), ['Bravo', 'Alpha', 'Charlie'])

    def test_on_recommence_a_la_confrontation_directe_pour_les_equipes_restantes(self):
        # Égalité à 3 : la différence entre elles sépare Charlie (-10), mais Alpha et Bravo restent
        # à +5. On repart alors de leur match direct (Alpha l'a gagné), même si Bravo a marqué plus.
        scores = [
            (1, 2, 70, 60),   # Alpha bat Bravo (+10)
            (2, 3, 100, 85),  # Bravo bat Charlie (+15)
            (3, 1, 65, 60),   # Charlie bat Alpha (+5)
        ]
        self.assertEqual(ordre(scores, EQUIPES[:3]), ['Alpha', 'Bravo', 'Charlie'])

    def test_match_nul_ignore(self):
        classement = calculer_classement(EQUIPES[:2], [(1, 2, 70, 70)])
        self.assertTrue(all(e['joues'] == 0 for e in classement))

    def test_egalite_parfaite_ordre_alphabetique(self):
        self.assertEqual(ordre([], [(2, 'bravo'), (1, 'Alpha')]), ['Alpha', 'bravo'])
