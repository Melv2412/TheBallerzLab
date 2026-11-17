import { describe, expect, it } from "vitest";
import { lienAuth, modeAuth } from "./mode";

describe("mode de connexion", () => {
  it("organisateur par défaut, joueur quand on vient d'une invitation", () => {
    expect(modeAuth("")).toBe("orga");
    expect(modeAuth("?suite=/invitation/abc")).toBe("joueur");
    expect(modeAuth("?mode=orga&suite=/invitation/abc")).toBe("orga");
    expect(modeAuth("?mode=joueur")).toBe("joueur");
    expect(modeAuth("?mode=pirate")).toBe("orga");
  });

  it("garde le mode et le retour dans les liens", () => {
    expect(lienAuth("register", "joueur", "/invitation/abc")).toBe("/register?mode=joueur&suite=%2Finvitation%2Fabc");
    expect(lienAuth("login", "orga", null)).toBe("/login?mode=orga");
  });
});
