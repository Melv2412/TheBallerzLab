import { describe, expect, it } from "vitest";
import { estOrganisateur, peutModifier } from "./permissions";

describe("estOrganisateur", () => {
  it("reconnaît seulement l'organisateur du tournoi, pas le staff", () => {
    expect(estOrganisateur({ id: 7 }, 7)).toBe(true);
    expect(estOrganisateur({ id: 1, is_staff: true }, 7)).toBe(false);
  });

  it("refuse un visiteur ou un tournoi sans organisateur", () => {
    expect(estOrganisateur(null, 7)).toBe(false);
    expect(estOrganisateur({ id: 1, is_staff: true }, null)).toBe(false);
  });
});

describe("peutModifier", () => {
  const orga = { id: 7, is_staff: false };
  const staff = { id: 1, is_staff: true };

  it("autorise l'organisateur du tournoi", () => {
    expect(peutModifier(orga, 7)).toBe(true);
  });

  it("refuse un autre utilisateur, même staff", () => {
    expect(peutModifier({ id: 8 }, 7)).toBe(false);
    expect(peutModifier(staff, 7)).toBe(false);
  });

  it("réserve les tournois sans organisateur au staff", () => {
    expect(peutModifier(staff, null)).toBe(true);
    expect(peutModifier(orga, null)).toBe(false);
  });

  it("refuse un visiteur non connecté ou un profil incomplet", () => {
    expect(peutModifier(null, 7)).toBe(false);
    expect(peutModifier({ username: "orga" }, 7)).toBe(false);
  });
});
