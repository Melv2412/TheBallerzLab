# 05 — Roadmap

Règle : on reste sur les **plans gratuits** tant qu'il n'y a pas de client payant. Chaque phase a une partie 🆓 à faire maintenant et, parfois, une partie 💳 pour plus tard.

## Fait

| Phase | Contenu |
|---|---|
| 1 | Règlement configurable (FIBA, NBA, 3x3, personnalisé) |
| 2 🆓 | Sauvegarde hebdomadaire chiffrée, compression des images |
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

## À faire (gratuit)

| Phase | Contenu | Dépend de |
|---|---|---|
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
