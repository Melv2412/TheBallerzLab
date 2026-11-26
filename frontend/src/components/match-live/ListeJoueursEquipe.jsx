import React from "react";
import { estExclu } from "./chrono";
import { libellePostes } from "../../postes";
import { PhotoJoueur } from "./PhotoJoueur";

function MiniStat({ label, valeur, classeValeur = "text-white" }) {
  return (
    <div className="flex flex-col items-center min-w-[24px]">
      <span className="text-gray-500 uppercase text-[6px]">{label}</span>
      <span className={classeValeur}>{valeur}</span>
    </div>
  );
}

// Liste des joueurs d'une équipe ; un clic ouvre la correction de ses stats (organisateur)
export function ListeJoueursEquipe({ titre, stats, idSelectionne, match, isOwner, onSelect }) {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-black text-gray-400 uppercase mb-3">{titre} - Sélectionner joueur</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {stats.map((stat) => {
          const exclu = estExclu(stat, match);
          return (
            <button
              key={stat.id}
              onClick={() => isOwner && onSelect(stat)}
              className={`w-full p-3 rounded-lg text-left transition-all relative overflow-hidden ${
                idSelectionne === stat.id ? "bg-primary-orange text-white" : "bg-white/5 hover:bg-white/10"
              } ${exclu ? "opacity-50 grayscale" : ""}`}
            >
              {exclu && (
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg">
                  EXCLU
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center">
                    <PhotoJoueur photo={stat.joueur_photo} classeIcone="text-sm" />
                  </div>
                  <div className="min-w-0 truncate">
                    <span className="font-black text-sm">#{stat.joueur_numero}</span>
                    <span className="ml-2 text-sm">{stat.joueur_nom}</span>
                    {libellePostes(stat.joueur_postes) && (
                      <span className="block text-[10px] text-gray-500 truncate">{libellePostes(stat.joueur_postes)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-[8px] font-black shrink-0">
                  <MiniStat label="Pts" valeur={stat.points} />
                  <MiniStat label="Reb" valeur={stat.rebonds} />
                  <MiniStat label="Ast" valeur={stat.passes} />
                  <MiniStat label="Fou" valeur={stat.fautes} classeValeur={exclu ? "text-red-500" : "text-white"} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
