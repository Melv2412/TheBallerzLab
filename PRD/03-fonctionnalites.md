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
| Public ou privé | ✅ | Choix à la création, puis interrupteur sur la carte, visible par l'organisateur du tournoi seulement. Privé : seuls l'organisateur et le staff voient le tournoi, ses équipes, joueurs, matchs et stats ; pour les autres, il n'existe pas (404). Confirmation si le tournoi a déjà des équipes ou des matchs |
| Règlement | ✅ | Préréglages FIBA, NBA, 3x3 ou personnalisé ; modifiable match par match. Mode de classement et points de victoire / défaite modifiables pendant toute la poule, verrouillés dès que le tableau des phases finales existe ; choisir le classement au % met 1 / 0 automatiquement |
| Équipes et joueurs à la main | ✅ | Logo et photos compressés dans le navigateur ; numéro unique dans l'équipe |
| Protection des équipes et joueurs | ✅ | Équipe avec un match commencé non supprimable. Joueur avec des stats : ni suppression ni changement d'équipe, mais « Retirer » de l'effectif et « Remettre » |
| Lien d'inscription des équipes | ✅ 5.4 | Un lien par tournoi ; le capitaine propose, l'organisateur accepte ou refuse ; marche aussi pour un tournoi privé, sans ouvrir sa page |
| Lien d'invitation des joueurs | ✅ 5.3 | Un lien par équipe ; « C'est toi ? » ou inscription avec numéro ; marche aussi pour un tournoi privé, sans ouvrir sa page |
| Ouvrir / fermer les inscriptions | ✅ | Ferme les demandes d'équipe et les nouvelles inscriptions de joueurs |
| Calendrier | ✅ | Matchs de poule, dates à l'heure de Paris |
| Classement | ✅ | Deux modes au choix dans le règlement. **Aux points (FIBA)**, par défaut : forfait = points de victoire au gagnant, 0 au fautif. **Au % de victoires** (preset NBA, comme la plateforme EBL) : % de victoires, puis différence de points, puis points marqués, sans confrontation directe ; équipe sans match classée après les autres ; forfait = défaite, score compris. Matchs nuls interdits |
| Égalité parfaite sur une place qualificative | ✅ | Poules finies et aucun critère FIBA ne sépare les équipes : tableau bloqué jusqu'à la décision de l'organisateur. Ordre choisi (modifiable jusqu'à la création du tableau) ou tirage au sort côté serveur (définitif). La décision vaut aussi pour le classement de poule, tant que le même groupe reste à égalité. Égalité sans enjeu de qualification : ordre alphabétique |
| Phases finales | ✅ | Séries au meilleur de N, tableau généré depuis le classement, tour suivant automatique ; format d'une phase verrouillé dès qu'elle a commencé |
| MVP | ✅ | Meilleure évaluation moyenne, au moins la moitié des matchs de l'équipe joués ; forfaits exclus du calcul |
| Clôture | ✅ | Par l'organisateur (par le staff si le tournoi n'a plus d'organisateur). Refusée si un match est en cours ; matchs à venir signalés avant de confirmer. Tournoi en lecture seule pour tous, staff compris, place de tournoi actif libérée. Restent possibles : consulter, supprimer, changer public / privé, « C'est moi » sur un joueur existant, délier un compte |
| Réouverture | ✅ | Staff uniquement, bouton « Rouvrir le tournoi » dans le bandeau « Tournoi clôturé » |
| Suppression | ✅ | Confirmation en retapant le nom, avec aperçu de ce qui sera perdu. Aucun match commencé : effacement immédiat. Sinon : corbeille de 30 jours |
| Corbeille | ✅ | Tournoi invisible, nom réservé. « Restaurer » (refusé si la limite de tournois actifs est atteinte) ou « Supprimer définitivement » ; effacement automatique après 30 jours |
| Compte organisateur supprimé | ✅ | Le tournoi est conservé et passe sous la responsabilité du staff |

## Match

| Fonctionnalité | État | Règles |
|---|---|---|
| Tableau de marque en direct | ✅ | Chrono horodaté côté serveur, shot clock, fautes d'équipe et bonus, temps morts, prolongations, exclusion. Sur téléphone : bandeau collé en haut, choix du joueur dans une feuille du bas, « Annuler » fixe |
| Annuler la dernière action | ✅ | Historique action par action |
| Stats séparées du chrono | ✅ | « Activer les feuilles de stats » sur la page du match : stats action par action (+1, +2, +3, +/−), période en cours et bouton « Période suivante ». Permet de séparer la personne au chrono de celle aux stats |
| Période suivante | ✅ | Libre pendant le temps réglementaire. Après la dernière période ou une prolongation, refusée s'il n'y a pas égalité, avec un message qui demande de terminer le match |
| Saisie de la feuille après coup | ✅ 4.4 | Totaux par joueur, score par période facultatif, case « terminer le match » |
| Feuille de match imprimable / PDF | ✅ | `/match/{id}/feuille` |
| Écran de salle | ✅ | `/match/{id}/ecran`, plein écran. QR code « Suivre en direct » dans le coin (masqué pour un tournoi privé) |
| Partage et QR code | ✅ | Bouton « Partager » sur la page du match et celle du tournoi : QR code, partage natif du téléphone (sinon copie du lien), image PNG du QR à imprimer. Match en cours ou à venir : lien vers le direct ; terminé : vers la fiche, plus une image carrée du résultat (score, vainqueur, MVP). Tournoi privé : avertissement, le lien ne s'ouvre que pour l'organisateur |
| Match terminé figé | ✅ | Plus de stats ni de score modifiables, suppression directe interdite ; seules les présences restent corrigeables |
| Rouvrir un match terminé | ✅ 6.2 | Depuis l'admin (action « Rouvrir »), avec les mêmes contrôles que l'appli |
| Direct plus léger | ✅ 6.1 | ETag/304 et temps réel Supabase (💳 au-delà des limites gratuites) |

## Présences

| Fonctionnalité | État | Règles |
|---|---|---|
| Règle « a joué » | ✅ | Au moins une stat, ou présence confirmée. Les anciennes lignes à 0 partout comptent comme absentes |
| Confirmation en fin de match | ✅ | Pop-up après le direct et après une feuille saisie : joueurs à 0 partout, par équipe, personne pré-coché. Non bloquant : si on le ferme, ils n'ont pas joué |
| Correction | ✅ | Bouton « Présences » sur un match terminé, sans le rouvrir |
| Effet sur les stats | ✅ | Seuls les présents comptent dans les moyennes, le nombre de matchs et le top joueurs |

## Forfait

Un forfait compte pour le tournoi (classement, séries, qualification, titre), jamais pour les stats individuelles.

| Fonctionnalité | État | Règles |
|---|---|---|
| Forfait d'une équipe | ✅ | Sur un match à venir ou en cours. Score 20-0 par défaut, modifiable, jamais recalculé depuis les stats |
| Double forfait | ✅ | En poule seulement : 0-0, 0 point chacun, pas de vainqueur. Refusé en phase finale, où une série doit avoir un vainqueur |
| Forfait général | ✅ | L'équipe perd 20-0 tous ses matchs pas encore terminés |
| Stats individuelles | ✅ | Match exclu des moyennes, des matchs joués, du MVP et du top joueurs. Stats déjà saisies gardées mais ignorées, rendues si le forfait est annulé |
| Affichage | ✅ | Mention « Forfait », pas de feuille de stats |

## Joueur unique

| Fonctionnalité | État | Règles |
|---|---|---|
| Fiche athlète | ✅ 5.1 | Une fiche par personne, un athlète au maximum par tournoi ; rattachement par email exact |
| Profil public | ✅ 5.2 | Stats de carrière, tournois joués, palmarès, titres de MVP ; jamais l'email. Les stats d'un tournoi privé n'y figurent pas tant qu'il reste privé |
| Compte relié | ✅ 5.3 | Badge « compte vérifié » ; l'organisateur peut délier |
| Mon profil | ✅ 6.2 | 👤 à côté du pseudo ; sans fiche reliée, page qui explique comment rejoindre son équipe (aucune fiche créée) |
| Postes | ✅ | Le joueur relié choisit lui-même un ou plusieurs des 5 postes (meneur, arrière, ailier, ailier fort, pivot), valables dans tous ses tournois ; affichés sur le profil, les effectifs, la fiche et la feuille de match et le live, rien s'il n'en a pas choisi |
| Numéro par tournoi | ✅ | Le joueur relié change lui-même son numéro dans chaque équipe depuis son profil : 0 à 99, libre dans l'équipe, tournoi pas clôturé, joueur toujours dans l'effectif |
| Photo de profil | ✅ 6.2 | Ajoutée par le joueur relié, compressée dans le navigateur ; affichée sur le profil et dans les matchs (💳 au-delà de 1 Go de stockage) |
| Liaison automatique par email | ⏳ | Après la vérification des emails (4.2) |

## Images

| Fonctionnalité | État | Règles |
|---|---|---|
| Effacement avec les données | ✅ | Par lot, après la suppression en base. Tournoi : logos et photos des joueurs. Équipe : logo et photos. Joueur : photo d'inscription, et photo de profil seulement si sa fiche disparaît. Compte : photo de profil. Image remplacée : ancien fichier |
| Fusion de fiches | ✅ | La photo est gardée si la fiche cible n'en a pas, sinon elle est effacée |
| Tâche quotidienne | ✅ | Vide la corbeille expirée, efface les images en attente, puis les fichiers que plus rien n'utilise depuis au moins 1 jour |
| Image manquante | ✅ | Affichage de secours à la place de l'image |

## Administration

| Fonctionnalité | État |
|---|---|
| Validation des organisateurs en un clic | ✅ |
| Fusion des fiches athlètes en double | ✅ |
| Consultation des demandes d'équipes | ✅ |
| Filtre « en attente », tableau de bord, règlement lisible, rouvrir un match | ✅ 6.2 |
| Voir tous les tournois, privés compris | ✅ |
| Rouvrir un tournoi clôturé (depuis le site) | ✅ |
| Mode support (modifier n'importe quel tournoi avec trace) | ⏳ 6.3 |

## Hors périmètre (pour l'instant)

- Paiement en ligne des inscriptions.
- Application mobile native (le site est responsive).
- Vérification d'identité des joueurs (pas de pièce d'identité).
- Emails d'invitation en masse (💳 si le quota gratuit ne suffit pas).
