# 03 — Fonctionnalités

✅ en place · ⏳ prévu · 💳 nécessite un plan payant

## Comptes et accès

| Fonctionnalité | État | Règles |
|---|---|---|
| Création de compte | ✅ | Pseudo, email obligatoire et unique, mot de passe robuste ; connexion directe après l'inscription |
| Connexion organisateur / joueur | ✅ | Interrupteur en haut de la carte : thème sombre (organisateur) ou blanc et orange (joueur) |
| Types de compte | ✅ 6.2 | Le choix fait à l'inscription est enregistré : organisateur (en attente puis validé) ou joueur ; un joueur peut demander à devenir organisateur |
| Validation des organisateurs | ✅ | Un compte ne crée de tournoi qu'après validation par l'admin ; seuls les organisateurs en attente voient la ligne « en attente de validation » |
| Session sécurisée | ✅ | Jeton de 15 min renouvelé automatiquement, révoqué à la déconnexion |
| Mot de passe oublié | ⏳ 4.2 | Lien par email (service d'email gratuit à brancher) |

## Tournoi

| Fonctionnalité | État | Règles |
|---|---|---|
| Création et modification | ✅ | Nom unique par organisateur, dates contrôlées, phases finales choisies (8ᵉ, quarts, demis, finale), consécutives |
| Règlement | ✅ | Préréglages FIBA, NBA, 3x3 ou personnalisé ; modifiable match par match |
| Équipes et joueurs à la main | ✅ | Logo et photos compressés dans le navigateur ; numéro unique dans l'équipe |
| Lien d'inscription des équipes | ✅ 5.4 | Un lien par tournoi ; le capitaine propose, l'organisateur accepte ou refuse |
| Lien d'invitation des joueurs | ✅ 5.3 | Un lien par équipe ; « C'est toi ? » ou inscription avec numéro |
| Ouvrir / fermer les inscriptions | ✅ | Ferme les demandes d'équipe et les nouvelles inscriptions de joueurs |
| Calendrier | ✅ | Matchs de poule, dates à l'heure de Paris |
| Classement | ✅ | Règles FIBA, matchs nuls interdits |
| Phases finales | ✅ | Séries au meilleur de N, tableau généré depuis le classement, tour suivant automatique |
| MVP | ✅ | Meilleure évaluation moyenne, au moins la moitié des matchs de l'équipe joués |

## Match

| Fonctionnalité | État | Règles |
|---|---|---|
| Tableau de marque en direct | ✅ | Chrono horodaté côté serveur, shot clock, fautes d'équipe et bonus, temps morts, prolongations, exclusion |
| Annuler la dernière action | ✅ | Historique action par action |
| Saisie de la feuille après coup | ✅ 4.4 | Totaux par joueur, score par période facultatif, case « terminer le match » |
| Feuille de match imprimable / PDF | ✅ | `/match/{id}/feuille` |
| Écran de salle | ✅ | `/match/{id}/ecran`, plein écran |
| Match terminé figé | ✅ | Plus aucune modification |
| Rouvrir un match terminé | ✅ 6.2 | Depuis l'admin (action « Rouvrir »), avec les mêmes contrôles que l'appli |
| Direct plus léger | ✅ 6.1 | ETag/304 et temps réel Supabase (💳 au-delà des limites gratuites) |

## Joueur unique

| Fonctionnalité | État | Règles |
|---|---|---|
| Fiche athlète | ✅ 5.1 | Une fiche par personne, un athlète au maximum par tournoi ; rattachement par email exact |
| Profil public | ✅ 5.2 | Stats de carrière, tournois joués, palmarès, titres de MVP ; jamais l'email |
| Compte relié | ✅ 5.3 | Badge « compte vérifié » ; l'organisateur peut délier |
| Mon profil | ✅ 6.2 | 👤 à côté du pseudo ; sans fiche reliée, page qui explique comment rejoindre son équipe (aucune fiche créée) |
| Photo de profil | ✅ 6.2 | Ajoutée par le joueur relié, compressée dans le navigateur ; affichée sur le profil et dans les matchs (💳 au-delà de 1 Go de stockage) |
| Liaison automatique par email | ⏳ | Après la vérification des emails (4.2) |

## Administration

| Fonctionnalité | État |
|---|---|
| Validation des organisateurs en un clic | ✅ |
| Fusion des fiches athlètes en double | ✅ |
| Consultation des demandes d'équipes | ✅ |
| Filtre « en attente », tableau de bord, règlement lisible, rouvrir un match | ✅ 6.2 |
| Mode support (modifier n'importe quel tournoi avec trace) | ⏳ 6.3 |

## Hors périmètre (pour l'instant)

- Paiement en ligne des inscriptions.
- Application mobile native (le site est responsive).
- Vérification d'identité des joueurs (pas de pièce d'identité).
- Emails d'invitation en masse (💳 si le quota gratuit ne suffit pas).
