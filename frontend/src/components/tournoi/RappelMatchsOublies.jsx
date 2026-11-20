import React from "react";
import { Link } from "react-router-dom";
import { HEURES_SANS_ACTIVITE, matchsOublies } from "./oublis";

// Visible par l'organisateur : un match oublié « en cours » empêche de clôturer le tournoi
export function RappelMatchsOublies({ matchs }) {
  const oublies = matchsOublies(matchs);
  if (oublies.length === 0) return null;
  return (
    <div className="mb-6 no-print bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-5 py-4 text-sm text-gray-200">
      <p className="font-black text-yellow-400 mb-2">
        {oublies.length > 1 ? `${oublies.length} matchs en cours` : "Un match en cours"} sans activité depuis plus de{" "}
        {HEURES_SANS_ACTIVITE} h : pense à {oublies.length > 1 ? "les" : "le"} terminer.
      </p>
      <ul className="space-y-1">
        {oublies.map((m) => (
          <li key={m.id}>
            <Link to={`/match/${m.id}`} className="underline hover:text-primary-orange">
              {m.equipe_domicile_nom} – {m.equipe_exterieur_nom}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
