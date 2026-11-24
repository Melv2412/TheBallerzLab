// Carte d'un tournoi dans la liste : couleur, initiales et état (le serveur garde la même palette)

export const COULEURS_CARTE = ["#ea580c", "#1d4ed8", "#15803d", "#b91c1c", "#6d28d9", "#0e7490", "#b45309", "#374151"];

// Couleur choisie par l'organisateur, sinon une couleur stable tirée du nom du tournoi
export function couleurCarte(tournoi) {
  if (COULEURS_CARTE.includes(tournoi?.carte_couleur)) return tournoi.carte_couleur;
  const texte = tournoi?.slug || tournoi?.nom || "";
  let somme = 0;
  for (const caractere of texte) somme = (somme * 31 + caractere.charCodeAt(0)) % 9973;
  return COULEURS_CARTE[somme % COULEURS_CARTE.length];
}

const PETITS_MOTS = new Set(["de", "des", "du", "la", "le", "les", "et", "d", "l", "of", "the"]);

// « Coupe des Quartiers 2026 » → « CQ » (sans les petits mots) ; un seul mot → ses deux premières lettres
export function initiales(nom = "") {
  const mots = nom
    .split(/[\s\-_'’]+/)
    .filter((mot) => /^[\p{L}\d]/u.test(mot) && !PETITS_MOTS.has(mot.toLowerCase()));
  const lettres = mots.length > 1 ? mots.slice(0, 2).map((mot) => mot[0]) : [...(mots[0] || "")].slice(0, 2);
  return lettres.join("").toUpperCase();
}

const jour = (date) => new Date(`${date}T00:00:00`);

// État affiché sur la carte : clôturé, terminé (date de fin passée), à venir ou en cours
export function etatTournoi(tournoi, maintenant = new Date()) {
  if (tournoi.cloture_le) return { cle: "cloture", label: "Clôturé" };
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (tournoi.date_fin && jour(tournoi.date_fin) < aujourdhui) return { cle: "termine", label: "Terminé" };
  if (tournoi.date_debut && jour(tournoi.date_debut) > aujourdhui) return { cle: "a_venir", label: "À venir" };
  return { cle: "en_cours", label: "En cours" };
}
