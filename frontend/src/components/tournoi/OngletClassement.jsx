import React from "react";
import { LogoEquipe } from "./LogoEquipe";

function TableauClassement({ classement, equipes, type }) {
  return (
    <div className="lg:col-span-2 glass-card overflow-hidden">
      <div className="p-5 sm:p-8 border-b border-white/5 flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight flex items-center gap-3">
          <span className="text-primary-orange">📊</span>{" "}
          {type === "poule" ? "Classement Général" : "Classement Éliminatoires"}
        </h2>
        <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-[10px] font-black uppercase tracking-tighter text-gray-500 shrink-0">
          <span title="Victoire (2pts)">V: 2pts</span>
          <span title="Défaite (1pt)">D: 1pt</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left stats-table border-collapse">
          <thead>
            <tr>
              <th className="p-2 sm:p-4 text-center w-10 sm:w-12">#</th>
              <th className="p-2 sm:p-4">Équipe</th>
              <th className="p-2 sm:p-4 text-center">J</th>
              <th className="p-2 sm:p-4 text-center">G</th>
              <th className="p-2 sm:p-4 text-center">P</th>
              <th className="hidden sm:table-cell p-4 text-center">Diff</th>
              <th className="p-2 sm:p-4 text-center bg-primary-orange/20 text-primary-orange">Pts</th>
            </tr>
          </thead>
          <tbody>
            {classement.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-10 text-center text-gray-500 italic">
                  En attente des premiers coups de sifflet...
                </td>
              </tr>
            ) : (
              classement.map((entry, index) => (
                <tr key={entry.id} className="group">
                  <td className="p-2 sm:p-4 text-center">
                    <span
                      className={`inline-flex w-7 h-7 items-center justify-center rounded font-black italic text-xs ${index < 3 ? "bg-primary-orange text-white" : "bg-white/5"}`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-2 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="hidden sm:flex w-10 h-10 shrink-0 rounded-lg bg-white/5 p-1 border border-white/10 flex items-center justify-center overflow-hidden">
                        <LogoEquipe equipe={equipes.find((e) => e.id === entry.id)} icone="text-lg" />
                      </div>
                      <span className="font-black italic text-sm sm:text-lg tracking-tight uppercase group-hover:text-primary-orange transition-colors break-words">
                        {entry.nom}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 sm:p-4 text-center font-bold text-gray-400">{entry.joues}</td>
                  <td className="p-2 sm:p-4 text-center">
                    <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs font-black">{entry.gagnes}</span>
                  </td>
                  <td className="p-2 sm:p-4 text-center">
                    <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-xs font-black">{entry.perdus}</span>
                  </td>
                  <td className="hidden sm:table-cell p-4 text-center font-mono font-bold italic text-gray-500">
                    {entry.difference > 0 ? `+${entry.difference}` : entry.difference}
                  </td>
                  <td className="p-2 sm:p-4 text-center font-black text-xl sm:text-2xl bg-white/3 italic text-primary-orange">
                    {entry.points}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="px-5 sm:px-8 py-3 text-[9px] font-bold text-gray-600 uppercase tracking-widest italic border-t border-white/5">
        * Égalité de points : confrontation directe, puis différence de points (règles FIBA)
      </p>
    </div>
  );
}

function LeadersEvaluation({ joueurs, type }) {
  return (
    <div className="glass-card overflow-hidden h-fit">
      <div className="p-5 sm:p-8 border-b border-white/5">
        <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight flex items-center gap-3">
          <span className="text-primary-orange">👑</span> {type === "poule" ? "Leaders Évaluation" : "Leaders Phase Finale"}
        </h2>
      </div>
      <div className="p-4 sm:p-6 space-y-4">
        {joueurs.length === 0 ? (
          <div className="text-center py-10 opacity-30 italic">Statistiques en cours d'analyse...</div>
        ) : (
          joueurs.map((player, index) => (
            <div
              key={player.id}
              className="relative group bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-primary-orange/50 transition-all overflow-hidden"
            >
              <div
                className={`absolute top-0 right-0 p-1 px-3 text-[9px] font-black uppercase italic ${index === 0 ? "bg-primary-orange text-white" : "bg-gray-800 text-gray-500"}`}
              >
                RANK #{index + 1}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-black italic text-primary-orange/50"># {player.numero}</div>
                <div>
                  <h3 className="font-black italic text-lg uppercase tracking-widest">{player.nom}</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">{player.equipe}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <div className="flex gap-4">
                  <div>
                    <span className="block text-[8px] text-gray-500 font-black uppercase">Moy. Eval</span>
                    <span className="text-xl font-black italic text-primary-orange">{player.moyenne_eval}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-gray-500 font-black uppercase">Points Total</span>
                    <span className="text-xl font-black italic">{player.total_points}</span>
                  </div>
                </div>
                <div className="text-[9px] font-bold text-gray-600 bg-white/5 px-2 py-1 rounded">
                  {player.nb_matchs} MATCHS
                </div>
              </div>
            </div>
          ))
        )}
        <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic text-center text-balance mt-4">
          * Formule: (PTS + AST + REB + BLK) - FOU
        </p>
      </div>
    </div>
  );
}

// S'affiche dans la grille du tableau de bord (voir DetailTournoi)
export function OngletClassement({ classement, tournamentMVP, equipes, type }) {
  return (
    <>
      <TableauClassement classement={classement} equipes={equipes} type={type} />
      <LeadersEvaluation joueurs={tournamentMVP} type={type} />
    </>
  );
}
