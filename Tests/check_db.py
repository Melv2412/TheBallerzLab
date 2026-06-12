import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'basket_tournament.settings')
django.setup()

from tournois.models import Tournoi, Equipe, Match

def check_data():
    print("--- DIAGNOSTIC DES DONNEES ---")
    tournois = Tournoi.objects.all()
    for t in tournois:
        print(f"Tournoi: {t.nom} (ID: {t.id}, Slug: {t.slug})") # type: ignore
        equipes = Equipe.objects.filter(tournoi=t)
        print(f"  - Equipes: {equipes.count()}")
        for e in equipes:
            print(f"    * {e.nom} (ID: {e.id})") # type: ignore
        
        matchs = Match.objects.filter(tournoi=t)
        print(f"  - Matchs: {matchs.count()}")
    print("--- FIN DU DIAGNOSTIC ---")

if __name__ == '__main__':
    check_data()
