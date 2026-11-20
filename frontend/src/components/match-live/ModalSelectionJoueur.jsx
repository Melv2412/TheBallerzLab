import React from "react";
import { estExclu, limiteFautes } from "./chrono";
import { PhotoJoueur } from "./PhotoJoueur";

function GrosseStat({ label, classeLabel, valeur, classeValeur = "text-white" }) {
  return (
    <div className="flex flex-col items-center bg-white/5 px-2 py-1 rounded border border-white/5 min-w-[2.5rem]">
      <span className={`${classeLabel} uppercase text-[8px]`}>{label}</span>
      <span className={`text-xl ${classeValeur}`}>{valeur}</span>
    </div>
  );
}

// Choix du joueur à qui attribuer l'action (points, rebond, faute...)
export function ModalSelectionJoueur({ action, stats, match, onSelect, onAnnuler }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="glass-card w-full max-w-lg md:max-w-[95vw] 2xl:max-w-[1600px] max-h-[95vh] flex flex-col p-4 sm:p-6">
        <h3 className="text-2xl font-black text-white mb-2">
          Action:{" "}
          <span className="text-primary-orange uppercase">
            {action.field === "points" ? `${action.value} PTS` : action.field.toUpperCase()}
          </span>
        </h3>
        <p className="text-gray-400 text-sm mb-4 uppercase font-bold tracking-widest">
          Sélectionner le joueur concerné :
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto min-h-0 flex-1 mb-4 pr-1">
          {stats.map((stat) => {
            const exclu = estExclu(stat, match);
            return (
              <button
                key={stat.id}
                onClick={() => onSelect(stat)}
                className="w-full p-3 sm:p-4 rounded-lg bg-white/5 hover:bg-primary-orange transition-all text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 shrink-0 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center relative">
                      <PhotoJoueur photo={stat.joueur_photo} />
                      {exclu && (
                        <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center">
                          <span className="text-[8px] font-black text-white leading-tight text-center uppercase">Exclu</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className={`font-black text-xl ${exclu ? "text-red-500 line-through" : "text-white"}`}>
                        #{stat.joueur_numero}
                      </span>
                      <span className={`ml-2 text-lg font-bold leading-tight ${exclu ? "text-red-500" : "text-white"}`}>
                        {stat.joueur_nom}
                      </span>
                      {limiteFautes(match) > 0 && stat.fautes === limiteFautes(match) - 1 && (
                        <span className="ml-2 text-[10px] text-yellow-500 font-black animate-pulse">! FOUL TROUBLE</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 text-[10px] font-black italic">
                    <GrosseStat label="Pts" classeLabel="text-primary-orange" valeur={stat.points} />
                    <GrosseStat label="Reb" classeLabel="text-blue-400" valeur={stat.rebonds} />
                    <GrosseStat label="Ast" classeLabel="text-purple-400" valeur={stat.passes} />
                    <GrosseStat
                      label="Fou"
                      classeLabel="text-red-500"
                      valeur={stat.fautes}
                      classeValeur={exclu ? "text-red-600" : "text-white"}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={onAnnuler}
          className="w-full shrink-0 py-3 bg-red-500 rounded-lg font-black hover:bg-red-600 transition-all"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
