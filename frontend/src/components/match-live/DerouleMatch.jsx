import React, { useEffect, useState } from "react";
import { getActions } from "../../api";
import { formaterTemps, nomPeriode } from "./chrono";

const STATS = {
  points: ["pt", "pts"],
  passes: ["passe décisive", "passes décisives"],
  rebonds: ["rebond", "rebonds"],
  contres: ["contre", "contres"],
  fautes: ["faute", "fautes"],
};

// Texte d'une action de l'historique, ex. « +3 pts » ou « −1 faute (correction) »
export const decrireAction = (action, nbPeriodes = 4) => {
  if (action.type === "temps_mort") return "Temps mort";
  if (action.type === "periode") return `Début : ${nomPeriode(action.periode, nbPeriodes)}`;
  const [singulier, pluriel] = STATS[action.champ] || [action.champ, action.champ];
  const nombre = Math.abs(action.valeur);
  const libelle = `${action.valeur > 0 ? "+" : "−"}${nombre} ${nombre > 1 ? pluriel : singulier}`;
  return action.valeur < 0 ? `${libelle} (correction)` : libelle;
};

// Repère de jeu : « Q2 08:24 » (P pour les matchs en 2 ou 1 période, PR pour une prolongation)
export const repereAction = (action, nbPeriodes = 4) => {
  const prefixe = action.periode > nbPeriodes ? `PR${action.periode - nbPeriodes}` : `${nbPeriodes === 4 ? "Q" : "P"}${action.periode}`;
  return `${prefixe} ${formaterTemps(Math.ceil(action.temps_restant_secondes))}`;
};

// Déroulé du match, rechargé seulement quand l'historique change (match.actions_version)
export function DerouleMatch({ match }) {
  const [actions, setActions] = useState([]);
  const version = match.actions_version;

  useEffect(() => {
    if (!version) return;
    let actif = true;
    getActions(match.id)
      .then((r) => actif && setActions(r.data))
      .catch((e) => console.error("Erreur historique:", e));
    return () => {
      actif = false;
    };
  }, [match.id, version]);

  const nomEquipe = (cote) => (cote === "domicile" ? match.equipe_domicile_nom : cote === "exterieur" ? match.equipe_exterieur_nom : "");
  const nbPeriodes = match.reglement?.nb_periodes ?? 4;
  const visibles = version ? actions : [];

  return (
    <div className="glass-card p-4 mt-4">
      <h3 className="text-sm font-black text-gray-400 uppercase mb-3">Déroulé du match</h3>
      {visibles.length === 0 ? (
        <p className="text-xs text-gray-600 italic">Aucune action pour l'instant.</p>
      ) : (
        <ol className="space-y-1 max-h-72 overflow-y-auto pr-2 text-sm">
          {visibles.map((action) => (
            <li
              key={action.id}
              className={`flex items-baseline gap-3 py-1 border-b border-white/5 ${action.annulee ? "opacity-50" : ""}`}
            >
              <span className="shrink-0 w-20 font-mono text-[11px] text-gray-500">{repereAction(action, nbPeriodes)}</span>
              <span
                className={`shrink-0 font-black ${action.annulee ? "line-through" : ""} ${action.type === "periode" ? "text-gray-400" : action.champ === "fautes" ? "text-red-400" : "text-primary-orange"}`}
              >
                {decrireAction(action, nbPeriodes)}
              </span>
              <span className={`min-w-0 truncate text-white ${action.annulee ? "line-through" : ""}`}>{action.joueur_libelle}</span>
              {action.annulee && <span className="shrink-0 text-[11px] font-bold uppercase text-gray-400">annulée</span>}
              {action.cote && <span className="ml-auto shrink-0 text-[10px] uppercase text-gray-500">{nomEquipe(action.cote)}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
