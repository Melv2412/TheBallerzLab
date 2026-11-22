// File des notifications : les plus récentes en bas, au plus MAX_VISIBLES à la fois

export const MAX_VISIBLES = 3;

// Une erreur reste plus longtemps : on doit avoir le temps de la lire
export const DUREES_MS = { succes: 3500, info: 4500, erreur: 7000 };

export const ajouterNotification = (file, notification) => {
  // Le même message répété (double clic, plusieurs refus) n'empile pas de doublons
  const sansDoublon = file.filter((n) => !(n.message === notification.message && n.type === notification.type));
  return [...sansDoublon, notification].slice(-MAX_VISIBLES);
};

export const retirerNotification = (file, id) => file.filter((n) => n.id !== id);
