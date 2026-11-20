import { describe, expect, it } from "vitest";
import { joueursSelectionnables, libelleAction } from "./selection";
import { finAnticipee } from "./chrono";

const match = { reglement: { fautes_exclusion: 5, nb_periodes: 4 } };
const stat = (id, numero, points, fautes = 0) => ({ id, joueur_numero: numero, points, fautes, rebonds: 0 });

describe("libelleAction", () => {
  it("ajout et retrait", () => {
    expect(libelleAction({ field: "points", value: 2, action: "increment" })).toBe("2 pts");
    expect(libelleAction({ field: "points", value: 1, action: "increment" })).toBe("1 pt");
    expect(libelleAction({ field: "rebonds", value: 1, action: "decrement" })).toBe("retirer rebond");
  });
});

describe("joueursSelectionnables", () => {
  const stats = [stat(1, 21, 0), stat(2, 8, 3, 5), stat(3, 11, 1)];

  it("trie par numéro et grise l'exclu", () => {
    const liste = joueursSelectionnables(stats, { field: "points", value: 2, action: "increment" }, match);
    expect(liste.map((j) => j.stat.joueur_numero)).toEqual([8, 11, 21]);
    expect(liste.map((j) => j.grise)).toEqual([true, false, false]);
  });

  it("en mode édition, grise ceux qui n'ont pas assez à retirer", () => {
    const liste = joueursSelectionnables(stats, { field: "points", value: 2, action: "decrement" }, match);
    expect(liste.map((j) => j.grise)).toEqual([false, true, true]);
  });

  it("sans limite de fautes, personne n'est grisé à l'ajout", () => {
    const sansLimite = { reglement: { fautes_exclusion: 0 } };
    const liste = joueursSelectionnables(stats, { field: "fautes", value: 1, action: "increment" }, sansLimite);
    expect(liste.every((j) => !j.grise)).toBe(true);
  });
});

describe("finAnticipee", () => {
  const base = { reglement: { nb_periodes: 4 }, duree_periode_secondes: 600 };

  it("avertit avant la dernière période", () => {
    expect(finAnticipee({ ...base, periode_actuelle: 2, temps_restant_secondes: 600 })).toMatch(/2e Quart sur 4/);
  });

  it("avertit s'il reste du temps au chrono dans la dernière période", () => {
    expect(finAnticipee({ ...base, periode_actuelle: 4, temps_restant_secondes: 125 })).toMatch(/2:05/);
  });

  it("ne dit rien quand le temps est écoulé ou sans chrono", () => {
    expect(finAnticipee({ ...base, periode_actuelle: 4, temps_restant_secondes: 0 })).toBeNull();
    expect(finAnticipee({ ...base, periode_actuelle: 4, temps_restant_secondes: 600 })).toBeNull();
  });
});
