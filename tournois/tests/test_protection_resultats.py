from datetime import date

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.carriere import profil_athlete
from tournois.models import Athlete, Equipe, Joueur, Match, StatistiqueJoueur, Tournoi


class BaseProtection(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password='motdepasse-solide-42')
        self.tournoi = Tournoi.objects.create(
            nom='Coupe', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
        )
        self.dom = Equipe.objects.create(nom='A', tournoi=self.tournoi)
        self.ext = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        self.joueur = Joueur.objects.create(prenom='Jean', nom='Dupont', numero_maillot=4, equipe=self.dom)
        self.adverse = Joueur.objects.create(prenom='Paul', nom='Martin', numero_maillot=5, equipe=self.ext)
        self.match = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext)
        self.client.force_authenticate(self.orga)

    def donner_stats(self, joueur=None, match=None, points=2):
        return StatistiqueJoueur.objects.create(joueur=joueur or self.joueur, match=match or self.match, points=points)

    def terminer(self, match=None):
        match = match or self.match
        Match.objects.filter(pk=match.pk).update(statut='termine', score_domicile=10, score_exterieur=2)

    def match_final(self, phase='demi', statut='a_venir'):
        return Match.objects.create(
            tournoi=self.tournoi, phase=phase, equipe_domicile=self.dom, equipe_exterieur=self.ext, statut=statut,
        )


