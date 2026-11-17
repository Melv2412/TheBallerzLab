from rest_framework import status

from .test_api import BaseAPITestCase


class EtagMatchTests(BaseAPITestCase):
    """Le détail d'un match répond 304 tant qu'il n'a pas changé."""

    def url(self):
        return f'/api/matchs/{self.match.id}/'

    def test_304_si_rien_n_a_change(self):
        premiere = self.client.get(self.url())
        self.assertEqual(premiere.status_code, status.HTTP_200_OK)
        etag = premiere['ETag']
        self.assertIn('no-cache', premiere['Cache-Control'])

        seconde = self.client.get(self.url(), HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(seconde.status_code, status.HTTP_304_NOT_MODIFIED)
        self.assertEqual(seconde.content, b'')

    def test_200_apres_un_changement(self):
        etag = self.client.get(self.url())['ETag']
        self.stat.points = 2
        self.stat.save()
        self.match.calculer_scores_depuis_stats()

        reponse = self.client.get(self.url(), HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(reponse.status_code, status.HTTP_200_OK)
        self.assertEqual(reponse.data['score_domicile'], 2)
