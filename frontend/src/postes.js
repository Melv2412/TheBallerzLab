// Les 5 postes, dans l'ordre du terrain ; le joueur en choisit un ou plusieurs sur son profil
export const POSTES = [
  { code: "meneur", label: "Meneur" },
  { code: "arriere", label: "Arrière" },
  { code: "ailier", label: "Ailier" },
  { code: "ailier_fort", label: "Ailier fort" },
  { code: "pivot", label: "Pivot" },
];

const LABELS = Object.fromEntries(POSTES.map(({ code, label }) => [code, label]));

// « Meneur / Arrière », ou "" si le joueur n'a rien choisi (on n'affiche alors rien)
export const libellePostes = (postes) => (postes || []).filter((code) => LABELS[code]).map((code) => LABELS[code]).join(" / ");
