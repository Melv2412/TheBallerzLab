import { describe, expect, it } from "vitest";
import { enTetePeriode, fautesEtTempsMorts, scoreParPeriode, totauxEquipe } from "./feuille";

const stat = (cote, periode, valeur, champs = {}) => ({ type: "stat", champ: "points", cote, periode, valeur, annulee: false, ...champs });

describe("scoreParPeriode", () => {
  it("additionne les points par période, corrections et annulations comprises", () => {
    const actions = [
      stat("domicile", 1, 3),
      stat("domicile", 1, 2),
      stat("domicile", 1, -2), // correction
      stat("exterieur", 2, 2),
      stat("exterieur", 2, 3, { annulee: true }),
    ];
    expect(scoreParPeriode(actions, 4)).toEqual({ periodes: [1, 2, 3, 4], domicile: [3, 0, 0, 0], exterieur: [0, 2, 0, 0] });
  });

  it("ajoute les prolongations jouées", () => {
    const { periodes, domicile } = scoreParPeriode([stat("domicile", 5, 2)], 4, 5);
    expect(periodes).toEqual([1, 2, 3, 4, 5]);
    expect(domicile[4]).toBe(2);
  });
});

describe("fautesEtTempsMorts", () => {
  it("compte les fautes par période et les temps morts", () => {
    const actions = [
      stat("domicile", 1, 1, { champ: "fautes" }),
      stat("domicile", 2, 1, { champ: "fautes" }),
      stat("domicile", 2, -1, { champ: "fautes" }),
      { type: "temps_mort", cote: "domicile", periode: 2, annulee: false },
      { type: "temps_mort", cote: "domicile", periode: 3, annulee: true },
      { type: "temps_mort", cote: "exterieur", periode: 1, annulee: false },
    ];
    expect(fautesEtTempsMorts(actions, "domicile", [1, 2, 3, 4])).toEqual({ fautes: [1, 0, 0, 0], tempsMorts: 1 });
  });
});

describe("totaux et en-têtes", () => {
  it("additionne les stats d'une équipe", () => {
    const joueur = { points: 10, passes: 2, rebonds: 5, contres: 1, fautes: 3 };
    expect(totauxEquipe([joueur, joueur]).points).toBe(20);
  });

  it("nomme les colonnes de période", () => {
    expect([1, 4, 5].map((p) => enTetePeriode(p, 4))).toEqual(["Q1", "Q4", "PR1"]);
    expect(enTetePeriode(2, 2)).toBe("P2");
  });
});
