import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'basket_tournament.settings')
django.setup()

from tournois.models import Tournoi, Equipe, Match
from django.contrib.auth.models import User

def fix_ownership():
    print("--- VERIFICATION PROPRIETE ---")
    try:
        melvin = User.objects.get(username='Melvin')
        print(f"Utilisateur Melvin trouvé (ID: {melvin.id})")
    except User.DoesNotExist:
        print("ERREUR: Melvin n'existe pas !")
        return

    tournoi_inter = Tournoi.objects.get(id=1)
    print(f"Tournoi found: {tournoi_inter.nom}")
    
    if tournoi_inter.organisateur != melvin:
        print(f"Changement de propriétaire: {tournoi_inter.organisateur} -> Melvin")
        tournoi_inter.organisateur = melvin
        tournoi_inter.save()
    else:
        print("Melvin est déjà le propriétaire d'INTERPROMO.")

    # Vérification des équipes
    equipes = Equipe.objects.filter(tournoi=tournoi_inter)
    print(f"Nombre d'équipes rattachées: {equipes.count()}")
    for e in equipes:
        print(f" - {e.nom}")

    # Vérification des matchs
    matchs = Match.objects.filter(tournoi=tournoi_inter)
    print(f"Nombre de matchs rattachés: {matchs.count()}")
    
    print("--- FIN ---")

if __name__ == '__main__':
    fix_ownership()
