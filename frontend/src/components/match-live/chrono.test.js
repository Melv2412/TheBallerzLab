import { describe, expect, it } from "vitest";
import { calculerChrono, estExclu, formaterTemps, meilleurJoueur, nomPeriode } from "./chrono";

const T0 = 1_000_000;
const enMarche = { chrono_en_cours: true, _recuA: T0, temps_restant_secondes: 600, shot_clock_secondes: 24 };

describe("calculerChrono", () => {
  it("décompte le temps et le shot clock depuis la réception", () => {
    expect(calculerChrono(enMarche, T0 + 10_400)).toEqual({ temps: 590, shot: 14, aZero: false });
  });

  it("ne bouge pas quand le chrono est arrêté", () => {
    expect(calculerChrono({ ...enMarche, chrono_en_cours: false }, T0 + 30_000)).toEqual({
      temps: 600,
      shot: 24,
      aZero: false,
    });
  });

  it("signale la violation des 24 secondes", () => {
    expect(calculerChrono(enMarche, T0 + 30_000)).toMatchObject({ shot: 0, aZero: true });
  });

  it("signale la fin de période", () => {
    expect(calculerChrono({ ...enMarche, temps_restant_secondes: 5, shot_clock_secondes: 0 }, T0 + 6_000)).toEqual({
      temps: 0,
      shot: 0,
      aZero: true,
    });
  });

  it("arrondit à la seconde supérieure, comme un tableau d'affichage", () => {
    expect(calculerChrono({ ...enMarche, temps_restant_secondes: 9.4 }, T0).temps).toBe(10);
  });
});

describe("affichage", () => {
  it("formate le temps restant", () => {
    expect(formaterTemps(590)).toBe("9:50");
    expect(formaterTemps(5)).toBe("0:05");
  });

  it("nomme les périodes et prolongations", () => {
    expect([1, 2, 4, 5, 6].map(nomPeriode)).toEqual([
      "1er Quart",
      "2e Quart",
      "4e Quart",
      "Prolongation 1",
      "Prolongation 2",
    ]);
  });
});

describe("joueurs", () => {
  const stat = (id, champs) => ({ id, points: 0, passes: 0, rebonds: 0, contres: 0, fautes: 0, ...champs });

  it("trouve le meilleur joueur par évaluation", () => {
    const stats = [stat(1, { points: 2 }), stat(2, { points: 5, fautes: 5 }), stat(3, { points: 3 })];
    expect(meilleurJoueur(stats).id).toBe(3);
    expect(meilleurJoueur([])).toBeNull();
  });

  it("exclut un joueur à la limite de fautes du tournoi", () => {
    expect(estExclu(stat(1, { fautes: 5 }), { tournoi_limite_fautes: 5 })).toBe(true);
    expect(estExclu(stat(1, { fautes: 4 }), { tournoi_limite_fautes: 5 })).toBe(false);
    expect(estExclu(stat(1, { fautes: 5 }), {})).toBe(true); // 5 fautes par défaut
  });
});
