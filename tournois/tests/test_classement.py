from django.test import SimpleTestCase

from tournois.classement import analyser_classement, calculer_classement

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


def ordre_pourcentage(scores, equipes=EQUIPES):
    classement, _ = analyser_classement(equipes, scores, mode='pourcentage')
    return [e['nom'] for e in classement]


class ClassementPourcentageTests(SimpleTestCase):
    def test_un_sur_un_devant_une_victoire_une_defaite(self):
        # Alpha 1V-1D (3 pts en FIBA), Bravo 1V-0D (2 pts) : au %, Bravo passe devant
        scores = [(1, 3, 70, 60), (4, 1, 80, 60), (2, 3, 65, 60)]
        self.assertEqual(ordre(scores)[:2], ['Alpha', 'Bravo'])
        self.assertEqual(ordre_pourcentage(scores), ['Delta', 'Bravo', 'Alpha', 'Charlie'])

    def test_equipe_sans_match_classee_apres_celles_qui_ont_joue(self):
        # Delta n'a pas joué ; Charlie a tout perdu mais passe quand même devant
        scores = [(1, 3, 70, 60), (2, 3, 70, 60)]
        classement, _ = analyser_classement(EQUIPES, scores, mode='pourcentage')
        self.assertEqual([e['nom'] for e in classement], ['Alpha', 'Bravo', 'Charlie', 'Delta'])
        self.assertEqual([e['pourcentage'] for e in classement], [100, 100, 0, None])

    def test_egalite_departagee_par_la_difference_generale_sans_confrontation_directe(self):
        # Même cas que la confrontation directe en FIBA : au %, Charlie passe devant Bravo à la différence
        scores = [(2, 3, 61, 60), (3, 4, 100, 50), (1, 2, 70, 60), (1, 4, 70, 60)]
        self.assertEqual(ordre_pourcentage(scores), ['Alpha', 'Charlie', 'Bravo', 'Delta'])

    def test_puis_les_points_marques(self):
        # Alpha et Bravo à 100 % et +10 chacun : Alpha a marqué plus
        scores = [(1, 3, 90, 80), (2, 4, 60, 50)]
        self.assertEqual(ordre_pourcentage(scores)[:2], ['Alpha', 'Bravo'])

    def test_forfait_compte_comme_defaite_avec_son_score(self):
        # Bravo gagne par forfait 20-0, Alpha gagne de 5 : tous deux à 100 %, Bravo devant à la différence
        scores = [(2, 3, 20, 0, 'exterieur'), (1, 4, 65, 60)]
        classement, _ = analyser_classement(EQUIPES, scores, mode='pourcentage')
        self.assertEqual([e['nom'] for e in classement], ['Bravo', 'Alpha', 'Delta', 'Charlie'])
        charlie = classement[-1]
        self.assertEqual((charlie['perdus'], charlie['difference'], charlie['pourcentage']), (1, -20, 0))

    def test_pourcentage_arrondi_mais_ordre_exact(self):
        # 2 sur 3 (67 %) devant 1 sur 2 (50 %)
        scores = [(1, 2, 70, 60), (1, 3, 70, 60), (4, 1, 70, 60), (2, 3, 70, 60)]
        classement, _ = analyser_classement(EQUIPES, scores, mode='pourcentage')
        self.assertEqual(classement[0]['nom'], 'Delta')
        self.assertEqual((classement[1]['nom'], classement[1]['pourcentage']), ('Alpha', 67))
