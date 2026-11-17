# 02 — Personas

| Persona | Rôle dans l'app | Compte | Parcours |
|---|---|---|---|
| **Administrateur** (équipe THE LAB) | Valide les organisateurs, corrige les données, fusionne les doublons | Superuser Django | [admin-flow](userflows/admin-flow.md) |
| **Organisateur** | Crée et gère ses tournois de A à Z | Compte validé par l'admin | [organisateur-flow](userflows/organisateur-flow.md) |
| **Marqueur** (souvent l'organisateur) | Tient le tableau de marque pendant un match, ou saisit la feuille après coup | Compte de l'organisateur | [marqueur-flow](userflows/marqueur-flow.md) |
| **Capitaine** | Inscrit son équipe dans un tournoi et fait venir ses joueurs | Compte joueur | [capitaine-flow](userflows/capitaine-flow.md) |
| **Joueur** | Rejoint son équipe, consulte son profil et ses stats | Compte joueur (email obligatoire) | [joueur-flow](userflows/joueur-flow.md) |
| **Spectateur** | Suit les scores, classements et stats | Aucun | [spectateur-flow](userflows/spectateur-flow.md) |

## Détail

### Administrateur
- **Objectif** : garder la plateforme propre et éviter les abus.
- **Frustrations à éviter** : faux organisateurs, doublons de joueurs, devoir passer par la base de données pour corriger.
- **Outil** : l'admin Django, aux couleurs de THE LAB.

### Organisateur
- **Profil** : bénévole d'association, organisateur de tournoi d'été ou de playground. Peu de temps, souvent sur téléphone le jour J.
- **Objectif** : un tournoi qui se déroule sans contestation, avec le moins de saisie possible.
- **Frustrations** : saisir 200 joueurs à la main, recalculer un classement, gérer les inscriptions sur WhatsApp.
- **Limites** : 3 tournois actifs, 32 équipes par tournoi, 25 joueurs par équipe.

### Marqueur
- **Contexte** : à la table de marque, pendant le match, souvent sur tablette ou téléphone.
- **Objectif** : ne rien rater (points, fautes, temps morts) et pouvoir corriger une erreur immédiatement.
- **Frustrations** : chrono qui dérive, mauvaise touche impossible à annuler.

### Capitaine
- **Objectif** : inscrire son équipe vite et faire venir ses coéquipiers.
- **Attente** : un seul lien à recevoir, un seul lien à transférer sur le groupe de l'équipe.

### Joueur
- **Objectif** : apparaître dans son équipe avec le bon numéro et retrouver ses stats après le tournoi.
- **Attente** : un profil unique, même s'il joue plusieurs tournois avec des organisateurs différents.

### Spectateur
- **Objectif** : savoir qui gagne, qui joue ensuite, qui est le meilleur joueur.
- **Attente** : aucune inscription, pages lisibles sur téléphone et sur grand écran.
