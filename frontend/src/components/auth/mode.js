import { cheminSuite } from "../invitation/invitation";

// Connexion / inscription en mode organisateur (sombre et orange) ou joueur (blanc et orange)
export const modeAuth = (search) => {
  const mode = new URLSearchParams(search).get("mode");
  if (mode === "joueur" || mode === "orga") return mode;
  return cheminSuite(search) ? "joueur" : "orga"; // venu d'un lien d'invitation : c'est un joueur
};

// Lien vers /login ou /register qui garde le mode et le retour à l'invitation
export const lienAuth = (page, mode, suite) => {
  const params = new URLSearchParams({ mode });
  if (suite) params.set("suite", suite);
  return `/${page}?${params}`;
};

export const THEMES = {
  orga: {
    carte: "glass-card border-primary-orange/20",
    halo: "bg-primary-orange/20",
    titre: "text-white",
    sousTitre: "text-gray-400",
    label: "text-gray-500",
    champ:
      "bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary-orange",
    oeil: "text-gray-500 hover:text-white",
    bas: "text-gray-500",
    switch: "bg-white/5 border border-white/10",
    inactif: "text-gray-400 hover:text-white",
  },
  joueur: {
    carte: "bg-white border-2 border-primary-orange/40 rounded-3xl shadow-2xl shadow-primary-orange/20",
    halo: "bg-primary-orange/25",
    titre: "text-gray-900",
    sousTitre: "text-gray-500",
    label: "text-gray-500",
    champ:
      "bg-orange-50/60 border border-orange-200 text-gray-900 placeholder-gray-400 focus:border-primary-orange focus:bg-white",
    oeil: "text-gray-400 hover:text-primary-orange",
    bas: "text-gray-500",
    switch: "bg-white border border-orange-200",
    inactif: "text-gray-500 hover:text-primary-orange",
  },
};
