from datetime import date

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from tournois.models import Athlete, Equipe, Joueur, Match, StatistiqueJoueur, Tournoi

MOT_DE_PASSE = 'motdepasse-solide-42'


class VisibiliteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password=MOT_DE_PASSE)
        self.autre = User.objects.create_user('autre', password=MOT_DE_PASSE)
        self.admin = User.objects.create_user('admin', password=MOT_DE_PASSE, is_staff=True)
        self.tournoi = Tournoi.objects.create(
            nom='Test Privé', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
            prive=True,
        )
        self.public = Tournoi.objects.create(
            nom='Ouvert', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2),
        )
        self.dom = Equipe.objects.create(nom='A', tournoi=self.tournoi, code_invitation='code-a')
        self.ext = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        self.athlete = Athlete.objects.create(prenom='Jean', nom='Dupont')
        self.joueur = Joueur.objects.create(
            prenom='Jean', nom='Dupont', numero_maillot=4, equipe=self.dom, athlete=self.athlete,
        )
        self.match = Match.objects.create(
            tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext,
            statut='termine', score_domicile=10, score_exterieur=2,
        )
        self.stat = StatistiqueJoueur.objects.create(joueur=self.joueur, match=self.match, points=10)
        self.urls = [
            f'/api/tournois/{self.tournoi.slug}/',
            f'/api/tournois/{self.tournoi.slug}/classement/',
            f'/api/equipes/{self.dom.pk}/',
            f'/api/joueurs/{self.joueur.pk}/',
            f'/api/matchs/{self.match.pk}/',
            f'/api/statistiques/{self.stat.pk}/',
        ]

    def slugs_de_la_liste(self):
        return {t['slug'] for t in self.client.get('/api/tournois/').data['results']}

    def test_anonyme_et_autre_compte_ne_voient_rien(self):
        for compte in (None, self.autre):
            self.client.force_authenticate(compte)
            self.assertEqual(self.slugs_de_la_liste(), {self.public.slug})
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND, url)
            for url in (
                f'/api/equipes/?tournoi={self.tournoi.slug}', f'/api/joueurs/?tournoi={self.tournoi.slug}',
                f'/api/matchs/?tournoi={self.tournoi.slug}', f'/api/statistiques/?match={self.match.pk}',
            ):
                reponse = self.client.get(url).data
                self.assertEqual(reponse.get('results', reponse) if isinstance(reponse, dict) else reponse, [], url)

    def test_organisateur_et_admin_voient_tout(self):
        for compte in (self.orga, self.admin):
            self.client.force_authenticate(compte)
            self.assertIn(self.tournoi.slug, self.slugs_de_la_liste())
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK, url)

    def test_seul_l_organisateur_change_la_visibilite(self):
        url = f'/api/tournois/{self.public.slug}/'
        for compte in (self.autre, self.admin):
            self.client.force_authenticate(compte)
            self.assertEqual(self.client.patch(url, {'prive': True}, format='json').status_code, 403)
        self.client.force_authenticate(self.orga)
        reponse = self.client.patch(url, {'prive': True}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertTrue(reponse.data['prive'])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_creation_privee(self):
        self.client.force_authenticate(self.admin)
        reponse = self.client.post('/api/tournois/', {
            'nom': 'Essai', 'date_debut': '2026-01-01', 'date_fin': '2026-01-02', 'prive': True,
        }, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertTrue(Tournoi.objects.get(nom='Essai').prive)

    def test_invitation_active_sans_ouvrir_le_tournoi(self):
        self.client.force_authenticate(self.autre)
        page = self.client.get('/api/invitations/code-a/')
        self.assertEqual(page.status_code, status.HTTP_200_OK)
        self.assertFalse(page.data['tournoi']['visible'])
        reponse = self.client.post('/api/invitations/code-a/rejoindre/', {
            'numero_maillot': 9, 'prenom': 'Awa', 'nom': 'Koné',
        }, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertEqual(self.client.get(f'/api/tournois/{self.tournoi.slug}/').status_code, 404)
        self.client.force_authenticate(self.orga)
        self.assertTrue(self.client.get('/api/invitations/code-a/').data['tournoi']['visible'])

    def test_lien_d_inscription_actif(self):
        Tournoi.objects.filter(pk=self.tournoi.pk).update(code_inscription='code-t')
        self.client.force_authenticate(self.autre)
        page = self.client.get('/api/inscriptions/code-t/')
        self.assertEqual(page.status_code, status.HTTP_200_OK)
        self.assertFalse(page.data['tournoi']['visible'])

    def test_profil_sans_le_tournoi_prive_puis_avec_une_fois_public(self):
        url = f'/api/athletes/{self.athlete.pk}/'
        for compte in (None, self.orga, self.admin):
            self.client.force_authenticate(compte)
            profil = self.client.get(url).data
            self.assertEqual(profil['tournois'], [])
            self.assertEqual(profil['carriere']['matchs'], 0)
        Tournoi.objects.filter(pk=self.tournoi.pk).update(prive=False)
        profil = self.client.get(url).data
        self.assertEqual(len(profil['tournois']), 1)
        self.assertEqual(profil['carriere']['points'], 10)
