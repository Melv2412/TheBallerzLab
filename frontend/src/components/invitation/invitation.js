// Logique de la page d'invitation d'équipe (sans React, testée par Vitest)

// « Élodie  MARTIN » et « elodie martin » désignent la même personne
export const normaliserNom = (texte = "") =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Joueurs saisis par l'organisateur qui portent le nom de la fiche du compte (« C'est toi ? »)
export const suggestions = (joueurs, fiche) => {
  if (!fiche) return [];
  const prenom = normaliserNom(fiche.prenom);
  const nom = normaliserNom(fiche.nom);
  return joueurs.filter(
    (j) => !j.compte_lie && normaliserNom(j.prenom) === prenom && normaliserNom(j.nom) === nom,
  );
};

// Où revenir après connexion / inscription : seulement un chemin interne (pas de redirection vers un autre site)
export const cheminSuite = (search) => {
  const suite = new URLSearchParams(search).get("suite");
  return suite && suite.startsWith("/") && !suite.startsWith("//") && !suite.includes("\\") ? suite : null;
};

// Erreur à afficher avant d'envoyer l'inscription avec un numéro (null si tout va bien)
export const erreurInscription = ({ numero, prenom, nom }, avecFiche, joueurs) => {
  const valeur = Number(numero);
  if (numero === "" || !Number.isInteger(valeur) || valeur < 0 || valeur > 99) {
    return "Indique ton numéro de maillot (0 à 99).";
  }
  if (joueurs.some((j) => j.numero_maillot === valeur)) {
    return `Le numéro ${valeur} est déjà pris dans l'équipe.`;
  }
  if (!avecFiche && !(prenom.trim() && nom.trim())) return "Indique ton prénom et ton nom.";
  return null;
};
