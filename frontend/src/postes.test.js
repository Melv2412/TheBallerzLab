import { describe, expect, it } from "vitest";
import { libellePostes } from "./postes";

describe("libellePostes", () => {
  it("affiche les postes choisis, rien sinon", () => {
    expect(libellePostes(["meneur", "arriere"])).toBe("Meneur / Arrière");
    expect(libellePostes([])).toBe("");
    expect(libellePostes(undefined)).toBe("");
    expect(libellePostes(["inconnu", "pivot"])).toBe("Pivot");
  });
});
