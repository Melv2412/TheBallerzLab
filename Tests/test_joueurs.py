import os
import django
from rest_framework.test import APIRequestFactory
from tournois.views import JoueurViewSet

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'basket_tournament.settings')
django.setup()

def test_joueurs_api():
    factory = APIRequestFactory()
    view = JoueurViewSet.as_view({'get': 'list'})
    
    # On teste pour l'équipe IT11 (ID 11 d'après le check_db précédent)
    request = factory.get('/api/joueurs/', {'equipe': '11'})
    response = view(request)
    
    print(f"Status: {response.status_code}")
    data = response.data.get('results', response.data)
    print(f"Data type: {type(data)}")
    print(f"Count: {len(data)}")
    if len(data) > 0:
        print(f"First player: {data[0].get('nom')}")

if __name__ == '__main__':
    test_joueurs_api()
