import React, { useState } from "react";
import { createMatch, getClassement, resetPlayoffs } from "../../api";
import { MatchCard } from "./MatchCard";

const PHASES = [
  { id: "8eme", label: "8èmes de finale", actif: "has_8emes", equipes: 16 },
  { id: "quart", label: "Quarts de finale", actif: "has_quarts", equipes: 8 },
  { id: "demi", label: "Demi-finales", actif: "has_demis", equipes: 4 },
  { id: "finale", label: "La Grande Finale", actif: "has_finale", equipes: 2 },
];

export function OngletPhaseFinale({ tournoi, matchs, equipes, isOwner, onCreerMatch, onSupprimerMatch, recharger }) {
  const [enCours, setEnCours] = useState(false);

  const matchsPoule = matchs.filter((m) => m.phase === "poule");
  const pouleTerminee = matchsPoule.length > 0 && matchsPoule.every((m) => m.statut === "termine");
  const aDesMatchsEliminatoires = matchs.some((m) => m.phase !== "poule");
  const phasesActives = PHASES.filter((p) => tournoi[p.actif]);

  const genererTableau = async () => {
    const depart = phasesActives[0];
    if (!depart) {
      alert("Aucune phase finale configurée pour ce tournoi.");
      return;
    }

    let classementPoule = [];
    try {
      const res = await getClassement(tournoi.slug, "poule");
      classementPoule = res.data || [];
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la récupération du classement de poule.");
      return;
    }

    if (classementPoule.length < depart.equipes) {
      alert(
        `Il y a seulement ${classementPoule.length} équipes, mais la phase de ${depart.id} nécessite au moins ${depart.equipes} équipes.`,
      );
      return;
    }

    if (
      !window.confirm(
        `Générer automatiquement les matchs de ${depart.id} avec les ${depart.equipes} premières équipes du classement ?`,
      )
    ) {
      return;
    }

    setEnCours(true);
    try {
      // 1er contre dernier qualifié, 2e contre avant-dernier...
      for (let i = 0; i < depart.equipes / 2; i++) {
        await createMatch({
          tournoi: parseInt(tournoi.id),
          phase: depart.id,
          equipe_domicile: classementPoule[i].id,
          equipe_exterieur: classementPoule[depart.equipes - 1 - i].id,
          statut: "a_venir",
        });
      }
      alert(`Les matchs de ${depart.id} ont été générés avec succès !`);
      recharger();
    } catch (error) {
      console.error("Erreur lors de la génération automatique :", error);
      alert("Erreur lors de la génération automatique des matchs.");
    } finally {
      setEnCours(false);
    }
  };

  const reinitialiser = async () => {
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir réinitialiser TOUTES les phases finales et revenir à la phase de poules ? Tous les matchs éliminatoires seront supprimés.",
      )
    ) {
      return;
    }
    setEnCours(true);
    try {
      await resetPlayoffs(tournoi.slug);
      alert("Les phases finales ont été réinitialisées.");
      recharger();
    } catch (err) {
      console.error("Erreur réinitialisation playoffs:", err);
      alert("Erreur lors de la réinitialisation des playoffs.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-white/5 pb-4">
        <h2 className="text-2xl sm:text-4xl font-black italic card-title-accent uppercase flex items-center gap-4">
          🏆 Brackets de la Phase Finale
        </h2>
        {pouleTerminee && isOwner && aDesMatchsEliminatoires && (
          <button
            onClick={reinitialiser}
            disabled={enCours}
            className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-wider transition-all flex items-center gap-2 hover:scale-105 disabled:opacity-50"
          >
            🔄 Réinitialiser les Playoffs
          </button>
        )}
      </div>

      {!pouleTerminee ? (
        <div className="glass-card p-6 sm:p-12 text-center max-w-lg mx-auto">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-2xl font-black uppercase italic text-white mb-2">Phase Finale Verrouillée</h3>
          <p className="text-gray-400 text-sm mb-6">
            Vous devez d'abord programmer et terminer tous les matchs de la phase de poules avant d'accéder aux phases
            éliminatoires.
          </p>
          {matchsPoule.length === 0 ? (
            <span className="text-[10px] font-black text-primary-orange uppercase tracking-widest bg-primary-orange/10 px-3 py-1.5 rounded-full">
              Aucun match de poule programmé
            </span>
          ) : (
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-full">
              Matchs restants : {matchsPoule.filter((m) => m.statut !== "termine").length}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-12 max-w-5xl mx-auto">
          {isOwner && !aDesMatchsEliminatoires && (
            <div className="bg-white/5 border border-primary-orange/20 rounded-3xl p-6 sm:p-10 text-center max-w-xl mx-auto shadow-2xl">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-2xl font-black uppercase italic text-white mb-2">Prêt pour la Phase Finale</h3>
              <p className="text-gray-400 text-sm mb-6">
                Tous les matchs de la phase de poule sont terminés. Vous pouvez maintenant générer automatiquement les
                rencontres éliminatoires basées sur le classement officiel.
              </p>
              <button
                onClick={genererTableau}
                disabled={enCours}
                className="btn-basketball px-10 py-4 text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                {enCours ? "Génération..." : "🚀 Générer le Tableau Final"}
              </button>
            </div>
          )}

          {phasesActives.map((phase) => {
            const matchsPhase = matchs.filter((m) => m.phase === phase.id);
            return (
              <div key={phase.id} className="relative">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
                  <span className="bg-primary-orange w-8 sm:w-12 h-1 text-white"></span>
                  <h3 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter">{phase.label}</h3>
                  {isOwner && (
                    <button
                      onClick={() => onCreerMatch(phase.id)}
                      className="ml-auto bg-white/5 hover:bg-primary-orange p-2 px-4 rounded-xl text-[10px] font-black transition-all"
                    >
                      + CRÉER MATCH {phase.id.toUpperCase()}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {matchsPhase.map((match) => (
                    <MatchCard key={match.id} match={match} equipes={equipes} onDelete={onSupprimerMatch} isOwner={isOwner} />
                  ))}
                  {matchsPhase.length === 0 && (
                    <div className="md:col-span-2 bg-white/3 border-2 border-dashed border-white/5 rounded-3xl p-8 text-center opacity-30 italic font-bold">
                      Matchs de {phase.label} non programmés.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
