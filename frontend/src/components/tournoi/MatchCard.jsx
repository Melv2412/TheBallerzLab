import React from "react";
import { Link } from "react-router-dom";
import { LogoEquipe } from "./LogoEquipe";

function EquipeDuMatch({ nom, equipe, bordure }) {
  return (
    <div className={`flex-1 min-w-0 p-4 sm:p-6 text-center ${bordure}`}>
      <div className="w-12 h-12 rounded-xl bg-white p-1 mx-auto mb-3 shadow-lg flex items-center justify-center overflow-hidden">
        <LogoEquipe equipe={equipe} />
      </div>
      <h4 className="font-black italic text-sm uppercase leading-tight mb-1 truncate">{nom}</h4>
    </div>
  );
}

export function MatchCard({ match, equipes, onDelete, isOwner }) {
  const equipe = (id) => equipes.find((e) => e.id === id);
  return (
    <div className="glass-card overflow-hidden group">
      <div className="flex items-stretch bg-white/3">
        <EquipeDuMatch
          nom={match.equipe_domicile_nom}
          equipe={equipe(match.equipe_domicile)}
          bordure="border-r border-white/5"
        />

        <div className="w-20 sm:w-24 shrink-0 flex flex-col items-center justify-center p-2 bg-primary-orange/5">
          {match.statut === "termine" ? (
            <div className="text-2xl font-black italic">
              {match.score_domicile}:{match.score_exterieur}
            </div>
          ) : (
            <div className="text-lg font-black italic text-gray-600">VS</div>
          )}
          <div
            className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest mt-2 ${match.statut === "en_cours" ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-gray-400"}`}
          >
            {match.statut === "en_cours" ? "Live" : match.statut === "termine" ? "Terminé" : "À venir"}
          </div>
        </div>

        <EquipeDuMatch
          nom={match.equipe_exterieur_nom}
          equipe={equipe(match.equipe_exterieur)}
          bordure="border-l border-white/5"
        />
      </div>
      <div className="p-3 bg-black/40 flex justify-between items-center px-4 sm:px-6">
        <div className="text-[8px] font-black text-gray-500 uppercase italic">
          {match.date_match
            ? new Date(match.date_match).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "À définir"}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/match/${match.id}`}
            className="px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg bg-primary-orange text-white font-black italic uppercase text-[10px] sm:text-[8px] tracking-widest hover:scale-105 transition-all"
          >
            Stats
          </Link>
          {isOwner && (
            <button
              onClick={() => onDelete(match.id)}
              className="text-gray-500 hover:text-red-500 transition-all font-black text-sm sm:text-xs ml-2 px-2"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
