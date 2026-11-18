// Présences de fin de match : logique sans React, testée dans presences.test.js

// Regroupe les joueurs par équipe, dans l'ordre donné par le serveur (domicile d'abord)
export const parEquipe = (joueurs) => {
  const equipes = new Map();
  for (const joueur of joueurs) {
    if (!equipes.has(joueur.equipe)) equipes.set(joueur.equipe, { id: joueur.equipe, nom: joueur.equipe_nom, joueurs: [] });
    equipes.get(joueur.equipe).joueurs.push(joueur);
  }
  return [...equipes.values()];
};

export const idsPresents = (joueurs) => joueurs.filter((j) => j.present).map((j) => j.joueur);

export const basculer = (ids, id) => (ids.includes(id) ? ids.filter((autre) => autre !== id) : [...ids, id]);
