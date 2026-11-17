from datetime import date

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.models import Equipe, Joueur, Match, StatistiqueJoueur, Tournoi


class PhasesFinalesTests(APITestCase):
    """Demi-finales au meilleur des 3, puis finale sur un match. Sans poule : seeding A, B, C, D."""

    def setUp(self):
        self.orga = User.objects.create_user('orga', password='motdepasse-solide-42')
        self.client.force_authenticate(self.orga)
        self.tournoi = Tournoi.objects.create(
            nom='Coupe', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 31),
            has_demis=True, has_finale=True, victoires_requises_demi=2,
        )
        self.equipes = {nom: Equipe.objects.create(nom=nom, tournoi=self.tournoi) for nom in 'ABCD'}
        self.joueurs = {
            nom: Joueur.objects.create(prenom='J', nom=nom, numero_maillot=1, equipe=equipe)
            for nom, equipe in self.equipes.items()
        }
        self.url = '/api/tournois/coupe/'

    def generer(self):
        return self.client.post(f'{self.url}generer_phases_finales/')

    def matchs(self, phase):
        return list(Match.objects.filter(tournoi=self.tournoi, phase=phase).order_by('created_at', 'id'))

    def affiche(self, match):
        return f'{match.equipe_domicile.nom}-{match.equipe_exterieur.nom}'

    def gagner(self, match, nom):
        StatistiqueJoueur.objects.create(joueur=self.joueurs[nom], match=match, points=2)
        reponse = self.client.patch(f'/api/matchs/{match.id}/', {'statut': 'termine'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)

    def en_attente(self, phase):
        return sorted(self.affiche(m) for m in self.matchs(phase) if m.statut != 'termine')

    def prochain(self, equipes):
        """Premier match pas encore terminé entre ces deux équipes (ex. 'AD')."""
        ids = {self.equipes[nom].id for nom in equipes}
        return next(
            m for m in Match.objects.filter(tournoi=self.tournoi).exclude(statut='termine').order_by('created_at', 'id')
            if {m.equipe_domicile_id, m.equipe_exterieur_id} == ids
        )

    def test_premier_tour_d_apres_le_classement(self):
        self.assertEqual(self.generer().status_code, status.HTTP_201_CREATED)
        self.assertEqual([self.affiche(m) for m in self.matchs('demi')], ['A-D', 'B-C'])
        self.assertEqual(self.generer().status_code, status.HTTP_400_BAD_REQUEST)  # déjà générées

    def test_poule_non_terminee(self):
        Match.objects.create(
            tournoi=self.tournoi, equipe_domicile=self.equipes['A'], equipe_exterieur=self.equipes['B'],
        )
        reponse = self.generer()
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('poule', reponse.data['detail'])

    def test_serie_puis_finale(self):
        self.generer()
        demi_a, demi_b = self.matchs('demi')

        self.gagner(demi_a, 'A')
        self.assertEqual(self.en_attente('demi'), ['B-C', 'D-A'])  # match 2 de la série : domicile inversé
        self.gagner(self.prochain('AD'), 'A')
        self.assertEqual(self.matchs('finale'), [])  # l'autre demi-finale n'est pas jouée

        self.gagner(demi_b, 'C')
        self.gagner(self.prochain('BC'), 'B')  # 1-1
        self.assertEqual(self.en_attente('demi'), ['B-C'])  # belle
        self.gagner(self.prochain('BC'), 'B')

        self.assertEqual([self.affiche(m) for m in self.matchs('finale')], ['A-B'])
        resume = self.client.get(f'{self.url}phases_finales/').data
        demis = resume[0]['series']
        self.assertEqual([(s['equipes'][0]['victoires'], s['equipes'][1]['victoires']) for s in demis], [(2, 0), (2, 1)])
        self.assertEqual(demis[1]['vainqueur'], self.equipes['B'].id)

        self.gagner(self.matchs('finale')[0], 'B')
        self.assertEqual(len(self.matchs('finale')), 1)  # finale sur un seul match : rien de plus à créer

    def test_match_devenu_inutile_supprime(self):
        self.generer()
        demi_a = self.matchs('demi')[0]
        self.gagner(demi_a, 'A')
        manuel = Match.objects.create(
            tournoi=self.tournoi, phase='demi', equipe_domicile=self.equipes['A'], equipe_exterieur=self.equipes['D'],
        )
        self.gagner(self.prochain('AD'), 'A')  # série gagnée 2-0 (le match 2 a été créé avant le match manuel)
        self.assertFalse(Match.objects.filter(pk=manuel.pk).exists())

    def test_reouverture_bloquee_si_la_phase_suivante_a_commence(self):
        self.tournoi.victoires_requises_demi = 1
        self.tournoi.save()
        self.generer()
        demi_a, demi_b = self.matchs('demi')
        self.gagner(demi_a, 'A')
        self.gagner(demi_b, 'B')
        self.assertEqual(len(self.matchs('finale')), 1)

        reponse = self.client.patch(f'/api/matchs/{demi_a.id}/', {'statut': 'en_cours'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.post(f'{self.url}reset_playoffs/', {'phase': 'finale'})
        reponse = self.client.patch(f'/api/matchs/{demi_a.id}/', {'statut': 'en_cours'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_phases_non_consecutives_refusees(self):
        reponse = self.client.patch(self.url, {'has_demis': False, 'has_quarts': True}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('suivre', str(reponse.data))
        reponse = self.client.patch(self.url, {'has_finale': False}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('finale', str(reponse.data))

        reponse = self.client.post('/api/tournois/', {
            'nom': 'Trou', 'date_debut': '2026-02-01', 'date_fin': '2026-02-02', 'has_quarts': True,
        }, format='json')  # quarts + finale (par défaut), sans demi-finales
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

        reponse = self.client.patch(self.url, {'has_quarts': True}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        reponse = self.client.patch(self.url, {'nom': 'Coupe 2'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)

    def test_ancien_tableau_avec_un_trou_ne_cree_pas_deux_finales(self):
        """Tournoi enregistré avant la validation : quarts puis finale directement."""
        Tournoi.objects.filter(pk=self.tournoi.pk).update(has_demis=False, has_quarts=True, victoires_requises_quart=1)
        self.tournoi.refresh_from_db()
        for nom in 'EFGH':
            equipe = Equipe.objects.create(nom=nom, tournoi=self.tournoi)
            self.joueurs[nom] = Joueur.objects.create(prenom='J', nom=nom, numero_maillot=1, equipe=equipe)
        self.assertEqual(self.generer().status_code, status.HTTP_201_CREATED)
        for match in self.matchs('quart'):
            self.gagner(match, match.equipe_domicile.nom)
        self.assertEqual(self.matchs('finale'), [])

    def test_le_tournoi_est_verrouille_avant_de_toucher_au_tableau(self):
        """SQLite ignore les verrous : on vérifie qu'ils sont demandés (ils agissent en prod, sur Postgres)."""
        from unittest.mock import patch

        from tournois import phases_finales, views

        original = phases_finales.verrouiller_tournoi
        with patch.object(phases_finales, 'verrouiller_tournoi', wraps=original) as verrou:
            self.generer()
            self.assertEqual(verrou.call_count, 1)
            with patch.object(views, 'verrouiller_tournoi', wraps=original) as verrou_vue:
                self.gagner(self.matchs('demi')[0], 'A')
                self.client.post(f'{self.url}reset_playoffs/', {})
            self.assertEqual(verrou.call_count, 2)  # avancer_phases_finales
            self.assertEqual(verrou_vue.call_count, 2)  # match terminé, puis reset_playoffs

    def test_reserve_a_l_organisateur(self):
        self.client.force_authenticate(User.objects.create_user('intrus', password='motdepasse-solide-42'))
        self.assertEqual(self.generer().status_code, status.HTTP_403_FORBIDDEN)
