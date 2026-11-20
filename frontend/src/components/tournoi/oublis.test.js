import { describe, expect, it } from "vitest";
import { matchsOublies } from "./oublis";

const maintenant = new Date("2026-11-20T18:00:00Z").getTime();

describe("matchsOublies", () => {
  it("garde les matchs en cours sans activité depuis plus de 3 h", () => {
    const matchs = [
      { id: 1, statut: "en_cours", updated_at: "2026-11-20T14:00:00Z" },
      { id: 2, statut: "en_cours", updated_at: "2026-11-20T16:30:00Z" },
      { id: 3, statut: "termine", updated_at: "2026-11-19T10:00:00Z" },
      { id: 4, statut: "a_venir", updated_at: "2026-11-19T10:00:00Z" },
    ];
    expect(matchsOublies(matchs, maintenant).map((m) => m.id)).toEqual([1]);
  });
});
