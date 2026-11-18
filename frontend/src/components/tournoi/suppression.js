const normaliser = (texte) => String(texte ?? "").trim().split(/\s+/).join(" ").toLocaleLowerCase("fr");

// Même règle que le serveur : majuscules et espaces en trop ne comptent pas
export const nomConfirme = (saisie, nom) => normaliser(saisie) !== "" && normaliser(saisie) === normaliser(nom);

const compte = (nombre, singulier, pluriel = `${singulier}s`) => `${nombre} ${nombre > 1 ? pluriel : singulier}`;

export function lignesPertes(apercu) {
  const matchs = compte(apercu.matchs, "match", "matchs");
  return [
    compte(apercu.equipes, "équipe"),
    compte(apercu.joueurs, "joueur"),
    apercu.matchs_termines > 0 ? `${matchs}, dont ${compte(apercu.matchs_termines, "terminé")}` : matchs,
    compte(apercu.images, "image"),
  ];
}

export function consequenceSuppression(apercu, definitive = false) {
  if (definitive) return "Le tournoi sera effacé tout de suite. Cette action est irréversible.";
  if (apercu.corbeille) {
    return `Le tournoi ira dans la corbeille pendant ${apercu.jours} jours : tu pourras le restaurer. Ensuite, tout sera effacé.`;
  }
  return "Aucun match n'a été joué : le tournoi sera effacé tout de suite, sans passer par la corbeille.";
}

export const texteJoursRestants = (jours) =>
  jours > 1 ? `Effacé dans ${jours} jours` : "Effacé dans moins de 24 h";