class SuppressionEquipeTests(BaseProtection):
    def test_equipe_avec_match_commence_conservee(self):
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        reponse = self.client.delete(f'/api/equipes/{self.dom.id}/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', reponse.data)
        self.assertTrue(Equipe.objects.filter(pk=self.dom.pk).exists())

    def test_equipe_avec_match_a_venir_supprimee(self):
        self.assertEqual(self.client.delete(f'/api/equipes/{self.dom.id}/').status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Match.objects.filter(pk=self.match.pk).exists())

    def test_equipe_ayant_joue_ne_change_pas_de_tournoi(self):
        autre = Tournoi.objects.create(
            nom='Autre', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
        )
        self.terminer()
        reponse = self.client.patch(f'/api/equipes/{self.dom.id}/', {'tournoi': autre.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)


class SuppressionJoueurTests(BaseProtection):
    def test_joueur_avec_stats_conserve(self):
        self.donner_stats()
        reponse = self.client.delete(f'/api/joueurs/{self.joueur.id}/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Joueur.objects.filter(pk=self.joueur.pk).exists())

    def test_ligne_a_zero_n_empeche_pas_la_suppression(self):
        self.donner_stats(points=0)
        reponse = self.client.delete(f'/api/joueurs/{self.joueur.id}/')
        self.assertEqual(reponse.status_code, status.HTTP_204_NO_CONTENT)

    def test_liste_indique_les_stats_et_le_retrait(self):
        self.donner_stats()
        donnees = self.client.get(f'/api/joueurs/{self.joueur.id}/').data
        self.assertTrue(donnees['a_des_stats'])
        self.assertFalse(donnees['retire'])


class RetraitEffectifTests(BaseProtection):
    def retirer(self, joueur=None):
        return self.client.post(f'/api/joueurs/{(joueur or self.joueur).id}/retirer/')

    def test_retrait_garde_les_stats_jouees_et_enleve_les_lignes_vides(self):
        termine = self.match
        self.donner_stats(match=termine)
        self.terminer(termine)
        a_venir = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext)
        self.donner_stats(match=a_venir, points=0)

        reponse = self.retirer()

        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertTrue(reponse.data['retire'])
        self.assertTrue(StatistiqueJoueur.objects.filter(joueur=self.joueur, match=termine, points=2).exists())
        self.assertFalse(StatistiqueJoueur.objects.filter(joueur=self.joueur, match=a_venir).exists())

    def test_joueur_retire_absent_des_nouveaux_matchs(self):
        self.retirer()
        self.client.post(f'/api/matchs/{self.match.id}/initialiser_stats/')
        self.assertEqual(
            list(self.match.statistiques_joueurs.values_list('joueur_id', flat=True)), [self.adverse.id],
        )

    def test_feuille_refuse_un_joueur_retire_sans_ligne(self):
        self.retirer()
        reponse = self.client.post(f'/api/matchs/{self.match.id}/saisie_feuille/', {
            'stats': [{'joueur': self.joueur.id, 'points': 2, 'passes': 0, 'rebonds': 0, 'contres': 0, 'fautes': 0}],
            'terminer': False,
        }, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_numero_repris_puis_retour_refuse_tant_que_pris(self):
        self.retirer()
        reponse = self.client.post('/api/joueurs/', {
            'prenom': 'Nouveau', 'nom': 'Venu', 'numero_maillot': 4, 'equipe': self.dom.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        retour = self.client.post(f'/api/joueurs/{self.joueur.id}/reintegrer/')
        self.assertEqual(retour.status_code, status.HTTP_400_BAD_REQUEST)
        Joueur.objects.get(pk=reponse.data['id']).delete()
        retour = self.client.post(f'/api/joueurs/{self.joueur.id}/reintegrer/')
        self.assertEqual(retour.status_code, status.HTTP_200_OK)
        self.assertFalse(retour.data['retire'])

    def test_numero_en_double_refuse_dans_l_effectif(self):
        reponse = self.client.post('/api/joueurs/', {
            'prenom': 'Autre', 'nom': 'Joueur', 'numero_maillot': 4, 'equipe': self.dom.id,
        })
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('numero_maillot', reponse.data)

    def test_changement_d_equipe_par_retrait_garde_une_seule_carriere(self):
        fiche = Athlete.objects.create(prenom='Luc', nom='Petit', email='luc@example.com')
        parti = Joueur.objects.create(athlete=fiche, prenom='Luc', nom='Petit', numero_maillot=8, equipe=self.dom)
        self.donner_stats(joueur=parti)
        self.terminer()
        self.retirer(parti)

        reponse = self.client.post('/api/joueurs/', {
            'prenom': 'Luc', 'nom': 'Petit', 'numero_maillot': 8, 'equipe': self.ext.id, 'email': 'luc@example.com',
        })

        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reponse.data['athlete'], fiche.id)
        carriere = profil_athlete(fiche)['carriere']
        self.assertEqual(carriere['tournois'], 1)
        self.assertEqual(carriere['points'], 2)

    def test_retire_ne_se_reinscrit_pas_dans_la_meme_equipe(self):
        fiche = Athlete.objects.create(prenom='Luc', nom='Petit', email='luc@example.com')
        parti = Joueur.objects.create(athlete=fiche, prenom='Luc', nom='Petit', numero_maillot=8, equipe=self.dom)
        self.retirer(parti)
        reponse = self.client.post('/api/joueurs/', {
            'prenom': 'Luc', 'nom': 'Petit', 'numero_maillot': 9, 'equipe': self.dom.id, 'email': 'luc@example.com',
        })
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_effectif_compte_sans_les_retires(self):
        self.retirer()
        self.assertEqual(self.client.get(f'/api/equipes/{self.dom.id}/').data['joueurs_count'], 0)

    def test_invitation_ne_propose_pas_les_retires(self):
        self.dom.code_invitation = 'code-a'
        self.dom.save()
        self.retirer()
        self.assertEqual(self.client.get('/api/invitations/code-a/').data['joueurs'], [])


class ChangementEquipeTests(BaseProtection):
    def test_refuse_avec_stats(self):
        self.donner_stats()
        reponse = self.client.patch(f'/api/joueurs/{self.joueur.id}/', {'equipe': self.ext.id})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.joueur.refresh_from_db()
        self.assertEqual(self.joueur.equipe, self.dom)

    def test_accepte_sans_stats_et_nettoie_les_lignes_vides(self):
        self.donner_stats(points=0)
        reponse = self.client.patch(f'/api/joueurs/{self.joueur.id}/', {'equipe': self.ext.id})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertFalse(StatistiqueJoueur.objects.filter(joueur=self.joueur).exists())

    def test_modifier_son_nom_reste_possible_avec_stats(self):
        self.donner_stats()
        reponse = self.client.patch(f'/api/joueurs/{self.joueur.id}/', {'prenom': 'Jeannot', 'equipe': self.dom.id})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)


class SuppressionMatchTests(BaseProtection):
    def test_match_termine_conserve(self):
        self.terminer()
        reponse = self.client.delete(f'/api/matchs/{self.match.id}/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Match.objects.filter(pk=self.match.pk).exists())

    def test_match_non_termine_supprime(self):
        self.assertEqual(self.client.delete(f'/api/matchs/{self.match.id}/').status_code, status.HTTP_204_NO_CONTENT)

    def test_reinitialisation_des_playoffs_reste_possible(self):
        finale = self.match_final('finale', 'termine')
        reponse = self.client.post(f'/api/tournois/{self.tournoi.slug}/reset_playoffs/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertFalse(Match.objects.filter(pk=finale.pk).exists())


class FormatPhaseTests(BaseProtection):
    def patch(self, donnees):
        return self.client.patch(f'/api/tournois/{self.tournoi.slug}/', donnees, format='json')

    def test_victoires_verrouillees_si_la_phase_a_commence(self):
        self.match_final('demi', 'en_cours')
        reponse = self.patch({'victoires_requises_demi': 2})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('victoires_requises_demi', reponse.data)

    def test_formulaire_renvoye_a_l_identique_accepte(self):
        self.match_final('demi', 'en_cours')
        reponse = self.patch({'victoires_requises_demi': 1, 'has_demis': self.tournoi.has_demis})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_phase_suivante_encore_modifiable(self):
        self.match_final('demi', 'termine')
        self.assertEqual(self.patch({'victoires_requises_finale': 2}).status_code, status.HTTP_200_OK)

    def test_match_non_commence_ne_verrouille_pas(self):
        self.match_final('demi')
        self.assertEqual(self.patch({'victoires_requises_demi': 2}).status_code, status.HTTP_200_OK)

    def test_structure_verrouillee_des_qu_une_phase_a_commence(self):
        self.match_final('demi', 'en_cours')
        self.assertEqual(self.patch({'has_quarts': not self.tournoi.has_quarts}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_reinitialisation_deverrouille(self):
        self.match_final('demi', 'termine')
        self.client.post(f'/api/tournois/{self.tournoi.slug}/reset_playoffs/')
        self.assertEqual(self.patch({'victoires_requises_demi': 2}).status_code, status.HTTP_200_OK)


class PointsClassementTests(BaseProtection):
    def patch(self, reglement):
        return self.client.patch(f'/api/tournois/{self.tournoi.slug}/', {'reglement': reglement}, format='json')

    def test_points_modifiables_avant_le_premier_resultat(self):
        self.assertEqual(self.patch({'points_victoire': 3}).status_code, status.HTTP_200_OK)

    def test_points_verrouilles_apres_un_match_termine(self):
        self.terminer()
        self.assertEqual(self.patch({'points_victoire': 3}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.patch({'points_defaite': 0}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_autres_reglages_toujours_modifiables(self):
        self.terminer()
        reglement = dict(self.tournoi.reglement, fautes_exclusion=6)
        self.assertEqual(self.patch(reglement).status_code, status.HTTP_200_OK)


class CompteOrganisateurSupprimeTests(BaseProtection):
    def test_le_tournoi_reste_et_passe_au_staff(self):
        self.donner_stats()
        self.orga.delete()
        self.tournoi.refresh_from_db()
        self.assertIsNone(self.tournoi.organisateur)
        self.assertTrue(StatistiqueJoueur.objects.filter(match=self.match).exists())

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/tournois/{self.tournoi.slug}/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(f'/api/matchs/{self.match.id}/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/matchs/').status_code, status.HTTP_200_OK)

        staff = User.objects.create_user('staff', password='motdepasse-solide-42', is_staff=True)
        self.client.force_authenticate(staff)
        reponse = self.client.patch(f'/api/tournois/{self.tournoi.slug}/', {'nom': 'Coupe 2'})
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
