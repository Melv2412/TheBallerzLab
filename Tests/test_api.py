import os
import django
from rest_framework.test import APIRequestFactory
from tournois.views import EquipeViewSet
from django.contrib.auth.models import User

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'basket_tournament.settings')
django.setup()

def test_equipes_filter():
    factory = APIRequestFactory()
    view = EquipeViewSet.as_view({'get': 'list'})
    
    # Simuler Melvin
    melvin = User.objects.get(username='Melvin')
    
    # Test avec ID
    request = factory.get('/api/equipes/', {'tournoi': '1'})
    # On n'a pas besoin d'authentifier pour get_queryset en général si c'est public, 
    # mais views.py utilise IsOwnerOrReadOnly
    from rest_framework.test import force_authenticate
    force_authenticate(request, user=melvin)
    
    response = view(request)
    print(f"Status ID 1: {response.status_code}")
    print(f"Count ID 1: {len(response.data.get('results', response.data))}")
    
    # Test avec Slug
    request_slug = factory.get('/api/equipes/', {'tournoi': 'interpromo'})
    force_authenticate(request_slug, user=melvin)
    response_slug = view(request_slug)
    print(f"Status Slug interpromo: {response_slug.status_code}")
    print(f"Count Slug interpromo: {len(response_slug.data.get('results', response_slug.data))}")

if __name__ == '__main__':
    test_equipes_filter()
