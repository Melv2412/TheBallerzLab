import React from "react";
import { Link } from "react-router-dom";
import { texteForfait } from "./forfait";

// Remplace le tableau de marque, l'écran de salle et la feuille : un forfait n'a pas de feuille de stats
export function MatchForfait({ match }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{match.tournoi_nom}</p>
      <h1 className="text-2xl sm:text-4xl font-black italic uppercase break-words max-w-full">
        {match.equipe_domicile_nom} {match.score_domicile} - {match.score_exterieur} {match.equipe_exterieur_nom}
      </h1>
      <p className="text-primary-orange font-black uppercase tracking-widest">{texteForfait(match)}</p>
      <Link to={`/match/${match.id}`} className="text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest">
        ← Retour au match
      </Link>
    </div>
  );
}
