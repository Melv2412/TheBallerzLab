# Application de Gestion de Tournois de Basket

Application web complète pour gérer des tournois de basket-ball, avec suivi en temps réel des statistiques des joueurs pendant les matchs.

## Stack Technique

- **Backend**: Django 4.2 + Django REST Framework
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Base de données**: SQLite (par défaut)

## Installation

### Backend

1. Créer un environnement virtuel Python :

```bash
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate
```

2. Installer les dépendances :

```bash
pip install -r requirements.txt
```

3. Effectuer les migrations :

```bash
python manage.py makemigrations
python manage.py migrate
```

4. Créer un superutilisateur (optionnel, pour l'admin Django) :

```bash
python manage.py createsuperuser
```

5. Lancer le serveur Django :

```bash
python manage.py runserver
```

Le backend sera accessible sur `http://localhost:8000`

### Frontend

1. Aller dans le dossier frontend :

```bash
cd frontend
```

2. Installer les dépendances :

```bash
npm install
```

3. Lancer le serveur de développement :

```bash
npm run dev
```

Le frontend sera accessible sur `http://localhost:3000`

## Utilisation

1. **Créer un tournoi** : Sur la page d'accueil, cliquez sur "Nouveau Tournoi"
2. **Ajouter des équipes** : Dans le détail du tournoi, ajoutez des équipes
3. **Ajouter des joueurs** : Cliquez sur une équipe pour l'étendre et ajouter des joueurs
4. **Créer un match** : Créez un match entre deux équipes
5. **Gérer les stats en temps réel** :
   - Allez sur la page du match
   - Cliquez sur "Initialiser les statistiques des joueurs"
   - Changez le statut du match à "En cours"
   - Utilisez les boutons +1, +2, +3 pour les points, et +1/-1 pour les autres stats
   - Le score du match se met à jour automatiquement

## Structure du Projet

```
Basket4.0/
├── basket_tournament/     # Configuration Django
├── tournois/              # Application Django principale
│   ├── models.py         # Modèles (Tournoi, Equipe, Joueur, Match, StatistiqueJoueur)
│   ├── serializers.py    # Serializers DRF
│   ├── views.py          # ViewSets DRF
│   └── urls.py           # URLs de l'API
├── frontend/             # Application React
│   ├── src/
│   │   ├── components/   # Composants React
│   │   ├── api.js        # Fonctions API
│   │   └── App.jsx       # Composant principal
│   └── package.json
└── requirements.txt       # Dépendances Python
```

## API Endpoints

- `GET /api/tournois/` - Liste des tournois
- `GET /api/equipes/?tournoi={id}` - Liste des équipes d'un tournoi
- `GET /api/joueurs/?equipe={id}` - Liste des joueurs d'une équipe
- `GET /api/matchs/?tournoi={id}` - Liste des matchs d'un tournoi
- `GET /api/matchs/{id}/` - Détail d'un match avec statistiques
- `POST /api/matchs/{id}/initialiser_stats/` - Initialiser les stats pour un match
- `PATCH /api/matchs/{id}/stats/{stat_id}/update/` - Mettre à jour une statistique

## Fonctionnalités

- ✅ Création/gestion de tournois
- ✅ Gestion des équipes et joueurs
- ✅ Création de matchs
- ✅ Suivi des statistiques en temps réel (points, passes, rebonds, contres, fautes)
- ✅ Calcul automatique des scores et classements
- ✅ **Nouveau**: Classement automatique des équipes (Pts/Diff)
- ✅ **Nouveau**: Leaderboard des meilleurs joueurs (Évaluation moyenne)
- ✅ **Nouveau**: MVP par match avec suivi live des performances
- ✅ **Nouveau**: Impression de rapports de tournoi (PDF-ready)
- ✅ Interface responsive avec Tailwind CSS
- ✅ Design moderne (Jaune, Violet, Noir)

## Notes

- L'application est conçue pour un seul utilisateur (créateur/arbitre)
- Tous les matchs doivent appartenir à un tournoi
- Les scores sont calculés automatiquement à partir des points des joueurs
- Les statistiques ne peuvent être modifiées que lorsque le match est "en cours"
