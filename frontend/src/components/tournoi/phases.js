export const PHASES = [
  { cle: "has_8emes", label: "8èmes", phase: "8eme", victoires: "victoires_requises_8eme", labelVictoires: "8èmes" },
  { cle: "has_quarts", label: "Quarts", phase: "quart", victoires: "victoires_requises_quart", labelVictoires: "Quarts" },
  { cle: "has_demis", label: "Demis", phase: "demi", victoires: "victoires_requises_demi", labelVictoires: "Demis" },
  { cle: "has_finale", label: "Finale", phase: "finale", victoires: "victoires_requises_finale", labelVictoires: "Finale" },
];

// Même règle que le serveur : phases actives consécutives, jusqu'à la finale
export const erreurPhases = (form) => {
  const actives = PHASES.filter((p) => form[p.cle]);
  if (!actives.length) return null;
  if (actives[actives.length - 1].phase !== "finale") return "Les phases finales doivent se terminer par la finale.";
  const manquantes = PHASES.slice(PHASES.indexOf(actives[0])).filter((p) => !form[p.cle]);
  if (manquantes.length) {
    return `Les phases finales doivent se suivre sans trou : activez aussi : ${manquantes.map((p) => p.label).join(", ")}.`;
  }
  return null;
};
