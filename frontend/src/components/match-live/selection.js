import { estExclu } from "./chrono";

const NOMS = { rebonds: "rebond", passes: "passe", contres: "contre", fautes: "faute" };

// « 2 pts », « rebond »… ou « retirer 2 pts » en mode édition
export const libelleAction = ({ field, value, action }) => {
  const nom = field === "points" ? `${value} pt${value > 1 ? "s" : ""}` : NOMS[field] || field;
  return action === "decrement" ? `retirer ${nom}` : nom;
};

// Joueurs proposés pour une action, par numéro de maillot. Grisé : joueur exclu (ajout)
// ou qui n'a pas assez de la stat à retirer (mode édition)
export const joueursSelectionnables = (stats, action, match) =>
  [...stats]
    .sort((a, b) => a.joueur_numero - b.joueur_numero || a.id - b.id)
    .map((stat) => ({
      stat,
      grise: action.action === "decrement" ? (stat[action.field] || 0) < action.value : estExclu(stat, match),
    }));
