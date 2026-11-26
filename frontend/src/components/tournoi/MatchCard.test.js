import { describe, expect, it } from "vitest";
import { perdant } from "./MatchCard";

describe("perdant", () => {
  const match = { statut: "termine", forfait: "", score_domicile: 82, score_exterieur: 68 };

  it("grise le perdant d'un match terminé", () => {
    expect(perdant(match)).toBe("exterieur");
    expect(perdant({ ...match, score_domicile: 50 })).toBe("domicile");
  });

  it("grise l'équipe forfait, personne avant la fin", () => {
    expect(perdant({ ...match, forfait: "domicile", score_domicile: 0, score_exterieur: 20 })).toBe("domicile");
    expect(perdant({ ...match, forfait: "double" })).toBe("double");
    expect(perdant({ ...match, statut: "en_cours" })).toBeNull();
  });
});
