import { describe, expect, it } from "vitest";
import { basculer, idsPresents, parEquipe } from "./presences";

const joueurs = [
  { joueur: 1, nom: "Jean", equipe: 10, equipe_nom: "A", present: false },
  { joueur: 2, nom: "Paul", equipe: 20, equipe_nom: "B", present: true },
  { joueur: 3, nom: "Luc", equipe: 10, equipe_nom: "A", present: false },
];

describe("présences de fin de match", () => {
  it("regroupe les joueurs par équipe", () => {
    const equipes = parEquipe(joueurs);
    expect(equipes.map((e) => e.nom)).toEqual(["A", "B"]);
    expect(equipes[0].joueurs.map((j) => j.joueur)).toEqual([1, 3]);
  });

  it("ne précoche que les présences déjà confirmées", () => {
    expect(idsPresents(joueurs)).toEqual([2]);
  });

  it("coche puis décoche un joueur", () => {
    expect(basculer([2], 1)).toEqual([2, 1]);
    expect(basculer([2, 1], 2)).toEqual([1]);
  });
});
