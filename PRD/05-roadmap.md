# 05 — Roadmap

Règle : on reste sur les **plans gratuits** tant qu'il n'y a pas de client payant. Chaque phase a une partie 🆓 à faire maintenant et, parfois, une partie 💳 pour plus tard.

## Fait

| Phase | Contenu |
|---|---|
| 1 | Règlement configurable (FIBA, NBA, 3x3, personnalisé) |
| 2 🆓 | Compression des images, workflow de sauvegarde hebdomadaire chiffrée (pas encore activé) |
| 3 | Phases finales en séries, historique et annulation, feuille de match PDF, écran de salle |
| 4.1 | Heure de Paris, limite d'exclusion, match « en cours » à la première stat |
| 4.4 | Saisie de la feuille de match après coup |
| 4.5 | Nom de tournoi unique par organisateur |
| 5.1 | Fiche athlète |
| 5.2 | Profil athlète et stats de carrière |
| 5.3 | Comptes joueurs par lien d'invitation d'équipe |
| — | Connexion / inscription organisateur ou joueur |
| 5.4 | Inscription des équipes par lien de tournoi, validée par l'organisateur |
| 6.1 🆓 | Direct plus léger : ETag/304, Supabase Realtime, RLS sur toutes les tables |
| 6.2 🆓 | Admin (filtre « en attente », tableau de bord, règlement lisible, rouvrir un match), types de compte, bandeaux discrets, « Mon profil », photo de profil |
| Lot 1 | Résultats protégés : équipes, joueurs et matchs liés à des résultats, formats et points verrouillés, tournoi conservé si le compte organisateur disparaît |
| Lot 2 | Présences confirmées en fin de match, moyennes limitées aux joueurs présents |
| Lot 3 | Forfait, double forfait et forfait général, sans effet sur les stats individuelles |
| Lot 4 | Corbeille de 30 jours, confirmation renforcée, effacement des images, tâche quotidienne, affichage de secours |
| — | Tournoi public ou privé |
| Lot 5 | Clôture et réouverture d'un tournoi, égalité parfaite tranchée par l'organisateur ou par tirage au sort |

## À faire (gratuit)

| Phase | Contenu | Dépend de |
|---|---|---|
| 2 | Activer la sauvegarde hebdomadaire, puis la tester une fois | Secrets GitHub (propriétaire) |
| 4.2 | Mot de passe oublié | Compte Resend (propriétaire) |
| 4.3 | Suivi des erreurs | Compte Sentry (propriétaire) |
| 6.3 | Mode support avec bandeau et trace des modifications | — |
| 6.4 | CGU, confidentialité, suppression du compte, mineurs | — |
| — | Liaison automatique des athlètes par email | 4.2 (emails vérifiés) |

## Plus tard (payant)

| Phase | Contenu |
|---|---|
| 6.5 | Vercel Pro et Supabase Pro, **avant le premier client payant** |
| 2 💳 | Restauration à un instant précis, plus de stockage d'images |
| 6.1 💳 | Plus de connexions temps réel simultanées |
| 6.2 💳 | Stockage des photos au-delà de 1 Go |
| 6.4 💳 | Validation juridique |

## Perspectives (idées, pas encore planifiées)

| Idée | Notes |
|---|---|
| Éditions d'une même compétition | Une fiche « Compétition » (nom, logo, organisateur) au-dessus des tournois : chaque tournoi devient une édition (ex. EBL, InterPromo). Format du nom d'édition au choix : **par date** (« EBL 2026-27 », « InterPromo 2028 ») ou **par numéro** (« EBL 2 »). Matchs, classement, invitations et stats restent rattachés à l'édition ; lien optionnel, rien ne casse pour les tournois existants. Apports : page de la compétition avec ses éditions et son palmarès, « Nouvelle édition » qui reprend le règlement et les équipes, stats cumulées sur toutes les éditions |
| Aller-retour au score cumulé | Deux matchs dont on additionne les points (en plus des séries « au meilleur des N » déjà réglables par phase) |
| Application installable (PWA) | Manifest (nom, logo, couleurs, plein écran) et petit script de mise en cache : Chrome propose « Installer l'application », ouverture sans barre du navigateur, icône dans la liste des applis. Mode hors ligne non requis ; notifications push possibles ensuite |
