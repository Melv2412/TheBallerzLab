import { describe, expect, it } from "vitest";
import { donneesAEnvoyer, erreurSaisie, lignesInitiales, periodesInitiales } from "./saisie";

const match = {
  equipe_domicile: 1,
  equipe_exterieur: 2,
  equipe_domicile_nom: "Lions",
  equipe_exterieur_nom: "Tigres",
  reglement: { nb_periodes: 4 },
  score_periodes: null,
};
const joueurs = [
  { id: 10, equipe: 1, numero_maillot: 7, prenom: "Paul", nom: "Martin" },
  { id: 11, equipe: 1, numero_maillot: 4, prenom: "Jean", nom: "Dupont" },
  { id: 20, equipe: 2, numero_maillot: 5, prenom: "Luc", nom: "Petit" },
];

describe("saisie de la feuille après coup", () => {
  it("prérempli les lignes avec les stats existantes, triées par numéro", () => {
    const lignes = lignesInitiales(joueurs, [{ joueur: 10, points: 12, rebonds: 3, passes: 0, contres: 0, fautes: 1 }]);
    expect(lignes.map((l) => l.libelle)).toEqual(["#4 Jean Dupont", "#5 Luc Petit", "#7 Paul Martin"]);
    expect(lignes[2]).toMatchObject({ points: 12, rebonds: 3, fautes: 1 });
    expect(lignes[0].points).toBe(0);
  });

  it("propose autant de périodes que le règlement, ou reprend celles déjà saisies", () => {
    expect(periodesInitiales(match).domicile).toEqual(["", "", "", ""]);
    const saisi = { domicile: [1, 2, 3, 4, 5], exterieur: [5, 4, 3, 2, 0] };
    expect(periodesInitiales({ ...match, score_periodes: saisi })).toBe(saisi);
  });

  it("vérifie le match nul et la somme des périodes", () => {
    const lignes = lignesInitiales(joueurs).map((l) => ({ ...l, points: l.joueur === 20 ? 10 : 5 }));
    expect(erreurSaisie(match, lignes, periodesInitiales(match), true)).toContain("Match nul");
    expect(erreurSaisie(match, lignes, periodesInitiales(match), false)).toBeNull();
    const periodes = { domicile: [5, 5, 0, 0], exterieur: [2, 2, 2, 2] };
    expect(erreurSaisie(match, lignes, periodes, false)).toContain("Tigres : les périodes font 8 points");
  });

  it("envoie des nombres, et pas de périodes si elles sont vides", () => {
    const lignes = lignesInitiales(joueurs).map((l) => ({ ...l, points: "6" }));
    const donnees = donneesAEnvoyer(lignes, periodesInitiales(match), true);
    expect(donnees.stats[0]).toEqual({ joueur: 11, points: 6, rebonds: 0, passes: 0, contres: 0, fautes: 0 });
    expect(donnees.score_periodes).toBeNull();
    expect(donnees.terminer).toBe(true);
  });
});
