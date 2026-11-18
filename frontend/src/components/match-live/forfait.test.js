import { describe, expect, it } from "vitest";
import { choixForfait, erreurForfait, estForfait, texteForfait, valeursForfait } from "./forfait";

const match = {
  phase: "poule",
  forfait: "",
  equipe_domicile_nom: "A",
  equipe_exterieur_nom: "B",
  score_domicile: 0,
  score_exterieur: 0,
};

describe("forfait d'un match", () => {
  it("nomme l'équipe forfait", () => {
    expect(texteForfait(match)).toBe("");
    expect(texteForfait({ ...match, forfait: "exterieur" })).toBe("Forfait de B");
    expect(texteForfait({ ...match, forfait: "double" })).toBe("Double forfait");
  });

  it("marque les deux équipes sur un double forfait", () => {
    expect(estForfait({ ...match, forfait: "double" }, "domicile")).toBe(true);
    expect(estForfait({ ...match, forfait: "exterieur" }, "domicile")).toBe(false);
  });

  it("ne propose le double forfait qu'en poule", () => {
    expect(choixForfait(match).map((c) => c.valeur)).toContain("double");
    expect(choixForfait({ ...match, phase: "finale" }).map((c) => c.valeur)).not.toContain("double");
  });

  it("part de 20-0, ou du score déjà déclaré", () => {
    expect(valeursForfait(match)).toEqual({ equipe: "domicile", vainqueur: 20, perdant: 0 });
    expect(valeursForfait({ ...match, forfait: "domicile", score_domicile: 3, score_exterieur: 25 })).toEqual({
      equipe: "domicile",
      vainqueur: 25,
      perdant: 3,
    });
  });

  it("exige un vainqueur devant au score", () => {
    expect(erreurForfait({ equipe: "domicile", vainqueur: "20", perdant: "0" })).toBe("");
    expect(erreurForfait({ equipe: "domicile", vainqueur: "5", perdant: "5" })).not.toBe("");
    expect(erreurForfait({ equipe: "domicile", vainqueur: "2.5", perdant: "0" })).not.toBe("");
    expect(erreurForfait({ equipe: "double", vainqueur: "0", perdant: "0" })).toBe("");
  });
});
