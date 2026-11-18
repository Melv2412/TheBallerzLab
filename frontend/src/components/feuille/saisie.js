// Saisie de la feuille de match après coup : logique sans React, testée dans saisie.test.js
export const CHAMPS = [
  { cle: "points", label: "Pts" },
  { cle: "rebonds", label: "Reb" },
  { cle: "passes", label: "Pd" },
  { cle: "contres", label: "Ctr" },
  { cle: "fautes", label: "F" },
];

// Une ligne par joueur des deux équipes, préremplie avec ses stats déjà enregistrées.
// Un joueur retiré de l'effectif n'apparaît que s'il a déjà une ligne dans ce match.
export const lignesInitiales = (joueurs, statistiques = []) =>
  joueurs
    .filter((joueur) => !joueur.retire || statistiques.some((s) => s.joueur === joueur.id))
    .sort((a, b) => a.numero_maillot - b.numero_maillot)
    .map((joueur) => {
      const stat = statistiques.find((s) => s.joueur === joueur.id);
      return {
        joueur: joueur.id,
        equipe: joueur.equipe,
        libelle: `#${joueur.numero_maillot} ${joueur.prenom} ${joueur.nom}`,
        ...Object.fromEntries(CHAMPS.map(({ cle }) => [cle, stat ? stat[cle] : 0])),
      };
    });

// Périodes du règlement, ou celles déjà saisies (prolongations comprises)
export const periodesInitiales = (match) => {
  if (match.score_periodes) return match.score_periodes;
  const vide = Array(match.reglement.nb_periodes).fill("");
  return { domicile: [...vide], exterieur: [...vide] };
};

export const totalEquipe = (lignes, equipeId) =>
  lignes.filter((l) => l.equipe === equipeId).reduce((somme, l) => somme + (Number(l.points) || 0), 0);

const periodesRemplies = (periodes) => [...periodes.domicile, ...periodes.exterieur].some((v) => v !== "");

// Message d'erreur à afficher avant l'envoi, ou null si la saisie est cohérente
export const erreurSaisie = (match, lignes, periodes, terminer) => {
  const dom = totalEquipe(lignes, match.equipe_domicile);
  const ext = totalEquipe(lignes, match.equipe_exterieur);
  if (terminer && dom === ext) return "Match nul : un match ne peut pas se terminer sur une égalité.";
  if (!periodesRemplies(periodes)) return null;
  for (const [cote, total, nom] of [
    ["domicile", dom, match.equipe_domicile_nom],
    ["exterieur", ext, match.equipe_exterieur_nom],
  ]) {
    const somme = periodes[cote].reduce((s, v) => s + (Number(v) || 0), 0);
    if (somme !== total) return `${nom} : les périodes font ${somme} points, mais les joueurs en ont marqué ${total}.`;
  }
  return null;
};

export const donneesAEnvoyer = (lignes, periodes, terminer) => ({
  stats: lignes.map(({ joueur, ...ligne }) => ({
    joueur,
    ...Object.fromEntries(CHAMPS.map(({ cle }) => [cle, Number(ligne[cle]) || 0])),
  })),
  score_periodes: periodesRemplies(periodes)
    ? {
        domicile: periodes.domicile.map((v) => Number(v) || 0),
        exterieur: periodes.exterieur.map((v) => Number(v) || 0),
      }
    : null,
  terminer,
});
