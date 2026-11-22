import qrcode from "qrcode-generator";

// Tracé SVG d'un QR code : un carré par module sombre, à dessiner dans un viewBox de `taille` de côté.
// Niveau M : reste lisible si l'écran de salle a des reflets ou si l'impression bave un peu
export const traceQr = (texte, marge = 2) => {
  const qr = qrcode(0, "M");
  qr.addData(texte);
  qr.make();
  const modules = qr.getModuleCount();
  let trace = "";
  for (let ligne = 0; ligne < modules; ligne += 1) {
    for (let colonne = 0; colonne < modules; colonne += 1) {
      if (qr.isDark(ligne, colonne)) trace += `M${colonne + marge},${ligne + marge}h1v1h-1z`;
    }
  }
  return { trace, taille: modules + 2 * marge };
};

export const lienAbsolu = (chemin) => `${window.location.origin}${chemin}`;

// Partage natif sur téléphone, sinon copie du lien. Renvoie ce qui s'est passé pour l'afficher
export const partagerLien = async ({ titre, texte, url }) => {
  if (navigator.share) {
    try {
      await navigator.share({ title: titre, text: texte, url });
      return "partage";
    } catch (erreur) {
      if (erreur?.name === "AbortError") return "annule";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copie";
  } catch {
    return "echec";
  }
};

// Partage d'un fichier (image) si le téléphone le permet, sinon téléchargement
export const partagerFichier = async (fichier, titre) => {
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: titre });
      return "partage";
    } catch (erreur) {
      if (erreur?.name === "AbortError") return "annule";
    }
  }
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = fichier.name;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "telecharge";
};

export const nomFichier = (texte, extension) =>
  `${texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "thelab"}.${extension}`;
