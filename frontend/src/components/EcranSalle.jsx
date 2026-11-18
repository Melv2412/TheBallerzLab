import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMatchLive } from "./match-live/useMatchLive";
import { formaterTemps, nomPeriode } from "./match-live/chrono";
import { MatchForfait } from "./match-live/MatchForfait";

function Equipe({ nom, score, fautes, bonus, tempsMorts, seuilBonus, possession }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <h2 className="w-full text-center truncate font-black italic uppercase text-white text-[5vw] lg:text-[3.5vw] leading-tight">
        {possession && <span className="text-primary-orange">● </span>}
        {nom}
      </h2>
      <div className="digital-font font-black text-green-400 leading-none text-[18vw] lg:text-[13vw]">{score}</div>
      <div className="flex items-center gap-[1.5vw] mt-[1vw]">
        <div className="flex gap-[0.6vw]" title="Fautes d'équipe">
          {[...Array(Math.max(seuilBonus - 1, 1))].map((_, i) => (
            <span
              key={i}
              className={`rounded-full w-[1.6vw] h-[1.6vw] ${i < fautes ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]" : "bg-white/15"}`}
            />
          ))}
        </div>
        {bonus && <span className="bg-red-600 text-white font-black px-[0.8vw] rounded text-[1.6vw]">BONUS</span>}
      </div>
      <p className="mt-[0.8vw] text-gray-400 font-bold uppercase tracking-widest text-[1.5vw]">
        Fautes {fautes} · Temps morts {tempsMorts}
      </p>
    </div>
  );
}

// Tableau de marque plein écran pour une télé ou un projecteur (lecture seule, se met à jour tout seul)
function EcranSalle() {
  const { id } = useParams();
  const { match, loading, chrono } = useMatchLive(id);
  const [pleinEcran, setPleinEcran] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const suivre = () => setPleinEcran(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);

  const basculerPleinEcran = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-primary-orange text-3xl">🏀</div>;
  }
  if (!match) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl">Match introuvable</div>;
  }

  if (match.forfait) return <MatchForfait match={match} />;

  const reglement = match.reglement;
  const finDuTemps = chrono.temps === 0 && !match.chrono_en_cours && match.periode_actuelle >= reglement.nb_periodes;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none overflow-hidden">
      <div className={`flex justify-between items-center px-[2vw] py-[1vw] ${pleinEcran ? "opacity-0 hover:opacity-100 transition-opacity" : ""}`}>
        <Link to={`/match/${id}/live`} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">
          ← Tableau de marque
        </Link>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest truncate px-4">{match.tournoi_nom}</p>
        <button onClick={basculerPleinEcran} className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest">
          {pleinEcran ? "Quitter le plein écran" : "⛶ Plein écran"}
        </button>
      </div>

      <div className="flex-1 flex items-center px-[3vw] gap-[2vw]">
        <Equipe
          nom={match.equipe_domicile_nom}
          score={match.score_domicile}
          fautes={match.fautes_domicile}
          bonus={match.bonus_domicile}
          tempsMorts={match.temps_morts_domicile}
          seuilBonus={reglement.fautes_bonus}
          possession={match.possession_fleche === "domicile"}
        />

        <div className="shrink-0 flex flex-col items-center">
          <div className="digital-font font-black text-red-500 leading-none text-[11vw] lg:text-[9vw]">
            {formaterTemps(chrono.temps)}
          </div>
          {reglement.shot_clock_actif && (
            <div
              className={`digital-font font-black leading-none mt-[1vw] text-[6vw] lg:text-[5vw] ${chrono.shot <= 5 ? "text-yellow-400" : "text-red-600"}`}
            >
              {chrono.shot.toString().padStart(2, "0")}
            </div>
          )}
          <div className="mt-[1.5vw] font-black italic uppercase tracking-widest text-white/50 text-[2.4vw] lg:text-[2vw]">
            {finDuTemps ? (match.statut === "termine" ? "Final" : "Fin du temps de jeu") : nomPeriode(match.periode_actuelle, reglement.nb_periodes)}
          </div>
        </div>

        <Equipe
          nom={match.equipe_exterieur_nom}
          score={match.score_exterieur}
          fautes={match.fautes_exterieur}
          bonus={match.bonus_exterieur}
          tempsMorts={match.temps_morts_exterieur}
          seuilBonus={reglement.fautes_bonus}
          possession={match.possession_fleche === "exterieur"}
        />
      </div>

      <div className="text-center pb-[1vw] text-[1.2vw] font-black italic uppercase tracking-widest text-white/20">
        THE <span className="text-primary-orange/60">LAB</span>
      </div>
    </div>
  );
}

export default EcranSalle;
