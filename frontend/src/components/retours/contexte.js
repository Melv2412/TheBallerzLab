import { createContext, useContext } from "react";

export const RetoursContext = createContext(null);

// Hors du provider (tests unitaires d'un composant isolé), on retombe sur les boîtes du navigateur
const repli = {
  succes: (message) => window.alert(message),
  info: (message) => window.alert(message),
  erreur: (message) => window.alert(message),
  confirmer: async ({ message }) => window.confirm(message),
};

export const useRetours = () => useContext(RetoursContext) ?? repli;
