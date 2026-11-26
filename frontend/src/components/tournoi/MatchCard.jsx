import React from "react";
import { Link } from "react-router-dom";
import { LogoEquipe } from "./LogoEquipe";
import { estForfait } from "../match-live/forfait";

// Côté perdant d'un match terminé (grisé), forfait compris ; aucun pour un match pas joué
export const perdant = (match) => {
  if (match.statut !== "termine") return null;
  if (match.forfait === "domicile" || match.forfait === "exterieur" || match.forfait === "double") {
    return match.forfait;
  }
  if (match.score_domicile === match.score_exterieur) return null;
  return match.score_domicile > match.score_exterieur ? "exterieur" : "domicile";
};

function EquipeDuMatch({ nom, equipe, cote, forfait, grise }) {
  const domicile = cote === "domicile";
  return (
    <div className={`flex-1 min-w-0 flex items-center gap-2 sm:gap-3 ${domicile ? "flex-row-reverse text-right" : ""}`}>
      <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden">
        <LogoEquipe equipe={equipe} />
      </div>
      <div className="min-w-0">
        <p title={nom} className={`font-black italic text-xs sm:text-sm uppercase leading-tight truncate ${grise ? "text-gray-500" : "text-white"}`}>
          {nom}
        </p>
        {forfait && <p className="text-[9px] font-black uppercase tracking-widest text-primary-orange">Forfait</p>}
      </div>
    </div>
  );
}

function Horaire({ date }) {
  if (!date) return <p className="text-xs font-black uppercase italic text-gray-500">À définir</p>;
  const d = new Date(date);
  return (
    <>
      <p className="text-lg sm:text-xl font-black italic leading-none tabular-nums">
        {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="mt-1 text-[10px] font-bold text-gray-500 tabular-nums">
        {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
      </p>
    </>
  );
}

// Une ligne par match : horaire, équipes et score au centre, actions à droite (empilé sur téléphone)
export function MatchCard({ match, equipes, onDelete, isOwner }) {
  const equipe = (id) => equipes.find((e) => e.id === id);
  const perd = perdant(match);
  const statut = match.forfait ? "Forfait" : match.statut === "en_cours" ? "Live" : match.statut === "termine" ? "Terminé" : "À venir";
  const bouton = "inline-flex items-center justify-center min-h-[36px] px-3 rounded-lg font-black italic uppercase text-[10px] tracking-widest transition-colors";

  return (
    <div className="glass-card px-4 py-3 sm:px-5 sm:py-4 grid grid-cols-[1fr_auto] sm:grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 gap-y-3">
      <div className="order-1">
        <Horaire date={match.date_match} />
      </div>

      <div className="order-3 sm:order-2 col-span-2 sm:col-span-1 flex items-center gap-2 sm:gap-4 min-w-0">
        <EquipeDuMatch
          nom={match.equipe_domicile_nom}
          equipe={equipe(match.equipe_domicile)}
          cote="domicile"
          forfait={estForfait(match, "domicile")}
          grise={perd === "domicile" || perd === "double"}
        />
        <div className="w-20 sm:w-24 shrink-0 flex flex-col items-center">
          {match.statut === "termine" ? (
            <p className="text-2xl sm:text-3xl font-black italic leading-none tabular-nums whitespace-nowrap">
              {match.score_domicile}
              <span className="mx-1 text-gray-500">-</span>
              {match.score_exterieur}
            </p>
          ) : (
            <p className="text-lg font-black italic text-gray-600 leading-none">VS</p>
          )}
          <span
            className={`mt-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${match.statut === "en_cours" ? "bg-red-500 text-white animate-pulse" : "text-gray-400"}`}
          >
            {statut}
          </span>
        </div>
        <EquipeDuMatch
          nom={match.equipe_exterieur_nom}
          equipe={equipe(match.equipe_exterieur)}
          cote="exterieur"
          forfait={estForfait(match, "exterieur")}
          grise={perd === "exterieur" || perd === "double"}
        />
      </div>

      <div className="order-2 sm:order-3 flex items-center justify-end gap-2">
        <Link to={`/match/${match.id}`} className={`${bouton} border border-primary-orange/40 text-primary-orange hover:bg-primary-orange hover:text-white`}>
          {match.forfait ? "Détail" : "Stats"}
        </Link>
        {match.statut !== "termine" && (
          <Link to={`/match/${match.id}/live`} className={`${bouton} bg-red-600 text-white hover:bg-red-500`}>
            Live
          </Link>
        )}
        {isOwner && match.statut !== "termine" && (
          <button
            type="button"
            onClick={() => onDelete(match.id)}
            aria-label={`Supprimer le match ${match.equipe_domicile_nom} contre ${match.equipe_exterieur_nom}`}
            className="min-w-[36px] min-h-[36px] text-gray-500 hover:text-red-500 transition-colors font-black text-sm"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
