from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status

from tournois.models import Joueur

from .test_api import BaseAPITestCase


class JoueurRelieTests(BaseAPITestCase):
    """Le joueur relié à sa fiche choisit ses postes et change son numéro, lui-même."""

    def setUp(self):
        super().setUp()
        self.compte = User.objects.create_user('jean', password='motdepasse-solide-42')
        self.fiche = self.joueur.athlete
        self.fiche.utilisateur = self.compte
        self.fiche.save()
        self.coequipier = Joueur.objects.create(prenom='Luc', nom='Roy', numero_maillot=10, equipe=self.dom)
        self.client.force_authenticate(self.compte)

    def changer_numero(self, numero, joueur=None):
        return self.client.post(
            f'/api/athletes/{self.fiche.pk}/numero/', {'joueur': (joueur or self.joueur).pk, 'numero_maillot': numero},
        )

    def test_choisir_ses_postes(self):
        reponse = self.client.put(
            f'/api/athletes/{self.fiche.pk}/postes/', {'postes': ['ailier', 'arriere', 'ailier']}, format='json',
        )
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.assertEqual(reponse.data['postes'], ['arriere', 'ailier'])  # sans doublon, dans l'ordre du terrain
        # Les postes suivent le joueur dans ses équipes (fiche de match, effectifs)
        self.assertEqual(self.client.get(f'/api/joueurs/{self.joueur.pk}/').data['postes'], ['arriere', 'ailier'])

    def test_aucun_poste_ou_poste_inconnu(self):
        url = f'/api/athletes/{self.fiche.pk}/postes/'
        self.assertEqual(self.client.put(url, {'postes': []}, format='json').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.put(url, {'postes': ['libero']}, format='json').status_code, 400)

    def test_seul_le_joueur_relie(self):
        self.client.force_authenticate(self.intrus)
        self.assertEqual(
            self.client.put(f'/api/athletes/{self.fiche.pk}/postes/', {'postes': ['pivot']}, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.changer_numero(23).status_code, status.HTTP_403_FORBIDDEN)

    def test_changer_son_numero(self):
        reponse = self.changer_numero(23)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK, reponse.data)
        self.joueur.refresh_from_db()
        self.assertEqual(self.joueur.numero_maillot, 23)
        ligne = reponse.data['tournois'][0]
        self.assertEqual((ligne['numero'], ligne['joueur_id'], ligne['numero_modifiable']), (23, self.joueur.pk, True))

    def test_numero_deja_pris_dans_l_equipe(self):
        reponse = self.changer_numero(10)
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('déjà pris', str(reponse.data['numero_maillot']))
        # Un numéro porté dans une autre équipe, ou par un joueur retiré, reste libre
        Joueur.objects.create(prenom='X', nom='Y', numero_maillot=12, equipe=self.ext)
        self.coequipier.retire = True
        self.coequipier.save()
        self.assertEqual(self.changer_numero(10).status_code, status.HTTP_200_OK)
        self.assertEqual(self.changer_numero(12).status_code, status.HTTP_200_OK)

    def test_numero_hors_limites_ou_inscription_d_un_autre(self):
        self.assertEqual(self.changer_numero(100).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.changer_numero(5, joueur=self.coequipier).status_code, status.HTTP_404_NOT_FOUND)

    def test_tournoi_cloture_ou_joueur_retire(self):
        self.tournoi.cloture_le = timezone.now()
        self.tournoi.save()
        self.assertEqual(self.changer_numero(23).status_code, status.HTTP_400_BAD_REQUEST)
        self.tournoi.cloture_le = None
        self.tournoi.save()
        self.joueur.retire = True
        self.joueur.save()
        self.assertEqual(self.changer_numero(23).status_code, status.HTTP_400_BAD_REQUEST)
