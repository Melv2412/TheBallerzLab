import React from "react";
import { getImageUrl } from "../../api";
import { evaluation } from "./chrono";

export function MvpLive({ mvp }) {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center p-4 glass-card border-primary-orange/30 w-48">
      <div className="text-[10px] font-black text-primary-orange uppercase tracking-widest mb-2 animate-pulse">
        MVP en Direct
      </div>
      {mvp ? (
        <>
          <div className="w-16 h-16 rounded-full border-2 border-primary-orange overflow-hidden mb-2">
            {getImageUrl(mvp.joueur_photo) ? (
              <img src={getImageUrl(mvp.joueur_photo)} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-xl">👤</div>
            )}
          </div>
          <div className="text-xs font-black uppercase text-white truncate w-full text-center">
            #{mvp.joueur_numero} {mvp.joueur_nom}
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">Eval: {evaluation(mvp)}</div>
        </>
      ) : (
        <div className="text-[8px] text-gray-600 italic">Analyse des performances...</div>
      )}
    </div>
  );
}
