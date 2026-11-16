// Compression des logos et photos dans le navigateur, avant l'envoi : le stockage gratuit est limité (1 Go)

export const TAILLE_MAX_PX = 800;
const QUALITE = 0.82;
// En dessous, l'image est déjà légère : on l'envoie telle quelle
const SEUIL_OCTETS = 150 * 1024;

// Dimensions réduites en gardant les proportions (jamais agrandies)
export const dimensionsCibles = (largeur, hauteur, max = TAILLE_MAX_PX) => {
  const ratio = Math.min(1, max / Math.max(largeur, hauteur));
  return { largeur: Math.round(largeur * ratio), hauteur: Math.round(hauteur * ratio) };
};

export const nomAvecExtension = (nom, type) => {
  const extension = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[type];
  return `${(nom || "image").replace(/\.[^.]+$/, "")}.${extension}`;
};

const chargerImage = (fichier) =>
  new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("Image illisible"));
    };
    image.src = url;
  });

const versBlob = (canvas, type) => new Promise((resoudre) => canvas.toBlob(resoudre, type, QUALITE));

const aDeLaTransparence = (contexte, largeur, hauteur) => {
  const pixels = contexte.getImageData(0, 0, largeur, hauteur).data;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return true;
  return false;
};

/**
 * Renvoie une version redimensionnée (800 px max) et compressée de l'image : WebP si le navigateur sait
 * l'encoder, sinon JPEG (ou PNG si l'image a de la transparence, pour les logos). En cas de souci, ou si
 * le résultat n'est pas plus léger, l'original est renvoyé : la compression ne bloque jamais un envoi.
 */
export async function compresserImage(fichier) {
  if (!(fichier instanceof Blob) || !fichier.type.startsWith("image/") || fichier.type === "image/gif") {
    return fichier;
  }
  try {
    const image = await chargerImage(fichier);
    const { largeur, hauteur } = dimensionsCibles(image.naturalWidth, image.naturalHeight);
    const dejaPetite = largeur === image.naturalWidth && fichier.size <= SEUIL_OCTETS;
    if (dejaPetite) return fichier;

    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const contexte = canvas.getContext("2d");
    contexte.drawImage(image, 0, 0, largeur, hauteur);

    let blob = await versBlob(canvas, "image/webp");
    if (!blob || blob.type !== "image/webp") {
      // Safari n'encode pas le WebP
      const type = aDeLaTransparence(contexte, largeur, hauteur) ? "image/png" : "image/jpeg";
      blob = await versBlob(canvas, type);
    }
    if (!blob || blob.size >= fichier.size) return fichier;
    return new File([blob], nomAvecExtension(fichier.name, blob.type), { type: blob.type });
  } catch (erreur) {
    console.warn("Compression impossible, image envoyée telle quelle :", erreur);
    return fichier;
  }
}
