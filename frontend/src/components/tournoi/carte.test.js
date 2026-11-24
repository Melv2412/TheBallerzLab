import { describe, expect, it } from "vitest";
import { COULEURS_CARTE, couleurCarte, etatTournoi, initiales } from "./carte";

describe("couleurCarte", () => {
  it("garde la couleur choisie si elle est dans la palette", () => {
    expect(couleurCarte({ slug: "coupe", carte_couleur: "#1d4ed8" })).toBe("#1d4ed8");
  });

  it("tire sinon une couleur stable de la palette", () => {
    const couleur = couleurCarte({ slug: "coupe-des-quartiers", carte_couleur: "" });
    expect(COULEURS_CARTE).toContain(couleur);
    expect(couleurCarte({ slug: "coupe-des-quartiers", carte_couleur: "#123456" })).toBe(couleur);
  });
});

describe("initiales", () => {
  it("prend la première lettre des deux premiers mots, sans les petits mots", () => {
    expect(initiales("Coupe des Quartiers 2026")).toBe("CQ");
    expect(initiales("Ligue des Facs 2027")).toBe("LF");
    expect(initiales("Tournoi 3x3 de Noël")).toBe("T3");
  });

  it("prend deux lettres d'un mot seul", () => {
    expect(initiales("Ligue")).toBe("LI");
    expect(initiales("")).toBe("");
  });
});

describe("etatTournoi", () => {
  const maintenant = new Date(2026, 10, 24, 15, 0);

  it("donne l'état selon la clôture et les dates", () => {
    expect(etatTournoi({ cloture_le: "2026-11-01T10:00:00Z" }, maintenant).cle).toBe("cloture");
    expect(etatTournoi({ date_debut: "2026-10-01", date_fin: "2026-11-23" }, maintenant).cle).toBe("termine");
    expect(etatTournoi({ date_debut: "2026-11-25", date_fin: "2026-12-20" }, maintenant).cle).toBe("a_venir");
    expect(etatTournoi({ date_debut: "2026-11-24", date_fin: "2026-11-24" }, maintenant).cle).toBe("en_cours");
  });
});
