import { useEffect, useState } from "react";
import { getReglements } from "../../api";

export const NOMS_PRESETS = { fiba: "FIBA", nba: "NBA", "3x3": "3x3", personnalise: "Personnalisé" };

// Nom du préréglage identique au règlement, sinon « personnalise » (même règle que le serveur : égalité stricte)
export const typeReglement = (reglement, presets) => {
  if (!reglement || !presets) return "personnalise";
  const identique = (preset) => {
    const cles = new Set([...Object.keys(preset), ...Object.keys(reglement)]);
    return [...cles].every((cle) => preset[cle] === reglement[cle]);
  };
  const nom = Object.entries(presets).find(([, preset]) => identique(preset))?.[0];
  return nom || "personnalise";
};

// Préréglages et bornes fournis par l'API
export function usePresets() {
  const [donnees, setDonnees] = useState(null);
  useEffect(() => {
    let actif = true;
    getReglements()
      .then((d) => actif && setDonnees(d))
      .catch((e) => console.error("Erreur préréglages:", e));
    return () => {
      actif = false;
    };
  }, []);
  return donnees;
}
