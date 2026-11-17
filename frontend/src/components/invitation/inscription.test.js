import { describe, expect, it } from "vitest";
import { erreurNomEquipe, etapeCapitaine, nettoyerNomEquipe } from "./inscription";

describe("nettoyerNomEquipe", () => {
  it("retire les espaces en trop", () => {
    expect(nettoyerNomEquipe("  Les   Lions ")).toBe("Les Lions");
    expect(nettoyerNomEquipe()).toBe("");
  });
});

describe("erreurNomEquipe", () => {
  it("refuse un nom vide ou trop long", () => {
    expect(erreurNomEquipe("   ")).toMatch(/nom/);
    expect(erreurNomEquipe("x".repeat(201))).toMatch(/trop long/);
    expect(erreurNomEquipe("Les Lions")).toBeNull();
  });
});

describe("etapeCapitaine", () => {
  it("suit la demande du capitaine", () => {
    expect(etapeCapitaine({ connecte: false, demande: null, ouvertes: true })).toBe("connexion");
    expect(etapeCapitaine({ connecte: true, demande: null, ouvertes: true })).toBe("formulaire");
    expect(etapeCapitaine({ connecte: true, demande: null, ouvertes: false })).toBe("fermee");
    expect(etapeCapitaine({ connecte: true, demande: { statut: "en_attente" }, ouvertes: false })).toBe("en_attente");
    expect(etapeCapitaine({ connecte: true, demande: { statut: "acceptee" }, ouvertes: false })).toBe("acceptee");
    expect(etapeCapitaine({ connecte: true, demande: { statut: "refusee" }, ouvertes: true })).toBe("refusee");
    expect(etapeCapitaine({ connecte: true, demande: { statut: "refusee" }, ouvertes: false })).toBe("fermee");
  });
});
