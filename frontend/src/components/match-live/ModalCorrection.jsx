import React, { useState } from "react";
import { ImageSecours } from "../ImageSecours";
import { IconeJoueur } from "../Icones";

const AUCUNE_CORRECTION = { points: 0, rebonds: 0, passes: 0, fautes: 0 };

const RETRAITS = [
  { champ: "points", valeur: 1, label: "-1 POINT" },
  { champ: "rebonds", valeur: 1, label: "-1 REBOND" },
  { champ: "passes", valeur: 1, label: "-1 ASSIST" },
  { champ: "fautes", valeur: 1, label: "-1 FAUTE" },
  { champ: "points", valeur: 2, label: "-2 POINTS" },
  { champ: "points", valeur: 3, label: "-3 POINTS" },
];

// Retire des stats saisies par erreur à un joueur ; `onConfirmer` reçoit { champ: delta négatif }
export function ModalCorrection({ stat, onConfirmer, onAnnuler }) {
  const [corrections, setCorrections] = useState(AUCUNE_CORRECTION);
  const aucune = Object.values(corrections).every((v) => v === 0);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[70] p-4">
      <div className="glass-card max-w-sm w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 text-center border-red-500/50">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full border-2 border-red-500 overflow-hidden mb-4">
            <ImageSecours
              src={stat.joueur_photo}
              secours={<div className="w-full h-full bg-white/10 flex items-center justify-center text-2xl text-gray-500"><IconeJoueur /></div>}
            />
          </div>
          <h3 className="text-xl font-black text-white uppercase italic">
            CORRIGER : #{stat.joueur_numero} {stat.joueur_nom}
          </h3>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {Object.entries(corrections).map(
              ([champ, val]) =>
                val !== 0 && (
                  <span
                    key={champ}
                    className="px-3 py-1 bg-red-500 text-white text-[10px] font-black rounded-full animate-bounce"
                  >
                    {val} {champ.toUpperCase()}
                  </span>
                ),
            )}
            {aucune && (
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Choisir les éléments à retirer
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {RETRAITS.map(({ champ, valeur, label }) => (
            <button
              key={label}
              onClick={() => setCorrections((p) => ({ ...p, [champ]: p[champ] - valeur }))}
              className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => onConfirmer(corrections)}
            disabled={aucune}
            className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${aucune ? "bg-gray-800 text-gray-600" : "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"}`}
          >
            Confirmer
          </button>
          <button
            onClick={onAnnuler}
            className="flex-1 py-4 bg-white/5 text-gray-400 rounded-xl font-black uppercase tracking-widest text-xs hover:text-white"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
