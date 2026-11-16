import { describe, expect, it } from "vitest";
import { compresserImage, dimensionsCibles, nomAvecExtension } from "./images";

describe("dimensionsCibles", () => {
  it("réduit le plus grand côté à 800 px en gardant les proportions", () => {
    expect(dimensionsCibles(4000, 3000)).toEqual({ largeur: 800, hauteur: 600 });
    expect(dimensionsCibles(1080, 1920)).toEqual({ largeur: 450, hauteur: 800 });
  });

  it("n'agrandit jamais une petite image", () => {
    expect(dimensionsCibles(300, 200)).toEqual({ largeur: 300, hauteur: 200 });
  });
});

describe("nomAvecExtension", () => {
  it("remplace l'extension selon le format produit", () => {
    expect(nomAvecExtension("logo.PNG", "image/webp")).toBe("logo.webp");
    expect(nomAvecExtension("photo.joueur.jpeg", "image/jpeg")).toBe("photo.joueur.jpg");
    expect(nomAvecExtension("", "image/png")).toBe("image.png");
  });
});

describe("compresserImage", () => {
  it("laisse passer ce qui n'est pas une image fixe", async () => {
    const gif = new Blob(["GIF89a"], { type: "image/gif" });
    expect(await compresserImage(gif)).toBe(gif);
    expect(await compresserImage(null)).toBeNull();
  });
});
