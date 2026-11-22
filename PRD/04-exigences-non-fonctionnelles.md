# 04 — Exigences non fonctionnelles

## Sécurité

| Exigence | Mise en œuvre |
|---|---|
| Seul l'organisateur modifie son tournoi | Vérifié côté serveur sur chaque objet et sur le tournoi ciblé ; un superuser n'en est pas propriétaire par défaut ; un tournoi sans organisateur est réservé au staff |
| Tournoi privé | Filtré côté serveur sur le tournoi, ses équipes, joueurs, matchs et stats ; réponse 404 pour les autres comptes |
| Tournoi clôturé | Écritures refusées côté serveur, pas seulement masquées dans l'interface |
| Tâche quotidienne | Purge et nettoyage exécutés seulement avec le bon secret (`CRON_SECRET`) |
| Mots de passe | Argon2, règles de robustesse |
| Sessions | JWT de 15 min avec rotation et révocation |
| Anti-abus | Limitation des tentatives (connexion, inscription, recherche d'athlète, invitations) ; limites de tournois, d'équipes et de joueurs |
| Liens d'inscription et d'invitation | Codes aléatoires de 16 octets, régénérables (l'ancien lien meurt), visibles par l'organisateur seulement |
| Scores | Lecture seule hors des actions dédiées : impossible de modifier un score directement |
| Dépôt public | Aucun secret dans le code |

## Fiabilité des données

- Saisies simultanées : le match et le tournoi sont verrouillés pendant les écritures sensibles (pas de stat écrasée, pas de tour de phase finale créé deux fois).
- Un match terminé est figé, seules ses présences restent corrigeables.
- Les résultats sont protégés : équipe, joueur et match liés à des stats ne peuvent pas être supprimés par erreur ; formats et points se verrouillent quand la compétition a commencé.
- Un tournoi commencé passe 30 jours dans la corbeille avant d'être effacé.
- Un tirage au sort est fait côté serveur et ne peut pas être relancé.
- Les images sont effacées après la suppression en base ; la tâche quotidienne rattrape celles qui restent (limite Vercel de 30 s par requête).
- ⏳ Sauvegarde hebdomadaire chiffrée de la base, conservée 90 jours : le workflow est prêt, mais ses secrets GitHub restent à ajouter. Tant que ce n'est pas fait, aucune sauvegarde automatique ne tourne (💳 restauration à un instant précis avec Supabase Pro).

## Performance

- Pages utilisables sur un téléphone en 4G dans une salle.
- Images compressées à 800 px en WebP avant l'envoi.
- API paginée.
- ✅ 6.1 : réponses 304 quand le match n'a pas changé, temps réel Supabase.

## Disponibilité

- Hébergement Vercel (backend et frontend) et Supabase (base et images).
- Tâche planifiée chaque jour : elle garde la base gratuite éveillée, puis lance la purge et le nettoyage des images.
- ⏳ 4.3 : alertes d'erreur (Sentry).
- 💳 Le plan gratuit Vercel interdit l'usage commercial : passage en Pro avant le premier client payant.

## Données personnelles

| Donnée | Règle |
|---|---|
| Email du joueur | Jamais affiché publiquement ; sert à retrouver la fiche (recherche exacte) |
| Profil athlète | Public : nom, stats, tournois, photo ; rien sur les tournois privés |
| Photos et logos | Effacés du stockage avec la donnée à laquelle ils appartiennent, ou quand ils sont remplacés |
| Tournoi supprimé | Conservé 30 jours au plus dans la corbeille s'il a commencé, puis effacé avec ses images |
| Photos de mineurs | ⏳ 6.4 : autorisation parentale |
| Suppression du compte | ⏳ 6.4 |
| CGU et politique de confidentialité | ⏳ 6.4, validation par un juriste 💳 |

## Ergonomie

- Responsive : téléphone, tablette (table de marque), grand écran (écran de salle).
- Messages d'erreur en français, lisibles, sans jargon technique.
- Actions destructrices confirmées (suppression, nouveau lien, délier, refuser) ; pour supprimer un tournoi, il faut retaper son nom.
- Pas de boîte du navigateur (`alert`, `confirm`) : les erreurs et succès s'affichent en notification en bas de l'écran, les confirmations dans une fenêtre aux couleurs de l'app (`components/retours/`, hook `useRetours`).
- Une image manquante ne casse pas la page : un affichage de secours la remplace.
