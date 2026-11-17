import { describe, expect, it } from "vitest";
import { tokenExpire } from "./api";

const jwt = (charge) => `x.${btoa(JSON.stringify(charge)).replace(/=+$/, "")}.y`;

describe("expiration du token d'accès", () => {
  const maintenant = 1_000_000_000_000;
  it("renouvelle un token expiré ou presque, garde un token valide", () => {
    expect(tokenExpire(jwt({ exp: maintenant / 1000 + 600 }), maintenant)).toBe(false);
    expect(tokenExpire(jwt({ exp: maintenant / 1000 + 10 }), maintenant)).toBe(true);
    expect(tokenExpire(jwt({ exp: maintenant / 1000 - 60 }), maintenant)).toBe(true);
    expect(tokenExpire("pas-un-jwt", maintenant)).toBe(true);
  });
});
