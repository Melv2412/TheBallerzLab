import React, { useState } from "react";
import { genererPhasesFinales, messageErreur, resetPlayoffs } from "../../api";
import { MatchCard } from "./MatchCard";
import { CarteSerie, formatSerie, usePhasesFinales } from "./Series";

export function OngletPhaseFinale({ tournoi, matchs, equipes, isOwner, onCreerMatch, onSupprimerMatch, recharger }) {
  const [enCours, setEnCours] = useState(false);
  const phases = usePhasesFinales(tournoi.slug, matchs);

  const matchsPoule = matchs.filter((m) => m.phase === "poule");
  const restantsPoule = matchsPoule.filter((m) => m.statut !== "termine").length;
  const aDesMatchsEliminatoires = matchs.some((m) => m.phase !== "poule");
  const matchParId = Object.fromEntries(matchs.map((m) => [m.id, m]));

  const executer = async (action, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setEnCours(true);
    try {
      await action();
      recharger();
    } catch (erreur) {
      alert(messageErreur(erreur, "Action impossible."));
    } finally {
      setEnCours(false);
    }
  };

  const premierePhase = phases[0];
  const generer = () =>
    executer(
      () => genererPhasesFinales(tournoi.slug),
      premierePhase &&
        `Créer les ${premierePhase.libelle.toLowerCase()} avec les meilleures équipes du classement de poule (1er contre dernier qualifié) ? La suite du tableau se remplira automatiquement.`,
    );
  const reinitialiser = () =>
    executer(
      () => resetPlayoffs(tournoi.slug),
      "Réinitialiser TOUTES les phases finales ? Tous les matchs éliminatoires seront supprimés.",
    );

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-white/5 pb-4">
        <h2 className="text-2xl sm:text-4xl font-black italic card-title-accent uppercase flex items-center gap-4">
          🏆 Brackets de la Phase Finale
        </h2>
        {isOwner && aDesMatchsEliminatoires && (
          <button
            onClick={reinitialiser}
            disabled={enCours}
            className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-wider transition-all flex items-center gap-2 hover:scale-105 disabled:opacity-50"
          >
            🔄 Réinitialiser les Playoffs
          </button>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="glass-card p-10 text-center opacity-60">
          Aucune phase finale activée. {isOwner && "Activez-les dans l'onglet Paramètres."}
        </div>
      ) : restantsPoule > 0 && !aDesMatchsEliminatoires ? (
        <div className="glass-card p-6 sm:p-12 text-center max-w-lg mx-auto">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-2xl font-black uppercase italic text-white mb-2">Phase Finale Verrouillée</h3>
          <p className="text-gray-400 text-sm mb-6">
            Terminez tous les matchs de poule avant de lancer les phases éliminatoires.
          </p>
          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-full">
            Matchs restants : {restantsPoule}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-12 max-w-5xl mx-auto">
          {isOwner && !aDesMatchsEliminatoires && (
            <div className="bg-white/5 border border-primary-orange/20 rounded-3xl p-6 sm:p-10 text-center max-w-xl mx-auto shadow-2xl">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-2xl font-black uppercase italic text-white mb-2">Prêt pour la Phase Finale</h3>
              <p className="text-gray-400 text-sm mb-6">
                Le premier tour est créé d'après le classement de poule
                {matchsPoule.length === 0 && " (sans match de poule : ordre alphabétique)"}. Ensuite, chaque série
                se poursuit et le tour suivant se crée automatiquement à chaque résultat.
              </p>
              <button
                onClick={generer}
                disabled={enCours}
                className="btn-basketball px-10 py-4 text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                {enCours ? "Génération..." : "🚀 Générer le Tableau Final"}
              </button>
            </div>
          )}

          {phases.map((phase) => (
            <div key={phase.phase} className="relative">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
                <span className="bg-primary-orange w-8 sm:w-12 h-1 text-white"></span>
                <h3 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter">{phase.libelle}</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {formatSerie(phase.victoires_requises)}
                </span>
                {isOwner && (
                  <button
                    onClick={() => onCreerMatch(phase.phase)}
                    className="ml-auto bg-white/5 hover:bg-primary-orange p-2 px-4 rounded-xl text-[10px] font-black transition-all"
                  >
                    + CRÉER MATCH {phase.phase.toUpperCase()}
                  </button>
                )}
              </div>

              {phase.series.length === 0 ? (
                <div className="bg-white/3 border-2 border-dashed border-white/5 rounded-3xl p-8 text-center opacity-30 italic font-bold">
                  {phase.libelle} : en attente des qualifiés.
                </div>
              ) : (
                <div className="space-y-8">
                  {phase.series.map((serie) => (
                    <div key={serie.matchs[0]} className="space-y-3">
                      <CarteSerie serie={serie} victoiresRequises={phase.victoires_requises} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {serie.matchs
                          .map((id) => matchParId[id])
                          .filter(Boolean)
                          .map((match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              equipes={equipes}
                              onDelete={onSupprimerMatch}
                              isOwner={isOwner}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
