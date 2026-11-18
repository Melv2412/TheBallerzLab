from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.classement import analyser_classement
from tournois.models import Athlete, DemandeEquipe, Equipe, Joueur, Match, Tournoi
from tournois.organisateurs import nb_tournois_actifs

MOT_DE_PASSE = 'motdepasse-solide-42'


class BaseFinTournoi(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password=MOT_DE_PASSE)
        self.autre = User.objects.create_user('autre', password=MOT_DE_PASSE)
        self.admin = User.objects.create_user('admin', password=MOT_DE_PASSE, is_staff=True)
        aujourd_hui = timezone.localdate()
        self.tournoi = Tournoi.objects.create(
            nom='Coupe', organisateur=self.orga,
            date_debut=aujourd_hui, date_fin=aujourd_hui + timedelta(days=30),
            code_inscription='code-inscription',
        )
        self.url = f'/api/tournois/{self.tournoi.slug}/'
        self.a = Equipe.objects.create(nom='A', tournoi=self.tournoi, code_invitation='code-a')
        self.b = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        self.c = Equipe.objects.create(nom='C', tournoi=self.tournoi)
        self.client.force_authenticate(self.orga)

    def match(self, domicile, exterieur, score_dom=60, score_ext=50, statut='termine', **champs):
        return Match.objects.create(
            tournoi=self.tournoi, equipe_domicile=domicile, equipe_exterieur=exterieur,
            statut=statut, score_domicile=score_dom, score_exterieur=score_ext, **champs,
        )

    def cloturer_en_base(self):
        Tournoi.objects.filter(pk=self.tournoi.pk).update(cloture_le=timezone.now())


class CloturerTests(BaseFinTournoi):
    def test_organisateur_cloture(self):
        reponse = self.client.post(f'{self.url}cloturer/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(reponse.data['cloture_le'])
        self.tournoi.refresh_from_db()
        self.assertIsNotNone(self.tournoi.cloture_le)

    def test_autre_compte_et_staff_ne_cloturent_pas(self):
        for compte in (self.autre, self.admin):
            self.client.force_authenticate(compte)
            self.assertEqual(self.client.post(f'{self.url}cloturer/').status_code, status.HTTP_403_FORBIDDEN)

    def test_refuse_avec_un_match_en_cours(self):
        self.match(self.a, self.b, 0, 0, statut='en_cours')
        reponse = self.client.post(f'{self.url}cloturer/')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('en cours', reponse.data['detail'])

    def test_match_a_venir_ne_bloque_pas(self):
        self.match(self.a, self.b, 0, 0, statut='a_venir')
        self.assertEqual(self.client.post(f'{self.url}cloturer/').status_code, status.HTTP_200_OK)

    def test_deja_cloture(self):
        self.cloturer_en_base()
        self.assertEqual(self.client.post(f'{self.url}cloturer/').status_code, status.HTTP_400_BAD_REQUEST)

    def test_le_champ_ne_se_modifie_pas_directement(self):
        self.client.patch(self.url, {'cloture_le': timezone.now().isoformat()}, format='json')
        self.tournoi.refresh_from_db()
        self.assertIsNone(self.tournoi.cloture_le)

    def test_libere_une_place_de_tournoi_actif(self):
        self.assertEqual(nb_tournois_actifs(self.orga), 1)
        self.client.post(f'{self.url}cloturer/')
        self.assertEqual(nb_tournois_actifs(self.orga), 0)


class RouvrirTests(BaseFinTournoi):
    def setUp(self):
        super().setUp()
        self.cloturer_en_base()

    def test_admin_rouvre(self):
        self.client.force_authenticate(self.admin)
        reponse = self.client.post(f'{self.url}rouvrir/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertIsNone(reponse.data['cloture_le'])
        self.client.force_authenticate(self.orga)
        self.assertEqual(self.client.post('/api/equipes/', {'nom': 'D', 'tournoi': self.tournoi.pk}).status_code, 201)

    def test_organisateur_ne_rouvre_pas(self):
        self.assertEqual(self.client.post(f'{self.url}rouvrir/').status_code, status.HTTP_403_FORBIDDEN)
        self.tournoi.refresh_from_db()
        self.assertIsNotNone(self.tournoi.cloture_le)

    def test_tournoi_ouvert(self):
        Tournoi.objects.filter(pk=self.tournoi.pk).update(cloture_le=None)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f'{self.url}rouvrir/').status_code, status.HTTP_400_BAD_REQUEST)


