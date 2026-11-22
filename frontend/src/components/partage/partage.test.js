import { afterEach, describe, expect, it, vi } from "vitest";
import { nomFichier, partagerLien, traceQr } from "./partage";
import { ligneMvp, vainqueur } from "./imageResultat";

describe("traceQr", () => {
  it("un lien de match tient dans un petit QR et ajoute la marge blanche autour", () => {
    const { trace, taille } = traceQr("https://thelab-sable.vercel.app/match/12/live", 2);
    expect(taille).toBe(37); // version 3 : 29 modules + 2 × 2 de marge
    expect(trace.startsWith("M2,2h1v1h-1z")).toBe(true); // coin du repère en haut à gauche
  });

  it("deux liens différents donnent deux QR différents", () => {
    expect(traceQr("https://a.fr/match/1").trace).not.toBe(traceQr("https://a.fr/match/2").trace);
  });
});

describe("nomFichier", () => {
  it("retire accents et caractères spéciaux", () => {
    expect(nomFichier("Résultat : Élan vs Sharks !", "png")).toBe("resultat-elan-vs-sharks.png");
  });

  it("garde un nom par défaut si tout est retiré", () => {
    expect(nomFichier("!!!", "png")).toBe("thelab.png");
  });
});

describe("partagerLien", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sans partage natif, copie le lien", async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await partagerLien({ url: "https://x.fr" })).toBe("copie");
    expect(writeText).toHaveBeenCalledWith("https://x.fr");
  });

  it("partage natif annulé : ne copie pas en douce", async () => {
    const writeText = vi.fn();
    const share = vi.fn().mockRejectedValue(Object.assign(new Error(), { name: "AbortError" }));
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    expect(await partagerLien({ url: "https://x.fr" })).toBe("annule");
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("image du résultat", () => {
  it("désigne le vainqueur, aucun en cas d'égalité", () => {
    expect(vainqueur({ score_domicile: 70, score_exterieur: 65 })).toBe("domicile");
    expect(vainqueur({ score_domicile: 60, score_exterieur: 65 })).toBe("exterieur");
    expect(vainqueur({ score_domicile: 0, score_exterieur: 0 })).toBeNull();
  });

  it("résume la ligne du MVP", () => {
    expect(ligneMvp({ nom: "Léo Dupont", stats: { pts: 21, reb: 8, ast: 5 } })).toBe("Léo Dupont · 21 PTS · 8 REB · 5 AST");
    expect(ligneMvp(null)).toBe("");
  });
});
