import React from "react";
import { formaterTemps, nomPeriode } from "./chrono";

const boutonControle =
  "px-3 sm:px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10";

// Chronomètre, shot clock, période, flèche de possession et contrôles de l'organisateur
export function TableauChrono({
  match,
  chrono,
  isOwner,
  onToggleChrono,
  onResetShotClock,
  onTogglePossession,
  onResetChrono,
  onNextPeriode,
}) {
  return (
    <div className="flex flex-col items-center w-full lg:w-auto">
      <div className="flex items-center gap-4 sm:gap-8 mb-4">
        {/* Flèche Possession Gauche */}
        <div
          className={`text-3xl sm:text-4xl transition-all ${match.possession_fleche === "domicile" ? "text-primary-orange scale-125" : "text-white/5"}`}
        >
          ◄
        </div>

        {isOwner ? (
          <button
            onClick={onToggleChrono}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all ${match.chrono_en_cours ? "bg-red-500/20 text-red-500 border-2 border-red-500/50" : "bg-green-500/20 text-green-500 border-2 border-green-500/50"}`}
          >
            <span className="text-4xl">{match.chrono_en_cours ? "⏸️" : "▶️"}</span>
          </button>
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-white/5 border-2 border-white/10 opacity-30">
            <span className="text-2xl">{match.chrono_en_cours ? "⚡" : "⏸️"}</span>
          </div>
        )}

        {/* Flèche Possession Droite */}
        <div
          className={`text-3xl sm:text-4xl transition-all ${match.possession_fleche === "exterieur" ? "text-primary-orange scale-125" : "text-white/5"}`}
        >
          ►
        </div>
      </div>

      <div className="flex items-end gap-3 sm:gap-6 mb-4">
        <div className="text-6xl sm:text-7xl lg:text-8xl font-black text-red-500 digital-font leading-none">
          {formaterTemps(chrono.temps)}
        </div>
        {/* Shot Clock */}
        <div
          className={`text-3xl sm:text-5xl lg:text-6xl font-black digital-font leading-none pb-1 ${chrono.shot <= 5 ? "text-yellow-500 animate-pulse" : "text-red-600"}`}
        >
          {chrono.shot.toString().padStart(2, "0")}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="text-lg sm:text-2xl font-black text-white/40 uppercase tracking-widest italic">
          {nomPeriode(match.periode_actuelle)}
        </div>
      </div>

      {isOwner && (
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => onResetShotClock(24)} className={boutonControle}>
            Reset 24s
          </button>
          <button onClick={() => onResetShotClock(14)} className={boutonControle}>
            Reset 14s
          </button>
          <button onClick={onTogglePossession} className={boutonControle}>
            Alternance
          </button>
          <button
            onClick={onResetChrono}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 text-red-500"
          >
            Reset Temps
          </button>
          <button
            onClick={onNextPeriode}
            className="px-4 py-2 bg-primary-orange rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-orange-600"
          >
            Période +1
          </button>
        </div>
      )}
    </div>
  );
}
