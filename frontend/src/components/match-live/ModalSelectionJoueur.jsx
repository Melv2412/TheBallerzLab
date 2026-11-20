import React from "react";
import { estExclu, limiteFautes } from "./chrono";
import { PhotoJoueur } from "./PhotoJoueur";
import { joueursSelectionnables, libelleAction } from "./selection";

function GrosseStat({ label, classeLabel, valeur, classeValeur = "text-white" }) {
  return (
    <div className="flex flex-col items-center bg-white/5 px-2 py-1 rounded border border-white/5 min-w-[2.5rem]">
      <span className={`${classeLabel} uppercase text-[8px]`}>{label}</span>
      <span className={`text-xl ${classeValeur}`}>{valeur}</span>
    </div>
  );
}

// Choix du joueur à qui attribuer l'action (points, rebond, faute...).
// Téléphone : feuille qui monte du bas, grille de numéros. Tablette et ordinateur : liste détaillée.
export function ModalSelectionJoueur({ action, stats, match, onSelect, onAnnuler }) {
  const joueurs = joueursSelectionnables(stats, action, match);
  const retrait = action.action === "decrement";
  const equipe = stats[0]?.equipe_nom;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onAnnuler}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-selection-joueur"
        onClick={(e) => e.stopPropagation()}
        className="glass-card feuille-monte w-full sm:max-w-[95vw] 2xl:max-w-[1600px] max-h-[86vh] sm:max-h-[95vh] flex flex-col p-4 sm:p-6 max-sm:rounded-b-none max-sm:border-b-0"
      >
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex items-baseline justify-between gap-3 mb-1 sm:mb-2">
          <h3 id="titre-selection-joueur" className="text-xl sm:text-2xl font-black text-white">
            Action :{" "}
            <span className={`uppercase ${retrait ? "text-red-400" : "text-primary-orange"}`}>{libelleAction(action)}</span>
          </h3>
          {equipe && <span className="min-w-0 truncate text-xs font-black uppercase text-gray-400">{equipe}</span>}
        </div>
        <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4 uppercase font-bold tracking-widest">
          <span className="sm:hidden">Touche le numéro du joueur</span>
          <span className="hidden sm:inline">Sélectionner le joueur concerné :</span>
        </p>

        {/* Téléphone : 3 colonnes, numéro en gros (12 joueurs sans défiler) */}
        <div className="grid grid-cols-3 gap-2 overflow-y-auto min-h-0 flex-1 mb-3 sm:hidden">
          {joueurs.map(({ stat, grise }) => (
            <button
              key={stat.id}
              type="button"
              disabled={grise}
              onClick={() => onSelect(stat)}
              aria-label={`#${stat.joueur_numero} ${stat.joueur_nom}`}
              className={`h-[4.5rem] rounded-xl border bg-white/5 flex flex-col items-center justify-center gap-0.5 px-1 transition-all active:bg-primary-orange disabled:opacity-30 ${retrait ? "border-red-500/40" : "border-white/10"}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-[26px] h-[26px] shrink-0 rounded-full overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center">
                  <PhotoJoueur photo={stat.joueur_photo} classeIcone="text-sm" />
                </span>
                <span className="text-2xl font-black leading-none text-primary-orange">#{stat.joueur_numero}</span>
              </span>
              <span className="max-w-full truncate text-[11px] font-bold uppercase text-white">
                {stat.joueur_nom.split(" ")[0]}
              </span>
              <span className="text-[10px] text-gray-400">
                {stat.points} pts · {stat.fautes} f
              </span>
            </button>
          ))}
        </div>

        {/* Tablette et ordinateur : liste détaillée sur 2 à 3 colonnes */}
        <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto min-h-0 flex-1 mb-4 pr-1">
          {joueurs.map(({ stat, grise }) => {
            const exclu = estExclu(stat, match);
            return (
              <button
                key={stat.id}
                type="button"
                disabled={grise}
                onClick={() => onSelect(stat)}
                className={`w-full min-w-0 p-3 sm:p-4 rounded-lg bg-white/5 enabled:hover:bg-primary-orange transition-all text-left disabled:cursor-not-allowed ${grise && !exclu ? "opacity-40" : ""} ${retrait ? "border border-red-500/30" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 shrink-0 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center relative">
                      <PhotoJoueur photo={stat.joueur_photo} />
                      {exclu && (
                        <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center">
                          <span className="text-[8px] font-black text-white leading-tight text-center uppercase">Exclu</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Nom trop long coupé par « … » : il ne chevauche plus les stats */}
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className={`shrink-0 font-black text-xl ${exclu ? "text-red-500 line-through" : "text-white"}`}>
                          #{stat.joueur_numero}
                        </span>
                        <span
                          title={stat.joueur_nom}
                          className={`truncate text-lg font-bold leading-tight ${exclu ? "text-red-500" : "text-white"}`}
                        >
                          {stat.joueur_nom}
                        </span>
                      </div>
                      {limiteFautes(match) > 0 && stat.fautes === limiteFautes(match) - 1 && (
                        <span className="block text-[10px] text-yellow-500 font-black animate-pulse">! FOUL TROUBLE</span>
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
          type="button"
          onClick={onAnnuler}
          className="w-full shrink-0 py-3 bg-red-500 rounded-lg font-black hover:bg-red-600 transition-all"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
