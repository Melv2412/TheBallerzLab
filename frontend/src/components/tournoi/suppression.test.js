import { describe, expect, it } from "vitest";
import { consequenceSuppression, lignesPertes, nomConfirme, texteJoursRestants } from "./suppression";

describe("nomConfirme", () => {
  it("accepte le nom sans tenir compte des majuscules ni des espaces en trop", () => {
    expect(nomConfirme("  coupe   ÉTÉ ", "Coupe Été")).toBe(true);
  });

  it("refuse un nom vide ou différent", () => {
    expect(nomConfirme("", "Coupe")).toBe(false);
    expect(nomConfirme("   ", "Coupe")).toBe(false);
    expect(nomConfirme("Coup", "Coupe")).toBe(false);
  });
});

describe("lignesPertes", () => {
  it("détaille ce qui sera perdu", () => {
    expect(lignesPertes({ equipes: 2, joueurs: 1, matchs: 3, matchs_termines: 2, images: 0 })).toEqual([
      "2 équipes", "1 joueur", "3 matchs, dont 2 terminés", "0 image",
    ]);
  });

  it("ne parle pas des matchs terminés s'il n'y en a pas", () => {
    expect(lignesPertes({ equipes: 0, joueurs: 0, matchs: 1, matchs_termines: 0, images: 1 })[2]).toBe("1 match");
  });
});

describe("consequenceSuppression", () => {
  it("distingue corbeille, effacement immédiat et suppression définitive", () => {
    expect(consequenceSuppression({ corbeille: true, jours: 30 })).toContain("30 jours");
    expect(consequenceSuppression({ corbeille: false })).toContain("tout de suite");
    expect(consequenceSuppression({ corbeille: true, jours: 30 }, true)).toContain("irréversible");
  });
});

describe("texteJoursRestants", () => {
  it("annonce le délai restant", () => {
    expect(texteJoursRestants(12)).toBe("Effacé dans 12 jours");
    expect(texteJoursRestants(1)).toBe("Effacé dans moins de 24 h");
  });
});
