import shutil
import tempfile
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tournois import corbeille, images
from tournois.athletes import fusionner
from tournois.carriere import profil_athlete
from tournois.models import Athlete, Equipe, FichierASupprimer, Joueur, Match, StatistiqueJoueur, Tournoi

MEDIA = tempfile.mkdtemp(prefix='thelab-tests-')
STOCKAGE_LOCAL = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def fichier(dossier, nom='image.gif'):
    return default_storage.save(f'{dossier}/{nom}', ContentFile(b'GIF89a'))


@override_settings(MEDIA_ROOT=MEDIA, STORAGES=STOCKAGE_LOCAL, LIMITE_TOURNOIS_ACTIFS=3)
class BaseSuppression(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.orga = User.objects.create_user('orga', password='motdepasse-solide-42')
        self.autre = User.objects.create_user('autre', password='motdepasse-solide-42')
        fin = timezone.localdate() + timedelta(days=10)
        self.tournoi = Tournoi.objects.create(
            nom='Coupe Été', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=fin,
        )
        self.logo = fichier('equipes/logos')
        self.photo = fichier('joueurs/photos')
        self.dom = Equipe.objects.create(nom='A', tournoi=self.tournoi, logo=self.logo)
        self.ext = Equipe.objects.create(nom='B', tournoi=self.tournoi)
        self.joueur = Joueur.objects.create(
            prenom='Jean', nom='Dupont', numero_maillot=4, equipe=self.dom, photo=self.photo,
        )
        self.match = Match.objects.create(tournoi=self.tournoi, equipe_domicile=self.dom, equipe_exterieur=self.ext)
        self.url = f'/api/tournois/{self.tournoi.slug}/'
        self.client.force_authenticate(self.orga)

    def terminer(self):
        Match.objects.filter(pk=self.match.pk).update(statut='termine', score_domicile=10, score_exterieur=2)
        StatistiqueJoueur.objects.create(joueur=self.joueur, match=self.match, points=10)

    def supprimer(self, confirmation='Coupe Été'):
        return self.client.delete(self.url, {'confirmation': confirmation}, format='json')

    def mettre_en_corbeille(self):
        self.terminer()
        self.assertEqual(self.supprimer().data['resultat'], 'corbeille')


class SuppressionTournoiTests(BaseSuppression):
    def test_le_nom_doit_etre_retape(self):
        for saisie in ('', 'Coupe'):
            self.assertEqual(self.supprimer(saisie).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Tournoi.objects.filter(pk=self.tournoi.pk, supprime_le__isnull=True).exists())

    def test_majuscules_et_espaces_toleres(self):
        self.assertEqual(self.supprimer('  coupe   ÉTÉ ').status_code, status.HTTP_200_OK)

    def test_sans_match_joue_effacement_immediat_avec_images(self):
        reponse = self.supprimer()
        self.assertEqual(reponse.data['resultat'], 'supprime')
        self.assertFalse(Tournoi.objects.filter(pk=self.tournoi.pk).exists())
        self.assertFalse(default_storage.exists(self.logo))
        self.assertFalse(default_storage.exists(self.photo))
        self.assertFalse(FichierASupprimer.objects.exists())

    def test_match_en_cours_protege_par_la_corbeille(self):
        Match.objects.filter(pk=self.match.pk).update(statut='en_cours')
        self.assertEqual(self.supprimer().data['resultat'], 'corbeille')

    def test_autre_compte_refuse(self):
        self.client.force_authenticate(self.autre)
        self.assertEqual(self.supprimer().status_code, status.HTTP_403_FORBIDDEN)
        reponse = self.client.get(f'{self.url}apercu_suppression/')
        self.assertEqual(reponse.status_code, status.HTTP_403_FORBIDDEN)

    def test_apercu_annonce_les_pertes(self):
        self.terminer()
        donnees = self.client.get(f'{self.url}apercu_suppression/').data
        self.assertEqual(
            (donnees['equipes'], donnees['joueurs'], donnees['matchs'], donnees['matchs_termines'], donnees['images']),
            (2, 1, 1, 1, 2),
        )
        self.assertTrue(donnees['corbeille'])


class CorbeilleTests(BaseSuppression):
    def test_tournoi_invisible_partout_mais_images_gardees(self):
        self.mettre_en_corbeille()
        self.dom.code_invitation = 'code-equipe'
        self.dom.save(update_fields=['code_invitation'])
        Tournoi.objects.filter(pk=self.tournoi.pk).update(code_inscription='code-tournoi')
        for url in (
            self.url, f'/api/equipes/{self.dom.pk}/', f'/api/joueurs/{self.joueur.pk}/',
            f'/api/matchs/{self.match.pk}/', '/api/invitations/code-equipe/', '/api/inscriptions/code-tournoi/',
        ):
            self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND, url)
        self.assertEqual(self.client.get('/api/tournois/').data['results'], [])
        self.assertEqual(self.client.get(f'/api/statistiques/?match={self.match.pk}').data['results'], [])
        self.assertTrue(default_storage.exists(self.logo))
        self.assertTrue(default_storage.exists(self.photo))

    def test_plus_aucune_modification(self):
        self.mettre_en_corbeille()
        reponse = self.client.post('/api/equipes/', {'nom': 'C', 'tournoi': self.tournoi.pk}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_404_NOT_FOUND)
        reponse = self.client.post(f'/api/matchs/{self.match.pk}/forfait/', {}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_404_NOT_FOUND)

    def test_carriere_masquee_puis_rendue(self):
        self.mettre_en_corbeille()
        athlete = self.joueur.athlete
        self.assertEqual(profil_athlete(athlete)['carriere']['matchs'], 0)
        self.client.post(f'{self.url}restaurer/')
        self.assertEqual(profil_athlete(athlete)['carriere']['points'], 10)

    def test_restauration_rend_tout(self):
        self.mettre_en_corbeille()
        liste = self.client.get('/api/corbeille/').data
        self.assertEqual([e['slug'] for e in liste], [self.tournoi.slug])
        self.assertEqual(liste[0]['jours_restants'], 30)
        self.assertEqual(self.client.post(f'{self.url}restaurer/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/corbeille/').data, [])

    def test_corbeille_reservee_a_son_organisateur(self):
        self.mettre_en_corbeille()
        self.client.force_authenticate(self.autre)
        self.assertEqual(self.client.get('/api/corbeille/').data, [])
        self.assertEqual(self.client.post(f'{self.url}restaurer/').status_code, status.HTTP_403_FORBIDDEN)

    def test_la_corbeille_ne_compte_pas_dans_la_limite_mais_la_restauration_si(self):
        self.mettre_en_corbeille()
        self.assertEqual(self.client.get('/api/users/me/').data['tournois_actifs'], 0)
        with override_settings(LIMITE_TOURNOIS_ACTIFS=1):
            Tournoi.objects.create(
                nom='Autre', organisateur=self.orga, date_debut=date(2026, 1, 1), date_fin=self.tournoi.date_fin,
            )
            self.assertEqual(self.client.post(f'{self.url}restaurer/').status_code, status.HTTP_400_BAD_REQUEST)

    def test_nom_reserve_tant_que_le_tournoi_est_en_corbeille(self):
        self.mettre_en_corbeille()
        with patch('tournois.views.est_organisateur_valide', return_value=True):
            reponse = self.client.post('/api/tournois/', {
                'nom': 'COUPE Été', 'date_debut': '2026-01-01', 'date_fin': '2026-01-02',
            }, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('corbeille', str(reponse.data['nom']))

    def test_suppression_definitive_exige_le_nom(self):
        self.mettre_en_corbeille()
        url = f'{self.url}supprimer_definitivement/'
        self.assertEqual(self.client.post(url, {'confirmation': 'non'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'confirmation': 'Coupe Été'}, format='json').status_code, 200)
        self.assertFalse(Tournoi.objects.filter(pk=self.tournoi.pk).exists())
        self.assertFalse(default_storage.exists(self.logo))

    def test_tournoi_actif_non_restaurable_ni_effacable_par_ces_routes(self):
        self.assertEqual(self.client.post(f'{self.url}restaurer/').status_code, status.HTTP_404_NOT_FOUND)


class TacheQuotidienneTests(BaseSuppression):
    url_tache = '/api/taches/quotidiennes/'

    def appeler(self, secret='secret-test'):
        return self.client.get(self.url_tache, HTTP_AUTHORIZATION=f'Bearer {secret}')

    @override_settings(CRON_SECRET='')
    def test_sans_secret_reveille_la_base_seulement(self):
        self.mettre_en_corbeille()
        Tournoi.objects.filter(pk=self.tournoi.pk).update(supprime_le=timezone.now() - timedelta(days=31))
        reponse = self.appeler()
        self.assertEqual(reponse.data['taches'], 'non_configurees')
        self.assertTrue(Tournoi.objects.filter(pk=self.tournoi.pk).exists())

    @override_settings(CRON_SECRET='secret-test')
    def test_mauvais_secret_refuse(self):
        self.assertEqual(self.appeler('faux').status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(CRON_SECRET='secret-test')
    def test_purge_apres_30_jours_avec_images(self):
        self.mettre_en_corbeille()
        Tournoi.objects.filter(pk=self.tournoi.pk).update(supprime_le=timezone.now() - timedelta(days=31))
        reponse = self.appeler()
        self.assertEqual(reponse.data['taches']['tournois_purges'], 1)
        self.assertFalse(Tournoi.objects.filter(pk=self.tournoi.pk).exists())
        self.assertFalse(default_storage.exists(self.logo))

    @override_settings(CRON_SECRET='secret-test')
    def test_corbeille_recente_conservee(self):
        self.mettre_en_corbeille()
        Tournoi.objects.filter(pk=self.tournoi.pk).update(supprime_le=timezone.now() - timedelta(days=29))
        self.assertEqual(self.appeler().data['taches']['tournois_purges'], 0)
        self.assertTrue(Tournoi.objects.filter(pk=self.tournoi.pk).exists())

    @override_settings(CRON_SECRET='secret-test')
    def test_orpheline_effacee_au_passage_suivant_seulement(self):
        orpheline = fichier('equipes/logos', 'perdue.gif')
        marqueur = default_storage.save('equipes/logos/.emptyFolderPlaceholder', ContentFile(b''))
        self.appeler()
        ligne = FichierASupprimer.objects.get(nom=orpheline)
        self.assertTrue(default_storage.exists(orpheline))
        self.assertFalse(FichierASupprimer.objects.filter(nom=marqueur).exists())
        self.assertFalse(FichierASupprimer.objects.filter(nom=self.logo).exists())
        FichierASupprimer.objects.filter(pk=ligne.pk).update(pas_avant=timezone.now() - timedelta(minutes=1))
        self.appeler()
        self.assertFalse(default_storage.exists(orpheline))
        default_storage.delete(marqueur)


class ImagesTests(BaseSuppression):
    def test_equipe_supprimee_efface_logo_et_photos(self):
        Match.objects.filter(pk=self.match.pk).delete()
        self.assertEqual(self.client.delete(f'/api/equipes/{self.dom.pk}/').status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(default_storage.exists(self.logo))
        self.assertFalse(default_storage.exists(self.photo))

    def test_joueur_garde_la_photo_de_profil_si_sa_fiche_reste(self):
        profil = fichier('athletes/photos')
        compte = User.objects.create_user('joueur', password='motdepasse-solide-42')
        Athlete.objects.filter(pk=self.joueur.athlete_id).update(photo=profil, utilisateur=compte)
        self.assertEqual(self.client.delete(f'/api/joueurs/{self.joueur.pk}/').status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(default_storage.exists(self.photo))
        self.assertTrue(default_storage.exists(profil))

    def test_joueur_efface_la_photo_de_profil_si_sa_fiche_disparait(self):
        profil = fichier('athletes/photos')
        Athlete.objects.filter(pk=self.joueur.athlete_id).update(photo=profil)
        self.client.delete(f'/api/joueurs/{self.joueur.pk}/')
        self.assertFalse(Athlete.objects.filter(pk=self.joueur.athlete_id).exists())
        self.assertFalse(default_storage.exists(profil))

    def test_image_retiree_ou_remplacee(self):
        reponse = self.client.patch(f'/api/equipes/{self.dom.pk}/', {'logo': None}, format='json')
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertFalse(default_storage.exists(self.logo))
        self.joueur.photo = fichier('joueurs/photos', 'nouvelle.gif')
        self.joueur.save()
        images.traiter_file(5)
        self.assertFalse(default_storage.exists(self.photo))
        self.assertTrue(default_storage.exists(self.joueur.photo.name))

    def test_compte_supprime_efface_sa_photo_et_garde_la_fiche(self):
        profil = fichier('athletes/photos')
        compte = User.objects.create_user('joueur', password='motdepasse-solide-42')
        Athlete.objects.filter(pk=self.joueur.athlete_id).update(photo=profil, utilisateur=compte)
        compte.delete()
        images.traiter_file(5)
        self.assertFalse(default_storage.exists(profil))
        fiche = Athlete.objects.get(pk=self.joueur.athlete_id)
        self.assertFalse(fiche.photo)
        self.assertIsNone(fiche.utilisateur_id)

    def test_fusion_garde_la_photo_si_la_cible_n_en_a_pas(self):
        cible = self.joueur.athlete
        profil = fichier('athletes/photos')
        autre = Athlete.objects.create(prenom='Jean', nom='Dupont', photo=profil)
        Athlete.objects.filter(pk=autre.pk).update(created_at=cible.created_at + timedelta(days=1))
        garde = fusionner(Athlete.objects.filter(pk__in=[cible.pk, autre.pk]))
        images.traiter_file(5)
        self.assertEqual(garde.pk, cible.pk)
        self.assertEqual(Athlete.objects.get(pk=cible.pk).photo.name, profil)
        self.assertTrue(default_storage.exists(profil))
        self.assertFalse(FichierASupprimer.objects.exists())

    def test_fusion_efface_la_photo_en_trop(self):
        cible = self.joueur.athlete
        gardee, perdue = fichier('athletes/photos', 'a.gif'), fichier('athletes/photos', 'b.gif')
        Athlete.objects.filter(pk=cible.pk).update(photo=gardee)
        autre = Athlete.objects.create(prenom='Jean', nom='Dupont', photo=perdue)
        Athlete.objects.filter(pk=autre.pk).update(created_at=cible.created_at + timedelta(days=1))
        fusionner(Athlete.objects.filter(pk__in=[cible.pk, autre.pk]))
        images.traiter_file(5)
        self.assertTrue(default_storage.exists(gardee))
        self.assertFalse(default_storage.exists(perdue))

    def test_fichier_encore_utilise_jamais_efface(self):
        images.noter([self.logo])
        images.traiter_file(5)
        self.assertTrue(default_storage.exists(self.logo))
        self.assertFalse(FichierASupprimer.objects.exists())

    def test_stockage_en_panne_retente_plus_tard(self):
        with patch('django.core.files.storage.FileSystemStorage.delete', side_effect=OSError('panne')):
            reponse = self.supprimer()
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(FichierASupprimer.objects.filter(tentatives=1).count(), 2)
        self.assertTrue(default_storage.exists(self.logo))
        self.assertEqual(corbeille.taches_quotidiennes()['images']['effaces'], 2)
        self.assertFalse(default_storage.exists(self.logo))
