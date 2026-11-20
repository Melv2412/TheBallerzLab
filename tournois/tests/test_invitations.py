from django.contrib.auth.models import User
from rest_framework import status

from tournois.athletes import fusionner
from tournois.models import Athlete, Equipe, Joueur

from .test_api import BaseAPITestCase


class InvitationsTests(BaseAPITestCase):
    """Lien d'invitation d'équipe : le joueur rejoint son équipe avec son compte (5.3)."""

    def setUp(self):
        super().setUp()
        self.paul = User.objects.create_user('paul', email='paul@exemple.fr', password='motdepasse-solide-42')
        self.client.force_authenticate(self.orga)
        self.code = self.client.post(f'/api/equipes/{self.dom.id}/invitation/').data['code']
        self.url = f'/api/invitations/{self.code}/'
        self.client.force_authenticate(self.paul)

    def rejoindre(self, **donnees):
        return self.client.post(self.url + 'rejoindre/', donnees, format='json')

    def test_lien_reserve_a_l_organisateur_et_regenerable(self):
        self.assertEqual(self.client.post(f'/api/equipes/{self.dom.id}/invitation/').status_code, 403)
        self.client.force_authenticate(self.orga)
        meme = self.client.post(f'/api/equipes/{self.dom.id}/invitation/').data['code']
        self.assertEqual(meme, self.code)
        nouveau = self.client.post(f'/api/equipes/{self.dom.id}/invitation/', {'regenerer': True}).data['code']
        self.assertNotEqual(nouveau, self.code)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)  # ancien lien mort

    def test_page_publique_de_l_invitation(self):
        self.client.force_authenticate(None)
        reponse = self.client.get(self.url)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual((reponse.data['equipe']['nom'], reponse.data['tournoi']['nom']), ('A', 'Interpromo'))
        self.assertEqual(reponse.data['joueurs'][0]['prenom'], 'Jean')
        self.assertIsNone(reponse.data['moi'])
        self.assertEqual(self.rejoindre(numero_maillot=8).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inscription_avec_numero_cree_joueur_et_fiche_reliee(self):
        self.assertEqual(self.rejoindre(numero_maillot=8).status_code, status.HTTP_400_BAD_REQUEST)  # nom requis
        reponse = self.rejoindre(numero_maillot=8, prenom='Paul', nom='Martin')
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertTrue(reponse.data['compte_lie'])
        fiche = Athlete.objects.get(utilisateur=self.paul)
        self.assertEqual((fiche.prenom, fiche.nom, fiche.email), ('Paul', 'Martin', None))
        self.assertEqual(self.client.get('/api/users/me/').data['athlete'], fiche.pk)
        moi = self.client.get(self.url).data['moi']
        self.assertEqual(moi['inscription']['numero_maillot'], 8)

        # Un autre tournoi : même fiche, le nom vient de la fiche ; une seule inscription par tournoi
        self.assertIn('déjà', str(self.rejoindre(numero_maillot=9).data))
        self.client.force_authenticate(self.intrus)
        code = self.client.post(f'/api/equipes/{self.autre_equipe.id}/invitation/').data['code']
        self.client.force_authenticate(self.paul)
        ailleurs = self.client.post(f'/api/invitations/{code}/rejoindre/', {'numero_maillot': 3}, format='json')
        self.assertEqual(ailleurs.data['athlete'], fiche.pk)
        self.assertEqual(ailleurs.data['nom'], 'Martin')

    def test_fiche_indique_si_le_joueur_a_une_photo(self):
        self.assertEqual(self.rejoindre(numero_maillot=8, prenom='Paul', nom='Martin').status_code, 201)
        self.assertIs(self.client.get(self.url).data['moi']['fiche']['a_photo'], False)
        Athlete.objects.filter(utilisateur=self.paul).update(photo='athletes/photos/paul.webp')
        self.assertIs(self.client.get(self.url).data['moi']['fiche']['a_photo'], True)

    def test_numero_pris_et_inscriptions_fermees(self):
        self.assertIn('déjà pris', str(self.rejoindre(numero_maillot=4, prenom='P', nom='M').data))
        self.tournoi.inscriptions_ouvertes = False
        self.tournoi.save()
        self.assertIn('fermées', str(self.rejoindre(numero_maillot=8, prenom='P', nom='M').data))
        # « C'est moi » reste possible inscriptions fermées
        self.assertEqual(self.rejoindre(joueur=self.joueur.id).status_code, status.HTTP_200_OK)

    def test_c_est_moi_relie_la_fiche_existante(self):
        fiche = self.joueur.athlete_id
        reponse = self.rejoindre(joueur=self.joueur.id)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(Athlete.objects.get(pk=fiche).utilisateur, self.paul)
        # Un autre compte ne peut plus le réclamer
        self.client.force_authenticate(self.intrus)
        self.assertIn('autre compte', str(self.rejoindre(joueur=self.joueur.id).data))
        # Un joueur d'une autre équipe ne se réclame pas par ce lien
        ext = Joueur.objects.create(prenom='X', nom='Y', numero_maillot=1, equipe=self.ext)
        self.assertEqual(self.rejoindre(joueur=ext.id).status_code, status.HTTP_400_BAD_REQUEST)

    def test_c_est_moi_avec_une_fiche_deja_a_soi(self):
        ailleurs = Joueur.objects.create(prenom='Jean', nom='Dupont', numero_maillot=1, equipe=self.autre_equipe)
        ailleurs.athlete.utilisateur = self.paul
        ailleurs.athlete.save()
        ancienne = self.joueur.athlete_id
        self.rejoindre(joueur=self.joueur.id)
        self.joueur.refresh_from_db()
        self.assertEqual(self.joueur.athlete_id, ailleurs.athlete_id)
        self.assertFalse(Athlete.objects.filter(pk=ancienne).exists())

    def test_organisateur_delie_et_fermer_les_inscriptions(self):
        self.rejoindre(joueur=self.joueur.id)
        self.assertEqual(self.client.post(f'/api/joueurs/{self.joueur.id}/delier/').status_code, 403)
        self.client.force_authenticate(self.orga)
        reponse = self.client.get(f'/api/joueurs/?equipe={self.dom.id}')
        self.assertTrue(reponse.data['results'][0]['compte_lie'] if 'results' in reponse.data else reponse.data[0]['compte_lie'])
        self.assertIn('relié son compte', str(
            self.client.patch(f'/api/joueurs/{self.joueur.id}/', {'email': 'x@exemple.fr'}, format='json').data
        ))
        reponse = self.client.post(f'/api/joueurs/{self.joueur.id}/delier/')
        self.assertFalse(reponse.data['compte_lie'])
        self.assertFalse(Athlete.objects.filter(utilisateur=self.paul).exists())

        patch = self.client.patch(f'/api/tournois/{self.tournoi.slug}/', {'inscriptions_ouvertes': False}, format='json')
        self.assertFalse(patch.data['inscriptions_ouvertes'])

    def test_delier_garde_les_autres_tournois_au_compte(self):
        self.rejoindre(numero_maillot=8, prenom='Paul', nom='Martin')
        fiche = Athlete.objects.get(utilisateur=self.paul)
        autre = Joueur.objects.create(athlete=fiche, prenom='Paul', nom='Martin', numero_maillot=2, equipe=self.autre_equipe)
        self.client.force_authenticate(self.intrus)
        self.client.post(f'/api/joueurs/{autre.id}/delier/')
        autre.refresh_from_db()
        self.assertNotEqual(autre.athlete_id, fiche.pk)
        self.assertEqual(fiche.joueurs.count(), 1)

    def test_fiche_d_un_compte_gardee_sans_inscription(self):
        self.rejoindre(numero_maillot=8, prenom='Paul', nom='Martin')
        Joueur.objects.filter(athlete__utilisateur=self.paul).delete()
        self.assertTrue(Athlete.objects.filter(utilisateur=self.paul).exists())

    def test_fusion_garde_la_fiche_du_compte(self):
        self.rejoindre(numero_maillot=8, prenom='Paul', nom='Martin')
        a_moi = Athlete.objects.get(utilisateur=self.paul)
        autre_equipe = Equipe.objects.create(nom='Z', tournoi=self.autre_tournoi)
        doublon = Joueur.objects.create(prenom='Paul', nom='Martin', numero_maillot=1, equipe=autre_equipe).athlete
        doublon.email = 'paul@exemple.fr'
        doublon.save()
        self.assertEqual(fusionner([doublon, a_moi]).pk, a_moi.pk)
        a_moi.refresh_from_db()
        self.assertEqual(a_moi.email, 'paul@exemple.fr')


class InscriptionEmailTests(BaseAPITestCase):
    def test_email_obligatoire_et_unique(self):
        donnees = {'username': 'x', 'password': 'motdepasse-solide-42'}
        self.assertIn('email', self.client.post('/api/users/', donnees).data)
        User.objects.create_user('y', email='deja@exemple.fr')
        reponse = self.client.post('/api/users/', {**donnees, 'email': 'DEJA@exemple.fr'})
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.post('/api/users/', {**donnees, 'email': 'x@exemple.fr'}).status_code, 201)
