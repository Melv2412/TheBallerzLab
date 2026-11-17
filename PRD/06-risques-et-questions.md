# 06 — Risques et questions ouvertes

## Risques

| Risque | Impact | Parade |
|---|---|---|
| Le chrono n'a jamais servi sur un vrai match en prod | Perte de confiance le jour J | Tester sur un match amical avant un tournoi réel |
| Réseau faible dans la salle | Saisie bloquée | Saisie de la feuille après coup en secours ; ⏳ direct plus léger (6.1) |
| Erreurs découvertes par les utilisateurs, pas par une alerte | Panne longue | ⏳ Sentry (4.3) |
| Usage commercial sur le plan gratuit Vercel | Non-conformité | Passer en Pro avant le premier client (6.5) |
| Mauvaise personne qui réclame un joueur | Stats sur le mauvais profil | L'organisateur peut délier ; liaison auto seulement après vérification des emails |
| Faux capitaines qui inscrivent des équipes | Tournoi pollué | Validation obligatoire par l'organisateur ; lien régénérable ou désactivable |
| Photos de mineurs publiques | Risque juridique | ⏳ Autorisation parentale (6.4) |
| Limites des plans gratuits (stockage 1 Go, connexions temps réel) | Blocage sur un gros tournoi | Surveiller ; plans payants |

## Questions ouvertes

1. **Modèle économique** : qui paie (organisateur, club, fédération) et pour quoi ?
2. **Capitaine** : doit-il pouvoir gérer son effectif (retirer un joueur, changer le logo) sans l'organisateur ?
3. **Inscription payante** : faut-il encaisser les frais d'inscription des équipes dans l'app ?
4. **Notifications** : prévenir le capitaine par email quand son équipe est acceptée (dépend de 4.2) ?
5. **Mineurs** : âge minimum pour créer un compte joueur ?
6. **Fédérations** : quel format de feuille de match et de statistiques exigeraient-elles ?