class LectureSeuleTests(BaseFinTournoi):
    def setUp(self):
        super().setUp()
        self.joueur = Joueur.objects.create(prenom='Ana', nom='Diallo', numero_maillot=4, equipe=self.a)
        self.match_prevu = self.match(self.a, self.b, 0, 0, statut='a_venir')
        self.match_fini = self.match(self.a, self.c)
        self.cloturer_en_base()

    def ecritures(self):
        match, fini, joueur = self.match_prevu.pk, self.match_fini.pk, self.joueur.pk
        return [
            ('patch', self.url, {'nom': 'Autre'}),
            ('patch', self.url, {'nom': 'Autre', 'prive': True}),
            ('post', f'{self.url}generer_phases_finales/', {}),
            ('post', f'{self.url}reset_playoffs/', {}),
            ('post', f'{self.url}lien_inscription/', {}),
            ('post', f'{self.url}departager_qualification/', {'tirage': True}),
            ('post', '/api/equipes/', {'nom': 'D', 'tournoi': self.tournoi.pk}),
            ('patch', f'/api/equipes/{self.a.pk}/', {'nom': 'Z'}),
            ('delete', f'/api/equipes/{self.c.pk}/', {}),
            ('post', f'/api/equipes/{self.a.pk}/invitation/', {}),
            ('post', f'/api/equipes/{self.a.pk}/forfait_general/', {}),
            ('post', '/api/joueurs/', {'prenom': 'N', 'nom': 'V', 'numero_maillot': 9, 'equipe': self.a.pk}),
            ('patch', f'/api/joueurs/{joueur}/', {'prenom': 'Z'}),
            ('delete', f'/api/joueurs/{joueur}/', {}),
            ('post', f'/api/joueurs/{joueur}/retirer/', {}),
            ('post', '/api/matchs/', {
                'tournoi': self.tournoi.pk, 'equipe_domicile': self.b.pk, 'equipe_exterieur': self.c.pk,
            }),
            ('patch', f'/api/matchs/{match}/', {'statut': 'en_cours'}),
            ('patch', f'/api/matchs/{fini}/', {'statut': 'en_cours'}),
            ('delete', f'/api/matchs/{match}/', {}),
            ('post', f'/api/matchs/{match}/forfait/', {'equipe': 'domicile'}),
        ]

    def test_toute_ecriture_est_refusee(self):
        for methode, url, donnees in self.ecritures():
            with self.subTest(methode=methode, url=url):
                reponse = getattr(self.client, methode)(url, donnees, format='json')
                self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST, reponse.data)
                self.assertIn('clôturé', str(reponse.data['detail']))
        self.tournoi.refresh_from_db()
        self.assertEqual(self.tournoi.nom, 'Coupe')
        self.assertEqual(self.tournoi.equipes.count(), 3)
        self.assertEqual(self.tournoi.matchs.count(), 2)

    def test_le_staff_doit_aussi_rouvrir_avant_de_modifier(self):
        Tournoi.objects.filter(pk=self.tournoi.pk).update(organisateur=None)
        self.client.force_authenticate(self.admin)
        reponse = self.client.patch(self.url, {'nom': 'Autre'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_un_autre_compte_reste_interdit(self):
        self.client.force_authenticate(self.autre)
        reponse = self.client.patch(self.url, {'nom': 'Autre'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_lecture_toujours_possible(self):
        self.client.force_authenticate(None)
        page = self.client.get(self.url)
        self.assertEqual(page.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(page.data['cloture_le'])
        match = self.client.get(f'/api/matchs/{self.match_fini.pk}/')
        self.assertIsNotNone(match.data['tournoi_cloture_le'])
        self.assertEqual(self.client.get(f'{self.url}classement/').status_code, status.HTTP_200_OK)

    def test_visibilite_modifiable(self):
        reponse = self.client.patch(self.url, {'prive': True}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.tournoi.refresh_from_db()
        self.assertTrue(self.tournoi.prive)

    def test_suppression_possible(self):
        reponse = self.client.delete(self.url, {'confirmation': 'Coupe'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)

    def test_inscription_par_lien_fermee_mais_c_est_moi_possible(self):
        self.client.force_authenticate(self.autre)
        page = self.client.get('/api/invitations/code-a/')
        self.assertFalse(page.data['inscriptions_ouvertes'])
        nouveau = self.client.post('/api/invitations/code-a/rejoindre/', {
            'numero_maillot': 12, 'prenom': 'Sam', 'nom': 'Kone',
        }, format='json')
        self.assertEqual(nouveau.status_code, status.HTTP_400_BAD_REQUEST)
        moi = self.client.post('/api/invitations/code-a/rejoindre/', {'joueur': self.joueur.pk}, format='json')
        self.assertEqual(moi.status_code, status.HTTP_200_OK, moi.data)
        self.joueur.refresh_from_db()
        self.assertEqual(Athlete.objects.get(pk=self.joueur.athlete_id).utilisateur, self.autre)

        self.client.force_authenticate(self.orga)
        delier = self.client.post(f'/api/joueurs/{self.joueur.pk}/delier/')
        self.assertEqual(delier.status_code, status.HTTP_200_OK, delier.data)

    def test_demandes_d_equipes_bloquees(self):
        demande = DemandeEquipe.objects.create(tournoi=self.tournoi, capitaine=self.autre, nom='Nouvelle')
        for action in ('accepter', 'refuser'):
            reponse = self.client.post(f'/api/demandes_equipes/{demande.pk}/{action}/')
            self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        demande.refresh_from_db()
        self.assertEqual(demande.statut, DemandeEquipe.EN_ATTENTE)

        self.client.force_authenticate(self.autre)
        self.assertFalse(self.client.get('/api/inscriptions/code-inscription/').data['inscriptions_ouvertes'])
        reponse = self.client.post('/api/inscriptions/code-inscription/demander/', {'nom': 'Autre'}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(LIMITE_TOURNOIS_ACTIFS=1)
    def test_restauration_d_un_cloture_hors_limite(self):
        Tournoi.objects.create(
            nom='Autre', organisateur=self.orga, date_debut=timezone.localdate(),
            date_fin=timezone.localdate() + timedelta(days=5),
        )
        Tournoi.objects.filter(pk=self.tournoi.pk).update(supprime_le=timezone.now())
        reponse = self.client.post(f'{self.url}restaurer/')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)


class EgaliteTests(BaseFinTournoi):
    """A, B et C se battent en cercle avec le même écart : aucun critère FIBA ne les sépare."""

    def setUp(self):
        super().setUp()
        self.ids = {self.a.pk, self.b.pk, self.c.pk}
        self.match(self.a, self.b)
        self.match(self.b, self.c)
        self.match(self.c, self.a)

    def egalite(self):
        return self.client.get(f'{self.url}egalite_qualification/').data['egalite']

    def decider(self, **donnees):
        return self.client.post(f'{self.url}departager_qualification/', donnees, format='json')

    def generer(self):
        return self.client.post(f'{self.url}generer_phases_finales/')

    def test_detection(self):
        egalite = self.egalite()
        self.assertEqual({e['id'] for e in egalite['equipes']}, self.ids)
        self.assertEqual(egalite['premiere_place'], 1)
        self.assertEqual(egalite['places_qualificatives'], 2)
        self.assertIsNone(egalite['decision'])

    def test_generation_bloquee_sans_decision(self):
        reponse = self.generer()
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Égalité parfaite', reponse.data['detail'])
        self.assertFalse(self.tournoi.matchs.exclude(phase='poule').exists())

    def test_pas_d_egalite_si_un_critere_departage(self):
        Match.objects.filter(equipe_domicile=self.a).update(score_domicile=90)
        self.assertIsNone(self.egalite())
        self.assertEqual(self.generer().status_code, status.HTTP_201_CREATED)

    def test_pas_d_egalite_tant_que_les_poules_ne_sont_pas_finies(self):
        self.match(self.a, self.b, 0, 0, statut='a_venir')
        self.assertIsNone(self.egalite())

    def test_pas_d_egalite_sans_aucun_resultat(self):
        self.assertEqual(analyser_classement([(1, 'A'), (2, 'B')], [])[1], [])

    def test_choix_de_l_organisateur(self):
        ordre = [self.c.pk, self.a.pk, self.b.pk]
        reponse = self.decider(ordre=ordre)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['egalite']['decision']['mode'], 'organisateur')
        classement = self.client.get(f'{self.url}classement/?type=poule').data
        self.assertEqual([e['id'] for e in classement], ordre)

        self.assertEqual(self.generer().status_code, status.HTTP_201_CREATED)
        finale = self.tournoi.matchs.get(phase='finale')
        self.assertEqual({finale.equipe_domicile_id, finale.equipe_exterieur_id}, {self.c.pk, self.a.pk})

    def test_choix_modifiable_avant_le_tableau(self):
        self.decider(ordre=[self.c.pk, self.a.pk, self.b.pk])
        self.assertEqual(self.decider(ordre=[self.b.pk, self.a.pk, self.c.pk]).status_code, status.HTTP_200_OK)
        classement = self.client.get(f'{self.url}classement/?type=poule').data
        self.assertEqual(classement[0]['id'], self.b.pk)
        self.tournoi.refresh_from_db()
        self.assertEqual(len(self.tournoi.departage_poule), 1)

    def test_ordre_invalide(self):
        autre = Equipe.objects.create(nom='D', tournoi=self.tournoi)
        for ordre in (
            [self.a.pk, self.b.pk], [self.a.pk, self.a.pk, self.b.pk],
            [self.a.pk, self.b.pk, autre.pk], 'abc', None, [True, self.a.pk, self.b.pk],
        ):
            with self.subTest(ordre=ordre):
                self.assertEqual(self.decider(ordre=ordre).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.decider().status_code, status.HTTP_400_BAD_REQUEST)

    def test_tirage_definitif(self):
        reponse = self.decider(tirage=True)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['egalite']['decision']['mode'], 'tirage')
        self.tournoi.refresh_from_db()
        ordre = self.tournoi.departage_poule[0]['equipes']
        self.assertEqual(set(ordre), self.ids)

        self.assertEqual(self.decider(tirage=True).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.decider(ordre=ordre[::-1]).status_code, status.HTTP_400_BAD_REQUEST)
        self.tournoi.refresh_from_db()
        self.assertEqual(self.tournoi.departage_poule[0]['equipes'], ordre)
        self.assertEqual(self.generer().status_code, status.HTTP_201_CREATED)

    def test_tirage_apres_un_choix(self):
        self.decider(ordre=[self.c.pk, self.a.pk, self.b.pk])
        reponse = self.decider(tirage=True)
        self.assertEqual(reponse.data['egalite']['decision']['mode'], 'tirage')

    def test_decision_ignoree_si_les_resultats_changent(self):
        self.decider(ordre=[self.c.pk, self.b.pk, self.a.pk])
        Match.objects.filter(equipe_domicile=self.a).update(score_domicile=90)
        self.assertIsNone(self.egalite())
        classement = self.client.get(f'{self.url}classement/?type=poule').data
        self.assertEqual(classement[0]['id'], self.a.pk)

    def test_decision_sans_effet_sur_le_classement_general(self):
        self.decider(ordre=[self.c.pk, self.b.pk, self.a.pk])
        classement = self.client.get(f'{self.url}classement/').data
        self.assertEqual([e['nom'] for e in classement], ['A', 'B', 'C'])

    def test_refus_apres_creation_du_tableau(self):
        self.decider(ordre=[self.c.pk, self.a.pk, self.b.pk])
        self.generer()
        reponse = self.decider(ordre=[self.b.pk, self.a.pk, self.c.pk])
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reservee_a_l_organisateur(self):
        self.client.force_authenticate(self.autre)
        self.assertEqual(self.decider(tirage=True).status_code, status.HTTP_403_FORBIDDEN)

    def test_egalite_au_dela_de_la_derniere_place_ignoree(self):
        """Égalité seulement entre équipes éliminées : rien à trancher."""
        d = Equipe.objects.create(nom='D', tournoi=self.tournoi)
        e = Equipe.objects.create(nom='E', tournoi=self.tournoi)
        Match.objects.all().delete()
        self.match(self.a, d)
        self.match(self.a, e)
        self.match(self.b, d)
        self.match(self.b, e)
        self.match(self.a, self.b)
        # A 3 victoires, B 2 ; C sans match, D et E à égalité parfaite derrière
        self.assertIsNone(self.egalite())
