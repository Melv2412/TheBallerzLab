# Application de Gestion de Tournois de Basket

Application web complète pour gérer des tournois de basket-ball, avec suivi en temps réel des statistiques des joueurs pendant les matchs.

## Stack Technique

- **Backend**: Django 5.2 LTS + Django REST Framework
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Base de données**: SQLite en local, PostgreSQL (Supabase) en prod

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

3. Activer le mode développement (sinon Django refuse de démarrer sans `DJANGO_SECRET_KEY`) : créer un fichier `.env` à la racine contenant :

```
DJANGO_DEBUG=True
```

4. Effectuer les migrations :

```bash
python manage.py migrate
```

5. Créer un superutilisateur (optionnel, pour l'admin Django) :

```bash
python manage.py createsuperuser
```

6. Lancer le serveur Django :

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
   - Le match passe « En cours » tout seul à la première stat saisie
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
│   ├── classement.py     # Classement et départage FIBA
│   ├── reglement.py      # Règlement configurable : préréglages FIBA/NBA/3x3 et validation
│   ├── services.py       # Calculs métier : classement du tournoi, MVP
│   ├── pagination.py     # Pagination des listes de l'API
│   └── urls.py           # URLs de l'API
├── frontend/             # Application React
│   ├── src/
│   │   ├── components/   # Pages (DetailTournoi, MatchLive...)
│   │   │   ├── tournoi/     # Onglets, modales et données de la page tournoi
│   │   │   └── match-live/  # Chrono, panneaux d'équipe et modales du match en direct
│   │   ├── api.js        # Fonctions API
│   │   ├── permissions.js # Qui peut modifier un tournoi (même règle que le serveur)
│   │   └── App.jsx       # Composant principal
│   └── package.json
└── requirements.txt       # Dépendances Python
```

## API Endpoints

Les listes sont paginées : `{count, next, previous, results}`, 50 éléments par page (`?page=2`), jusqu'à 500 avec `?page_size=500`.

- `GET /api/tournois/` - Liste des tournois
- `GET /api/equipes/?tournoi={id}` - Liste des équipes d'un tournoi
- `GET /api/joueurs/?equipe={id}` - Liste des joueurs d'une équipe
- `GET /api/matchs/?tournoi={id}` - Liste des matchs d'un tournoi
- `GET /api/matchs/{id}/` - Détail d'un match avec statistiques
- `POST /api/matchs/{id}/initialiser_stats/` - Initialiser les stats pour un match
- `PATCH /api/matchs/{id}/stats/{stat_id}/update/` - Mettre à jour une statistique (refusé si le match est terminé ou si le joueur est exclu)
- `POST /api/matchs/{id}/temps_mort/` - Temps mort (`{"equipe": "domicile"}`), selon la dotation du règlement
- `POST /api/matchs/{id}/periode_suivante/` - Période suivante (prolongation au-delà du temps réglementaire)
- `GET /api/reglements/` - Préréglages du règlement (FIBA, NBA, 3x3) et bornes des réglages
- `GET /api/tournois/{slug}/classement/` - Classement (points de victoire et de défaite selon le règlement ; égalités départagées selon la FIBA : confrontation directe, puis différence de points). Un match ne peut pas être terminé sur une égalité.

## Règlement configurable

Chaque tournoi a un règlement : préréglage **FIBA** (par défaut), **NBA**, **3x3**, ou personnalisé ([tournois/reglement.py](tournois/reglement.py)). Réglages : nombre et durée des périodes, durée des prolongations, shot clock (activable, durée, remise courte), fautes avant exclusion (0 = jamais), seuil de bonus des fautes d'équipe et leur remise à zéro (période, mi-temps ou match), temps morts par mi-temps et par prolongation, points de classement.

- Chaque match reçoit une **copie** du règlement à sa création. Modifier le règlement du tournoi met à jour les matchs à venir, jamais les matchs commencés.
- Un match se règle individuellement depuis son tableau de marque (⚙️) : tout avant le coup d'envoi ; pendant le match, seulement le shot clock, la durée des périodes et les temps morts ; rien une fois terminé.
- Un match terminé est figé (stats, chrono, temps morts) : le repasser « en cours » pour corriger.

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

## Tests et lint

```bash
# Backend
pip install -r requirements-dev.txt
python manage.py test tournois
ruff check .

# Frontend
cd frontend
npm test
npm run lint
```

Tout cela, plus la compilation du frontend, tourne automatiquement sur GitHub à chaque push ([.github/workflows/ci.yml](.github/workflows/ci.yml)). Certains tests vérifient le nombre de requêtes SQL des pages lourdes (classement, MVP, listes) : si une modification les ralentit, ils échouent. Les calculs métier (classement FIBA, MVP) sont dans [tournois/services.py](tournois/services.py) et [tournois/classement.py](tournois/classement.py), testables sans passer par l'API.

## Configuration (production)

Le même code tourne en local et en prod : tout se règle par variables d'environnement (ou un fichier `.env`, jamais commité). En local, `DJANGO_DEBUG=True` suffit : SQLite, médias dans `/media`. Sans `DJANGO_DEBUG=True`, `DJANGO_SECRET_KEY` est obligatoire (elle signe aussi les jetons de connexion).

La liste complète est dans [.env.example](.env.example). En résumé :

| Variable | Rôle |
|---|---|
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Sécurité Django |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | URLs du frontend / de l'API |
| `DATABASE_URL` | PostgreSQL (Supabase). Absente → SQLite |
| `STORAGE_*` | Supabase Storage pour les logos et photos. Absentes → dossier `/media` |

Côté frontend, `VITE_API_URL` et `VITE_MEDIA_URL` permettent de pointer vers un autre backend (par défaut, le proxy Vite redirige `/api` et `/media` vers `localhost:8000`).

### Déploiement (Vercel + Supabase)

Deux projets Vercel, branchés sur le même dépôt GitHub :

| Projet Vercel | Root Directory | Variables |
|---|---|---|
| Backend (ex. `thelab-api`) | `./` (racine) | celles de [.env.example](.env.example) |
| Frontend (ex. `thelab`) | `frontend` | `VITE_API_URL` (voir [frontend/.env.example](frontend/.env.example)) |

- **Backend** : Vercel détecte Django via `manage.py`, installe `requirements.txt`, lance `collectstatic` et sert l'app comme une fonction serverless. [vercel.json](vercel.json) exclut du bundle le frontend, la vidéo et les tests.
- **Frontend** : [frontend/vercel.json](frontend/vercel.json) renvoie toutes les routes vers `index.html` (sinon 404 au rechargement d'une page).
- Mettre l'URL du frontend dans `CORS_ALLOWED_ORIGINS` côté backend, et le domaine du backend dans `DJANGO_ALLOWED_HOSTS`.
- Sans les variables `STORAGE_*`, les images envoyées ne seraient pas conservées (le disque d'une fonction Vercel est temporaire).
- **Keep-alive Supabase** : sur le plan gratuit, Supabase met le projet en pause après 7 jours sans activité. Un cron Vercel ([vercel.json](vercel.json)) appelle chaque jour `/api/health/`, qui exécute un `SELECT 1` sur la base. Il ne tourne que sur le déploiement de production (visible dans Vercel > Settings > Cron Jobs).

Vercel ne lance pas les migrations : on les lance depuis son PC, en pointant temporairement sur Supabase. Pour ces commandes, utiliser la connexion **Session pooler** de Supabase (port 5432) :

```powershell
venv\Scripts\activate
$env:DATABASE_URL = "postgresql://postgres.<projet>:<mot-de-passe>@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"
python manage.py migrate
python manage.py createsuperuser
Remove-Item Env:DATABASE_URL   # revenir à SQLite en local
```

À refaire à chaque nouvelle migration, avant de déployer le code qui en dépend.

Protections actives en prod (`DJANGO_DEBUG=False`) : HTTPS obligatoire, cookies sécurisés, HSTS, connexion limitée à 10 tentatives/min et inscription à 20/heure par IP, images limitées à 2 Mo. Jetons de connexion : accès valable 15 min (renouvelé automatiquement), refresh token renouvelé à chaque usage et révoqué à la déconnexion. Sur Vercel, les compteurs de limitation sont propres à chaque instance de la fonction : c'est une protection de base, pas une garantie stricte.

### Sauvegardes

Le plan gratuit de Supabase n'a aucune sauvegarde. Le workflow [sauvegarde.yml](.github/workflows/sauvegarde.yml) exporte la base chaque lundi (et à la demande : onglet Actions > Sauvegarde de la base > Run workflow), la **chiffre**, et la garde 90 jours dans les artefacts GitHub (le dépôt est public : jamais de sauvegarde en clair).

Secrets à créer dans GitHub (Settings > Secrets and variables > Actions) :

| Secret | Valeur |
|---|---|
| `SUPABASE_DB_URL` | URL du **Session pooler** Supabase (port 5432), mot de passe compris |
| `BACKUP_PASSPHRASE` | Phrase secrète longue, à conserver hors de GitHub (sans elle, la sauvegarde est illisible) |

Restaurer (Postgres 17 et GnuPG installés) :

```bash
gpg --decrypt thelab-AAAA-MM-JJ.dump.gpg > thelab.dump
pg_restore --no-owner --no-privileges --clean --if-exists -d "postgresql://...:5432/postgres" thelab.dump
```

GitHub met en pause les workflows planifiés d'un dépôt sans commit pendant 60 jours : le relancer depuis l'onglet Actions si besoin. Les images (Supabase Storage) ne sont pas incluses.

### Migrer les données locales vers Supabase

```bash
# 1. Exporter depuis SQLite (sans variable DATABASE_URL)
python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -e admin.logentry -e sessions --indent 2 -o donnees.json

# 2. Créer les tables puis importer dans Supabase (avec DATABASE_URL définie, voir ci-dessus)
python manage.py migrate
python manage.py loaddata donnees.json
```

Les images déjà présentes dans `/media` sont à copier dans le bucket Supabase en gardant les mêmes chemins (`equipes/logos/…`, `joueurs/photos/…`).

## Notes

- Chaque tournoi appartient à son organisateur : lui seul peut modifier ses équipes, joueurs, matchs et stats (les autres utilisateurs ont un accès en lecture)
- Tous les matchs doivent appartenir à un tournoi
- Les scores sont calculés automatiquement à partir des points des joueurs
- La première statistique saisie sur un match « à venir » le passe « en cours » automatiquement ; un match « terminé » est figé (le repasser « en cours » pour corriger)
