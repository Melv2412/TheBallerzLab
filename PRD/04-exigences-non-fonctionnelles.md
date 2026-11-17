# 04 — Exigences non fonctionnelles

## Sécurité

| Exigence | Mise en œuvre |
|---|---|
| Seul l'organisateur modifie son tournoi | Vérifié côté serveur sur chaque objet et sur le tournoi ciblé ; un superuser n'en est pas propriétaire par défaut |
| Mots de passe | Argon2, règles de robustesse |
| Sessions | JWT de 15 min avec rotation et révocation |
| Anti-abus | Limitation des tentatives (connexion, inscription, recherche d'athlète, invitations) ; limites de tournois, d'équipes et de joueurs |
| Liens d'inscription et d'invitation | Codes aléatoires de 16 octets, régénérables (l'ancien lien meurt), visibles par l'organisateur seulement |
| Scores | Lecture seule hors des actions dédiées : impossible de modifier un score directement |
| Dépôt public | Aucun secret dans le code |

## Fiabilité des données

- Saisies simultanées : le match et le tournoi sont verrouillés pendant les écritures sensibles (pas de stat écrasée, pas de tour de phase finale créé deux fois).
- Un match terminé est figé.
- Sauvegarde hebdomadaire chiffrée de la base, conservée 90 jours (💳 restauration à un instant précis avec Supabase Pro).

## Performance

- Pages utilisables sur un téléphone en 4G dans une salle.
- Images compressées à 800 px en WebP avant l'envoi.
- API paginée.
- ⏳ 6.1 : réponses 304 quand le match n'a pas changé, puis temps réel.

## Disponibilité

- Hébergement Vercel (backend et frontend) et Supabase (base et images).
- Route de santé appelée chaque jour pour éviter la mise en pause de la base gratuite.
- ⏳ 4.3 : alertes d'erreur (Sentry).
- 💳 Le plan gratuit Vercel interdit l'usage commercial : passage en Pro avant le premier client payant.

## Données personnelles

| Donnée | Règle |
|---|---|
| Email du joueur | Jamais affiché publiquement ; sert à retrouver la fiche (recherche exacte) |
| Profil athlète | Public : nom, stats, tournois, photo |
| Photos de mineurs | ⏳ 6.4 : autorisation parentale |
| Suppression du compte | ⏳ 6.4 |
| CGU et politique de confidentialité | ⏳ 6.4, validation par un juriste 💳 |

## Ergonomie

- Responsive : téléphone, tablette (table de marque), grand écran (écran de salle).
- Messages d'erreur en français, lisibles, sans jargon technique.
- Actions destructrices confirmées (suppression, nouveau lien, délier, refuser).
