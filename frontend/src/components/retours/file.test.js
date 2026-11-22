import { describe, expect, it } from "vitest";
import { MAX_VISIBLES, ajouterNotification, retirerNotification } from "./file";

const notif = (id, message, type = "erreur") => ({ id, message, type });

describe("file des notifications", () => {
  it("garde seulement les plus récentes", () => {
    let file = [];
    for (let i = 1; i <= MAX_VISIBLES + 2; i += 1) file = ajouterNotification(file, notif(i, `m${i}`));
    expect(file.map((n) => n.id)).toEqual([3, 4, 5]);
  });

  it("un message répété remplace l'ancien au lieu de s'empiler", () => {
    let file = ajouterNotification([], notif(1, "Refusé"));
    file = ajouterNotification(file, notif(2, "Autre"));
    file = ajouterNotification(file, notif(3, "Refusé"));
    expect(file.map((n) => n.id)).toEqual([2, 3]);
  });

  it("le même texte en succès et en erreur reste distinct", () => {
    const file = ajouterNotification([notif(1, "Ok", "succes")], notif(2, "Ok", "erreur"));
    expect(file).toHaveLength(2);
  });

  it("retire une notification par son id", () => {
    expect(retirerNotification([notif(1, "a"), notif(2, "b")], 1)).toEqual([notif(2, "b")]);
  });
});
