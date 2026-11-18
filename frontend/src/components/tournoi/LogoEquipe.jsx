import React from "react";
import { ImageSecours } from "../ImageSecours";

// Logo d'une équipe, ou un bouclier si elle n'en a pas
export function LogoEquipe({ equipe, icone = "text-xl" }) {
  return <ImageSecours src={equipe?.logo} alt="logo" secours={<span className={icone}>🛡️</span>} />;
}
