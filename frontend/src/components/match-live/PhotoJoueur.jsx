import React from "react";
import { getImageUrl } from "../../api";

// Photo d'un joueur, ou une icône si elle manque
export function PhotoJoueur({ photo, classeIcone = "text-xl" }) {
  const url = getImageUrl(photo);
  return url ? (
    <img src={url} className="w-full h-full object-cover" alt="photo" />
  ) : (
    <span className={classeIcone}>👤</span>
  );
}
