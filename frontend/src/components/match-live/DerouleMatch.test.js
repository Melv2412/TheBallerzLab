import { describe, expect, it } from "vitest";
import { decrireAction, repereAction } from "./DerouleMatch";

const action = (champs) => ({ type: "stat", champ: "points", valeur: 2, periode: 1, temps_restant_secondes: 504.2, ...champs });

describe("decrireAction", () => {
  it("décrit une stat, au singulier ou au pluriel", () => {
    expect(decrireAction(action({ valeur: 3 }))).toBe("+3 pts");
    expect(decrireAction(action({ valeur: 1 }))).toBe("+1 pt");
    expect(decrireAction(action({ champ: "rebonds", valeur: 1 }))).toBe("+1 rebond");
  });

  it("signale une correction", () => {
    expect(decrireAction(action({ champ: "fautes", valeur: -1 }))).toBe("−1 faute (correction)");
  });

  it("décrit temps morts et changements de période", () => {
    expect(decrireAction({ type: "temps_mort" })).toBe("Temps mort");
    expect(decrireAction({ type: "periode", periode: 5 }, 4)).toBe("Début : Prolongation 1");
  });
});

describe("repereAction", () => {
  it("indique la période et le temps restant", () => {
    expect(repereAction(action({}))).toBe("Q1 8:25");
    expect(repereAction(action({ periode: 2 }), 2)).toBe("P2 8:25");
    expect(repereAction(action({ periode: 5 }), 4)).toBe("PR1 8:25");
  });
});
