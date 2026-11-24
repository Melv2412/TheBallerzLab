import React from "react";
import { getImageUrl } from "../../api";
import { ImageSecours } from "../ImageSecours";
import { couleurCarte, etatTournoi, initiales } from "./carte";

// Haut de la carte d'un tournoi : sa photo, ou sa couleur avec ses initiales en grand ; état et champion par-dessus
export function BandeauCarte({ tournoi, className = "h-28" }) {
  const etat = etatTournoi(tournoi);
  const image = getImageUrl(tournoi.carte_image);
  const champion = tournoi.champion;
  return (
    <div
      className={`relative overflow-hidden border-b-2 border-black/40 ${className}`}
      style={{ backgroundColor: couleurCarte(tournoi) }}
    >
      {image ? (
        <>
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/10" />
        </>
      ) : (
        <span
          aria-hidden="true"
          className="absolute -right-2 -bottom-6 text-[7rem] leading-none font-black italic text-white/15 select-none"
        >
          {initiales(tournoi.nom)}
        </span>
      )}
      <span className="absolute left-4 top-4 bg-black/55 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
        {etat.cle === "cloture" && "🏆 "}
        {etat.label}
      </span>
      {champion?.logo && (
        <div
          className="absolute right-4 top-4 w-12 h-12 rounded-xl bg-white p-1 overflow-hidden shadow-xl shadow-black/40 ring-2 ring-white/20"
          title={`Champion : ${champion.nom}`}
        >
          <ImageSecours src={champion.logo} alt={`Logo de ${champion.nom}`} className="w-full h-full object-contain" />
        </div>
      )}
    </div>
  );
}
