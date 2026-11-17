from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status

from tournois.models import DemandeEquipe, Equipe

from .test_api import BaseAPITestCase


class InscriptionEquipesTests(BaseAPITestCase):
    """Lien d'inscription d'un tournoi : le capitaine propose son équipe, l'organisateur valide (5.4)."""

    def setUp(self):
        super().setUp()
        self.capitaine = User.objects.create_user('capitaine', email='cap@exemple.fr', password='motdepasse-solide-42')
        self.client.force_authenticate(self.orga)
        self.lien = f'/api/tournois/{self.tournoi.slug}/lien_inscription/'
        self.code = self.client.post(self.lien).data['code']
        self.url = f'/api/inscriptions/{self.code}/'
        self.client.force_authenticate(self.capitaine)

    def demander(self, nom):
        return self.client.post(self.url + 'demander/', {'nom': nom}, format='json')

    def traiter(self, demande_id, decision, qui=None):
        self.client.force_authenticate(qui or self.orga)
        reponse = self.client.post(f'/api/demandes_equipes/{demande_id}/{decision}/')
        self.client.force_authenticate(self.capitaine)
        return reponse

    def test_lien_reserve_a_l_organisateur_regenerable_et_desactivable(self):
        self.assertEqual(self.client.post(self.lien).status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(self.client.get(f'/api/tournois/{self.tournoi.slug}/').data['code_inscription'])
        self.client.force_authenticate(self.orga)
        self.assertEqual(self.client.get(f'/api/tournois/{self.tournoi.slug}/').data['code_inscription'], self.code)
        self.assertEqual(self.client.post(self.lien).data['code'], self.code)
        nouveau = self.client.post(self.lien, {'regenerer': True}).data['code']
        self.assertNotEqual(nouveau, self.code)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertIsNone(self.client.post(self.lien, {'desactiver': True}).data['code'])
        self.assertEqual(self.client.get(f'/api/inscriptions/{nouveau}/').status_code, status.HTTP_404_NOT_FOUND)

    def test_page_publique_puis_demande_connectee(self):
        self.client.force_authenticate(None)
        page = self.client.get(self.url)
        self.assertEqual(page.status_code, status.HTTP_200_OK)
        self.assertEqual((page.data['tournoi']['nom'], page.data['nb_equipes']), ('Interpromo', 2))
        self.assertIsNone(page.data['ma_demande'])
        self.assertEqual(self.demander('Les Lions').status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(self.capitaine)
        reponse = self.demander('  Les   Lions ')
        self.assertEqual(reponse.status_code, status.HTTP_201_CREATED, reponse.data)
        self.assertEqual((reponse.data['nom'], reponse.data['statut']), ('Les Lions', 'en_attente'))
        self.assertEqual(self.client.get(self.url).data['ma_demande']['statut'], 'en_attente')
        # Renommer la demande en attente : toujours une seule demande
        self.assertEqual(self.demander('Les Tigres').data['nom'], 'Les Tigres')
        self.assertEqual(DemandeEquipe.objects.count(), 1)
        self.assertFalse(Equipe.objects.filter(nom='Les Tigres').exists())  # rien de créé avant validation

    def test_noms_refuses(self):
        self.assertEqual(self.demander('   ').status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('déjà', str(self.demander('a').data))  # équipe « A » existante, casse ignorée
        self.demander('Les Lions')
        self.client.force_authenticate(self.intrus)
        self.assertIn('attente', str(self.demander('les lions').data))

    def test_acceptation_cree_l_equipe_et_donne_le_lien_au_capitaine(self):
        demande_id = self.demander('Les Lions').data['id']
        self.assertEqual(self.traiter(demande_id, 'accepter', qui=self.intrus).status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.orga)
        en_attente = self.client.get(f'/api/demandes_equipes/?tournoi={self.tournoi.slug}').data
        self.assertEqual([(d['nom'], d['capitaine']) for d in en_attente], [('Les Lions', 'capitaine')])

        reponse = self.traiter(demande_id, 'accepter')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        equipe = Equipe.objects.get(tournoi=self.tournoi, nom='Les Lions')
        ma_demande = self.client.get(self.url).data['ma_demande']
        self.assertEqual((ma_demande['statut'], ma_demande['equipe']), ('acceptee', equipe.pk))
        self.assertEqual(ma_demande['code_invitation'], equipe.code_invitation)
        self.assertEqual(self.client.get(f'/api/invitations/{equipe.code_invitation}/').status_code, 200)

        self.assertEqual(self.traiter(demande_id, 'refuser').status_code, status.HTTP_400_BAD_REQUEST)  # déjà traitée
        self.assertIn('déjà inscrite', str(self.demander('Autre nom').data))

    def test_refus_puis_nouvelle_demande(self):
        demande_id = self.demander('Les Lions').data['id']
        self.assertEqual(self.traiter(demande_id, 'refuser').data['statut'], 'refusee')
        self.assertFalse(Equipe.objects.filter(nom='Les Lions').exists())
        self.assertEqual(self.client.get(self.url).data['ma_demande']['statut'], 'refusee')
        self.assertEqual(self.demander('Les Lions 2').data['statut'], 'en_attente')

    def test_equipe_supprimee_apres_acceptation_permet_de_redemander(self):
        demande_id = self.demander('Les Lions').data['id']
        self.traiter(demande_id, 'accepter')
        Equipe.objects.get(nom='Les Lions').delete()
        self.assertEqual(self.client.get(self.url).data['ma_demande']['statut'], 'refusee')
        self.assertEqual(self.demander('Les Lions').status_code, status.HTTP_201_CREATED)

    def test_inscriptions_fermees(self):
        type(self.tournoi).objects.filter(pk=self.tournoi.pk).update(inscriptions_ouvertes=False)
        self.assertIn('fermées', str(self.demander('Les Lions').data))

    @override_settings(LIMITE_EQUIPES_PAR_TOURNOI=3)
    def test_tournoi_complet(self):
        demande_id = self.demander('Les Lions').data['id']
        Equipe.objects.create(nom='D', tournoi=self.tournoi)
        self.assertIn('complet', str(self.traiter(demande_id, 'accepter').data))
        self.client.force_authenticate(self.intrus)
        self.assertIn('complet', str(self.demander('Les Ours').data))
