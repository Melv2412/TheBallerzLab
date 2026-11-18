import React from "react";
import { ImageSecours } from "../ImageSecours";

// Photo d'un joueur, ou une icône si elle manque
export function PhotoJoueur({ photo, classeIcone = "text-xl" }) {
  return <ImageSecours src={photo} alt="photo" secours={<span className={classeIcone}>👤</span>} />;
}
