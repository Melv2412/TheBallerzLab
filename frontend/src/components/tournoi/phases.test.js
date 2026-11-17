import { describe, expect, it } from "vitest";
import { erreurPhases } from "./phases";

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
