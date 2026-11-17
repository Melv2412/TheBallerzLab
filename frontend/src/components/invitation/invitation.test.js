import { describe, expect, it } from "vitest";
import { cheminSuite, erreurInscription, normaliserNom, suggestions } from "./invitation";

const joueurs = [
  { id: 1, prenom: "PAUL", nom: "MARTIN", numero_maillot: 7, compte_lie: false },
  { id: 2, prenom: "Élodie", nom: "Durand", numero_maillot: 4, compte_lie: false },
  { id: 3, prenom: "Paul", nom: "Martin", numero_maillot: 9, compte_lie: true },
];

describe("page d'invitation", () => {
  it("compare les noms sans casse ni accents", () => {
    expect(normaliserNom("  Élodie  DURAND-Leroy ")).toBe("elodie durand leroy");
  });

  it("propose « C'est toi ? » pour les joueurs non reliés qui portent le nom de la fiche", () => {
    expect(suggestions(joueurs, { prenom: "paul", nom: "Martin" }).map((j) => j.id)).toEqual([1]);
    expect(suggestions(joueurs, { prenom: "Elodie", nom: "durand" }).map((j) => j.id)).toEqual([2]);
    expect(suggestions(joueurs, null)).toEqual([]);
  });

  it("ne revient qu'à un chemin interne après connexion", () => {
    expect(cheminSuite("?suite=/invitation/abc")).toBe("/invitation/abc");
    expect(cheminSuite("?suite=//pirate.com")).toBeNull();
    expect(cheminSuite("?suite=https://pirate.com")).toBeNull();
    expect(cheminSuite("")).toBeNull();
  });

  it("vérifie le numéro et le nom avant l'envoi", () => {
    const ok = { numero: "8", prenom: "Luc", nom: "Petit" };
    expect(erreurInscription(ok, false, joueurs)).toBeNull();
    expect(erreurInscription({ ...ok, numero: "" }, false, joueurs)).toMatch(/numéro/);
    expect(erreurInscription({ ...ok, numero: "100" }, false, joueurs)).toMatch(/0 à 99/);
    expect(erreurInscription({ ...ok, numero: "7" }, false, joueurs)).toMatch(/déjà pris/);
    expect(erreurInscription({ ...ok, prenom: " " }, false, joueurs)).toMatch(/prénom/);
    expect(erreurInscription({ ...ok, prenom: "" }, true, joueurs)).toBeNull();
  });
});
