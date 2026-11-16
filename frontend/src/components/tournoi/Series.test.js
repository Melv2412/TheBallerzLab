import { describe, expect, it } from "vitest";
import { formatSerie } from "./Series";

describe("formatSerie", () => {
  it("décrit la série selon le nombre de victoires requises", () => {
    expect(formatSerie(1)).toBe("Match unique");
    expect(formatSerie(2)).toBe("Au meilleur des 3 matchs");
    expect(formatSerie(4)).toBe("Au meilleur des 7 matchs");
  });
});
