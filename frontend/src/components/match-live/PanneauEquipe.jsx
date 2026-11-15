import React from "react";
import { estExclu } from "./chrono";
import { PhotoJoueur } from "./PhotoJoueur";

const boutonPoints =
  "w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-base sm:text-lg hover:bg-primary-orange hover:border-primary-orange transition-all";

const STATS_RAPIDES = [
  { champ: "rebonds", label: "REB", classe: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500" },
  { champ: "passes", label: "AST", classe: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500" },
  { champ: "contres", label: "BLK", classe: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500" },
  { champ: "fautes", label: "FOU", classe: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500" },
];

// Colonne d'une équipe : boutons de stats, score, fautes d'équipe, joueur ciblé et temps morts
export function PanneauEquipe({
  match,
  nom,
  score,
  fautes,
  timeouts,
  joueurCible,
  isOwner,
  onStat,
  onRetirerCible,
  onTimeout,
}) {
  return (
    <div className="text-center">
      <h2 className="text-lg sm:text-2xl font-black text-white mb-4 uppercase break-words">{nom}</h2>

      {isOwner && (
        <>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {[1, 2, 3].map((valeur) => (
              <button key={valeur} onClick={() => onStat("points", valeur)} className={boutonPoints}>
                +{valeur}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6">
            {STATS_RAPIDES.map(({ champ, label, classe }) => (
              <button
                key={champ}
                onClick={() => onStat(champ, 1)}
                className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg border text-[10px] font-black hover:text-white transition-all ${classe}`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="text-6xl sm:text-8xl lg:text-9xl font-black text-green-400 digital-font mb-4">{score}</div>

      {/* Fautes d'équipe */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4">
        <button className="text-red-500 text-xl sm:text-2xl">◀</button>
        <div className="text-center">
          <div className="text-xs text-gray-400 font-bold uppercase mb-1">Fautes</div>
          <div className="flex gap-1 justify-center mb-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < fautes ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-white/20"}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-2xl font-black text-red-500 digital-font">{fautes}</div>
            {fautes >= 4 && (
              <span className="bg-red-500 text-white text-[8px] font-black px-1 rounded animate-pulse">BONUS</span>
            )}
          </div>
        </div>
        <button className="text-red-500 text-xl sm:text-2xl">▶</button>
      </div>

      {joueurCible && (
        <div
          className={`group rounded-lg p-3 mb-4 flex items-center gap-3 relative overflow-hidden border ${estExclu(joueurCible, match) ? "bg-red-500/20 border-red-500" : "bg-white/5 border-white/20"}`}
        >
          <button
            onClick={onRetirerCible}
            className="absolute top-1 right-1 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500 transition-all z-20"
          >
            <span className="text-[10px]">✕</span>
          </button>
          {estExclu(joueurCible, match) && (
            <div className="absolute inset-0 bg-red-600/60 flex items-center justify-center z-10">
              <span className="text-white font-black italic text-sm tracking-widest">EXCLU (FAUTES)</span>
            </div>
          )}
          <div className="w-10 h-10 shrink-0 rounded-full bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center">
            <PhotoJoueur photo={joueurCible.joueur_photo} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Joueur ciblé</div>
            <div className="font-black text-white text-sm truncate">
              #{joueurCible.joueur_numero} {joueurCible.joueur_nom}
            </div>
          </div>
        </div>
      )}

      {isOwner ? (
        <>
          <button
            onClick={onTimeout}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all mx-auto"
            disabled={timeouts === 0}
          >
            <span className="text-2xl">⏱️</span>
          </button>
          <div className="text-xs text-gray-400 mt-2">Timeouts: {timeouts}</div>
        </>
      ) : (
        <div className="text-xs text-gray-500 mt-2 italic">Timeouts restants: {timeouts}</div>
      )}
    </div>
  );
}
