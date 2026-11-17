# Marqueur flow

**Acteur** : la personne à la table de marque (le compte de l'organisateur).
**Point de départ** : un match du calendrier.

Deux façons de saisir un match :

```mermaid
flowchart TD
    A[Match à venir] --> B{Suivi en direct ?}
    B -->|oui| C["Tableau de marque (/match/id/live)"]
    B -->|non| D["Feuille après coup (/match/id/saisie)"]
    C --> E[Match terminé]
    D -->|case « Terminer le match »| E
    E --> F[Feuille PDF, classement, phases finales, profils]
```

## A. Tableau de marque en direct

1. Page du match → **Live**. Les stats des joueurs sont initialisées.
2. Pendant le match :
   - **chrono** démarré et arrêté par le marqueur, calculé par le serveur (pas de dérive entre appareils) ;
   - **shot clock** (désactivable dans le règlement) ;
   - pour chaque joueur : points (1, 2, 3), rebonds, passes, interceptions, contres, balles perdues, **fautes** ;
   - **fautes d'équipe** et **bonus** par segment ; **temps morts** selon le règlement ;
   - **période suivante**, puis **prolongations** en cas d'égalité ;
   - un joueur atteint la limite de fautes → **exclu**.
3. Erreur de saisie → **« Annuler la dernière action »**.
4. Le règlement de ce match peut être ajusté (⚙️).
5. Fin du match → **terminé**, plus aucune modification. En phase finale, la série avance toute seule.

**Écran de salle** : `/match/<id>/ecran`, plein écran, à afficher sur un grand écran pendant le direct.

## B. Saisie de la feuille après coup

**Quand** : le match n'a pas été suivi en direct (papier, réseau absent).

1. Page du match → **Saisir la feuille** (organisateur, match non terminé).
2. Pour chaque joueur, ses **totaux** du match.
3. **Score par période** facultatif (prolongations comprises).
4. Case **« Terminer le match »** pour le clore.

**Effets** : les actions du direct éventuelles sont annulées ; le score par période est effacé si les stats changent ensuite.

## Après le match

- **Feuille de match** `/match/<id>/feuille` : imprimable ou en PDF.
- Le classement, le MVP et les profils athlètes se mettent à jour.

## Règles

- Seul l'organisateur du tournoi peut saisir.
- Pas de match nul.
- La première stat passe le match « en cours ».
- Deux saisies au même moment ne s'écrasent pas.

## Prévu

- ⏳ 6.1 : direct plus léger (moins de requêtes, puis temps réel).
- ⏳ 6.2 : rouvrir un match terminé (admin).
