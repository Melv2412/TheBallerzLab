from rest_framework import status

from tournois.models import Equipe, Joueur, Match, StatistiqueJoueur

from .test_protection_resultats import BaseProtection


class JoueurInscritPendantLeMatchTests(BaseProtection):
    def setUp(self):
        super().setUp()
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        self.client.post(f'/api/matchs/{self.match.id}/initialiser_stats/')

    def inscrire(self, numero=9):
        reponse = self.client.post('/api/joueurs/', {
            'prenom': 'Tard', 'nom': 'Venu', 'numero_maillot': numero, 'equipe': self.dom.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        return Joueur.objects.get(pk=reponse.data['id'])

    def test_joueur_ajoute_apparait_dans_le_match_en_cours(self):
        joueur = self.inscrire()
        self.assertTrue(StatistiqueJoueur.objects.filter(joueur=joueur, match=self.match).exists())
        ids = [s['joueur'] for s in self.client.get(f'/api/matchs/{self.match.id}/').data['statistiques']]
        self.assertIn(joueur.id, ids)

    def test_matchs_non_lances_ou_termines_pas_touches(self):
        a_venir = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext)
        Match.objects.filter(pk=self.match.pk).update(statut='termine')
        joueur = self.inscrire()
        self.assertFalse(StatistiqueJoueur.objects.filter(joueur=joueur).exists())
        self.assertFalse(a_venir.statistiques_joueurs.exists())

    def test_stats_pas_encore_activees(self):
        StatistiqueJoueur.objects.filter(match=self.match).delete()
        joueur = self.inscrire()
        self.assertFalse(StatistiqueJoueur.objects.filter(joueur=joueur).exists())

    def test_joueur_reintegre_revient_dans_le_match(self):
        joueur = self.inscrire()
        StatistiqueJoueur.objects.filter(joueur=joueur).delete()
        Joueur.objects.filter(pk=joueur.pk).update(retire=True)
        joueur.refresh_from_db()
        joueur.retire = False
        joueur.save(update_fields=['retire', 'updated_at'])
        self.assertTrue(StatistiqueJoueur.objects.filter(joueur=joueur, match=self.match).exists())

    def test_les_ecrans_sont_prevenus(self):
        avant = Match.objects.get(pk=self.match.pk).updated_at
        self.inscrire()
        self.assertGreater(Match.objects.get(pk=self.match.pk).updated_at, avant)

    def test_changement_d_equipe_retire_la_fiche_vide(self):
        joueur = self.inscrire()
        autre = Equipe.objects.create(nom='C', tournoi=self.tournoi)
        reponse = self.client.patch(f'/api/joueurs/{joueur.id}/', {'equipe': autre.id})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertFalse(StatistiqueJoueur.objects.filter(joueur=joueur, match=self.match).exists())

    def test_changement_vers_l_equipe_adverse_garde_le_joueur_dans_le_match(self):
        joueur = self.inscrire()
        joueur.equipe = self.ext
        joueur.numero_maillot = 33
        joueur.save()
        self.assertTrue(StatistiqueJoueur.objects.filter(joueur=joueur, match=self.match).exists())

    def test_match_termine_garde_ses_fiches(self):
        joueur = self.inscrire()
        Match.objects.filter(pk=self.match.pk).update(statut='termine')
        joueur.equipe = Equipe.objects.create(nom='C', tournoi=self.tournoi)
        joueur.save()
        self.assertTrue(StatistiqueJoueur.objects.filter(joueur=joueur, match=self.match).exists())

    def test_pas_de_doublon(self):
        joueur = self.inscrire()
        joueur.save()
        self.assertEqual(StatistiqueJoueur.objects.filter(joueur=joueur, match=self.match).count(), 1)
