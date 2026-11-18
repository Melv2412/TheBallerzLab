export const SCORE_VAINQUEUR = 20;
export const SCORE_PERDANT = 0;

export const texteForfait = (match) => {
  if (match.forfait === "double") return "Double forfait";
  if (match.forfait === "domicile") return `Forfait de ${match.equipe_domicile_nom}`;
  if (match.forfait === "exterieur") return `Forfait de ${match.equipe_exterieur_nom}`;
  return "";
};

export const estForfait = (match, cote) => match.forfait === cote || match.forfait === "double";

// Choix proposés : le double forfait n'existe qu'en poule, une série doit avoir un vainqueur
export const choixForfait = (match) => [
  { valeur: "domicile", label: match.equipe_domicile_nom },
  { valeur: "exterieur", label: match.equipe_exterieur_nom },
  ...(match.phase === "poule" ? [{ valeur: "double", label: "Les deux équipes (double forfait)" }] : []),
];

export const valeursForfait = (match) => {
  if (!match.forfait || match.forfait === "double") {
    return { equipe: match.forfait || "domicile", vainqueur: SCORE_VAINQUEUR, perdant: SCORE_PERDANT };
  }
  return {
    equipe: match.forfait,
    vainqueur: Math.max(match.score_domicile, match.score_exterieur),
    perdant: Math.min(match.score_domicile, match.score_exterieur),
  };
};

export const erreurForfait = ({ equipe, vainqueur, perdant }) => {
  if (equipe === "double") return "";
  const gagne = Number(vainqueur);
  const perd = Number(perdant);
  if (!Number.isInteger(gagne) || !Number.isInteger(perd) || perd < 0 || gagne > 200 || perd > 200) {
    return "Les scores doivent être des nombres entiers entre 0 et 200.";
  }
  return gagne > perd ? "" : "Le vainqueur doit avoir plus de points que l'équipe forfait.";
};
