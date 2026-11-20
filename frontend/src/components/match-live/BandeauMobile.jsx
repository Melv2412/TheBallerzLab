import React, { useState } from "react";
import { finDuTemps, formaterTemps, nomPeriode } from "./chrono";
import { OutilsChrono } from "./TableauChrono";

function Score({ nom, score }) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className="max-w-full truncate text-xs font-black uppercase italic text-primary-orange">{nom}</span>
      <span className="text-4xl font-black leading-tight text-green-400 digital-font">{score}</span>
    </div>
  );
}

// Téléphone : score, chrono et période restent visibles en haut pendant qu'on saisit les stats
export function BandeauMobile({ match, chrono, isOwner, onToggleChrono, onNextPeriode, outils }) {
  const [outilsOuverts, setOutilsOuverts] = useState(false);
  const reglement = match.reglement;
  const fleche = (cote) => (match.possession_fleche === cote ? "text-primary-orange" : "text-white/10");

  return (
    <div
      className="sm:hidden sticky top-2 z-30 mb-4 rounded-2xl border border-primary-orange/30 bg-[#0b0b0c]/95 backdrop-blur-md px-3 py-2 shadow-2xl"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Score nom={match.equipe_domicile_nom} score={match.score_domicile} />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            <span className={`text-lg ${fleche("domicile")}`} aria-hidden="true">◄</span>
            {isOwner ? (
              <button
                onClick={onToggleChrono}
                aria-label={match.chrono_en_cours ? "Mettre le chrono en pause" : "Lancer le chrono"}
                className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${match.chrono_en_cours ? "bg-red-500/20 border-red-500/50" : "bg-green-500/20 border-green-500/50"}`}
              >
                <span className="text-xl">{match.chrono_en_cours ? "⏸️" : "▶️"}</span>
              </button>
            ) : (
              <span className="text-xl opacity-40">{match.chrono_en_cours ? "⚡" : "⏸️"}</span>
            )}
            <span className={`text-lg ${fleche("exterieur")}`} aria-hidden="true">►</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-red-500 digital-font">{formaterTemps(chrono.temps)}</span>
            {reglement.shot_clock_actif && (
              <span
                className={`text-lg font-black leading-none digital-font ${chrono.shot <= 5 ? "text-yellow-500 animate-pulse" : "text-red-600"}`}
              >
                {chrono.shot.toString().padStart(2, "0")}
              </span>
            )}
          </div>
          <span className="mt-0.5 text-[10px] font-black uppercase italic tracking-widest text-white/40">
            {finDuTemps(match, chrono) ? "Fin du temps de jeu" : nomPeriode(match.periode_actuelle, reglement.nb_periodes)}
          </span>
        </div>
        <Score nom={match.equipe_exterieur_nom} score={match.score_exterieur} />
      </div>

      {isOwner && (
        <>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setOutilsOuverts(!outilsOuverts)}
              aria-expanded={outilsOuverts}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300"
            >
              Outils chrono
              <span className={`transition-transform duration-200 ${outilsOuverts ? "rotate-180" : ""}`} aria-hidden="true">
                ▾
              </span>
            </button>
            <button
              onClick={onNextPeriode}
              className="rounded-lg bg-primary-orange px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-orange-600"
            >
              Période +1
            </button>
          </div>
          <div
            className={`grid transition-all duration-300 ${outilsOuverts ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 invisible"}`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 gap-2 pt-2">
                <OutilsChrono match={match} {...outils} classe="w-full" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
