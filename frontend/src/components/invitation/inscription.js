// Logique de la page d'inscription d'équipe (sans React, testée par Vitest)

// Espaces en trop retirés, comme côté serveur
export const nettoyerNomEquipe = (nom = "") => nom.split(/\s+/).filter(Boolean).join(" ");

// Erreur à afficher avant d'envoyer la demande (null si tout va bien)
export const erreurNomEquipe = (nom) => {
  const propre = nettoyerNomEquipe(nom);
  if (!propre) return "Indique le nom de ton équipe.";
  if (propre.length > 200) return "Le nom de l'équipe est trop long (200 caractères maximum).";
  return null;
};

// Ce que voit le capitaine selon l'état de sa demande
export const etapeCapitaine = ({ connecte, demande, ouvertes }) => {
  if (!connecte) return "connexion";
  if (demande?.statut === "acceptee") return "acceptee";
  if (demande?.statut === "en_attente") return "en_attente";
  if (!ouvertes) return "fermee";
  return demande?.statut === "refusee" ? "refusee" : "formulaire";
};
