import React, { useState } from "react";
import { getImageUrl } from "../../api";
import { LogoEquipe } from "./LogoEquipe";

export function OngletEquipes({
  equipes,
  joueursParEquipe,
  isOwner,
  onNouvelleEquipe,
  onEditerEquipe,
  onSupprimerEquipe,
  onNouveauJoueur,
  onEditerJoueur,
  onSupprimerJoueur,
}) {
  const [equipesOuvertes, setEquipesOuvertes] = useState({});
  const basculer = (equipeId) => setEquipesOuvertes((prev) => ({ ...prev, [equipeId]: !prev[equipeId] }));

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl sm:text-4xl font-black italic mb-6 card-title-accent uppercase">🛡️ Rosters & Équipes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {equipes.map((equipe) => {
          const joueurs = joueursParEquipe[equipe.id] || [];
          return (
            <div key={equipe.id} className="glass-card group overflow-hidden border-b-4 border-b-primary-orange/50">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl shadow-black/40 overflow-hidden ring-4 ring-white/5">
                      <LogoEquipe equipe={equipe} icone="text-2xl" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter leading-none break-words">
                        {equipe.nom}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-2 tracking-widest uppercase italic">
                        Effectif: {joueurs.length} joueurs
                      </p>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => onNouveauJoueur(equipe.id)}
                        className="bg-primary-orange/10 p-2 rounded-lg text-primary-orange hover:bg-primary-orange hover:text-white transition-all"
                      >
                        👤+
                      </button>
                      <button
                        onClick={() => onEditerEquipe(equipe)}
                        className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => onSupprimerEquipe(equipe.id)}
                        className="bg-red-500/10 p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {joueurs.length > 0 ? (
                    joueurs.map((joueur) => (
                      <div
                        key={joueur.id}
                        className="flex justify-between items-center p-3 rounded-xl bg-white/3 border border-white/5 group/player"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center">
                            {getImageUrl(joueur.photo) ? (
                              <img src={getImageUrl(joueur.photo)} className="w-full h-full object-cover" alt="photo" />
                            ) : (
                              <span className="text-lg font-black text-gray-700">👤</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-primary-orange font-black italic text-xs">#{joueur.numero_maillot}</span>
                              <span className="font-bold text-sm tracking-tight text-white">
                                {joueur.prenom} {joueur.nom}
                              </span>
                            </div>
                          </div>
                        </div>
                        {isOwner && (
                          <div className="flex gap-3 md:gap-2 md:opacity-0 md:group-hover/player:opacity-100 transition-all shrink-0">
                            <button
                              onClick={() => onEditerJoueur(joueur, equipe.id)}
                              className="text-blue-400 hover:text-blue-500 transition-all"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => onSupprimerJoueur(joueur.id)}
                              className="text-red-400 hover:text-red-500 transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-600 italic font-bold text-center py-4">
                      Roster vide. Recrutement nécessaire.
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => basculer(equipe.id)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors"
              >
                Détails Effectif {equipesOuvertes[equipe.id] ? "▲" : "▼"}
              </button>
            </div>
          );
        })}
        {isOwner && (
          <button
            onClick={onNouvelleEquipe}
            className="border-4 border-dashed border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary-orange/30 hover:bg-primary-orange/5 transition-all group min-h-[300px]"
          >
            <span className="text-4xl text-gray-700 group-hover:text-primary-orange transition-colors">➕</span>
            <span className="font-black italic text-gray-600 uppercase tracking-widest group-hover:text-white transition-colors">
              Nouvelle Équipe
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
