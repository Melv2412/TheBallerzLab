import { describe, expect, it } from "vitest";
import { equipeAJoue, erreurPhases, phasesCommencees, pointsVerrouilles } from "./phases";

describe("erreurPhases", () => {
  it("accepte des phases consécutives jusqu'à la finale, ou aucune phase", () => {
    expect(erreurPhases({ has_finale: true })).toBeNull();
    expect(erreurPhases({ has_quarts: true, has_demis: true, has_finale: true })).toBeNull();
    expect(erreurPhases({})).toBeNull();
  });

  it("refuse un trou ou l'absence de finale", () => {
    expect(erreurPhases({ has_quarts: true, has_finale: true })).toContain("Demis");
    expect(erreurPhases({ has_8emes: true, has_demis: true, has_finale: true })).toContain("Quarts");
    expect(erreurPhases({ has_demis: true })).toContain("finale");
  });
});

describe("verrous des résultats", () => {
  const matchs = [
    { phase: "poule", statut: "termine", equipe_domicile: 1, equipe_exterieur: 2 },
    { phase: "demi", statut: "en_cours", equipe_domicile: 3, equipe_exterieur: 4 },
    { phase: "finale", statut: "a_venir", equipe_domicile: 5, equipe_exterieur: 6 },
  ];

  it("ne compte que les phases finales commencées", () => {
    expect([...phasesCommencees(matchs)]).toEqual(["demi"]);
  });

  it("verrouille les points dès le premier match terminé", () => {
    expect(pointsVerrouilles(matchs)).toBe(true);
    expect(pointsVerrouilles(matchs.slice(1))).toBe(false);
  });

  it("repère une équipe qui a joué, à domicile ou à l'extérieur", () => {
    expect(equipeAJoue(matchs, 2)).toBe(true);
    expect(equipeAJoue(matchs, 3)).toBe(true);
    expect(equipeAJoue(matchs, 5)).toBe(false);
  });
});
