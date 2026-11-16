import { describe, expect, it } from "vitest";
import { typeReglement } from "./presets";

const presets = {
  fiba: { nb_periodes: 4, fautes_bonus: 5 },
  nba: { nb_periodes: 4, fautes_bonus: 5, duree_periode_secondes: 720 },
};

describe("typeReglement", () => {
  it("reconnaît un préréglage", () => {
    expect(typeReglement({ nb_periodes: 4, fautes_bonus: 5 }, presets)).toBe("fiba");
    expect(typeReglement({ ...presets.nba }, presets)).toBe("nba");
  });

  it("passe en personnalisé dès qu'un réglage diffère", () => {
    expect(typeReglement({ nb_periodes: 4, fautes_bonus: 6 }, presets)).toBe("personnalise");
  });

  it("reste prudent tant que les préréglages ne sont pas chargés", () => {
    expect(typeReglement({ nb_periodes: 4 }, null)).toBe("personnalise");
  });
});
