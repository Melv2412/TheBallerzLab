import React from "react";
import { getImageUrl } from "../../api";

// Logo d'une équipe, ou un bouclier si elle n'en a pas
export function LogoEquipe({ equipe, icone = "text-xl" }) {
  const url = getImageUrl(equipe?.logo);
  return url ? (
    <img src={url} className="w-full h-full object-cover" alt="logo" />
  ) : (
    <span className={icone}>🛡️</span>
  );
}
