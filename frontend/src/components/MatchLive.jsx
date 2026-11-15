import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { updateStatistique } from "../api";
import { useAuth } from "../AuthContext";
import { peutModifier } from "../permissions";
import { useMatchLive } from "./match-live/useMatchLive";
import { estExclu, meilleurJoueur } from "./match-live/chrono";
import { TableauChrono } from "./match-live/TableauChrono";
import { MvpLive } from "./match-live/MvpLive";
import { PanneauEquipe } from "./match-live/PanneauEquipe";
import { ListeJoueursEquipe } from "./match-live/ListeJoueursEquipe";
import { ModalSelectionJoueur } from "./match-live/ModalSelectionJoueur";
import { ModalCorrection } from "./match-live/ModalCorrection";

const ALTERNANCE = { neutre: "domicile", domicile: "exterieur", exterieur: "domicile" };

function MatchLive() {
  const { user } = useAuth();
  const { id } = useParams();
  const { match, loading, chrono, loadMatch, patchMatch } = useMatchLive(id);

  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  // Action en attente du choix d'un joueur : { team, field, value, action }
  const [actionEnAttente, setActionEnAttente] = useState(null);
  const [statACorriger, setStatACorriger] = useState(null);
  // Ids des joueurs ciblés : leurs stats sont relues dans le match à jour
  const [cibles, setCibles] = useState({ home: null, away: null });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="text-6xl mb-4">🏀</div>
        <div className="text-xl athletic-font text-primary-orange">Chargement du match...</div>
      </div>
    );
  }

  if (!match) {
    return <div className="text-center py-8 athletic-font text-2xl">Match non trouvé</div>;
  }

  const isOwner = peutModifier(user, match.organisateur_id);
  const statistiques = match.statistiques || [];
  const homeStats = statistiques.filter((s) => s.equipe_nom === match.equipe_domicile_nom);
  const awayStats = statistiques.filter((s) => s.equipe_nom === match.equipe_exterieur_nom);
  const statParId = (statId) => statistiques.find((s) => s.id === statId) || null;

  const handleTimeout = async (team) => {
    const champ = team === "home" ? "timeouts_domicile" : "timeouts_exterieur";
    if (match[champ] > 0) {
      await patchMatch({ [champ]: match[champ] - 1, chrono_en_cours: false });
    }
  };

  const ouvrirSelection = (team, field, value) => {
    setActionEnAttente({ team, field, value: Math.abs(value), action: isCorrectionMode ? "decrement" : "increment" });
  };

  const handlePlayerSelect = async (stat) => {
    if (estExclu(stat, match)) {
      alert("Ce joueur est exclu pour limite de fautes !");
      return;
    }
    const { field, value, action } = actionEnAttente;
    await updateStatistique(id, stat.id, field, action, value);
    setActionEnAttente(null);
    loadMatch();
  };

  const handleConfirmCorrections = async (corrections) => {
    for (const [champ, delta] of Object.entries(corrections)) {
      if (delta !== 0) {
        await updateStatistique(id, statACorriger.id, champ, delta > 0 ? "increment" : "decrement", Math.abs(delta));
      }
    }
    setStatACorriger(null);
    loadMatch();
  };

  const selectionnerJoueur = (team, stat) => {
    setCibles((precedent) => ({ ...precedent, [team]: stat.id }));
    setStatACorriger(stat);
  };

  const equipes = [
    {
      team: "home",
      nom: match.equipe_domicile_nom,
      score: match.score_domicile,
      fautes: match.fautes_domicile,
      timeouts: match.timeouts_domicile,
      stats: homeStats,
    },
    {
      team: "away",
      nom: match.equipe_exterieur_nom,
      score: match.score_exterieur,
      fautes: match.fautes_exterieur,
      timeouts: match.timeouts_exterieur,
      stats: awayStats,
    },
  ];

  const panneau = ({ team, nom, score, fautes, timeouts }) => (
    <PanneauEquipe
      match={match}
      nom={nom}
      score={score}
      fautes={fautes}
      timeouts={timeouts}
      joueurCible={statParId(cibles[team])}
      isOwner={isOwner}
      onStat={(champ, valeur) => ouvrirSelection(team, champ, valeur)}
      onRetirerCible={() => setCibles((precedent) => ({ ...precedent, [team]: null }))}
      onTimeout={() => handleTimeout(team)}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4 relative overflow-hidden">
      {/* Image de fond avec transparence */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{
          backgroundImage: "url(/images/backgrounds/action-game.jpg)",
          filter: "grayscale(30%) brightness(0.7)",
        }}
      />

      {/* Overlay gradient pour meilleure lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <Link
            to={`/match/${id}`}
            className="text-gray-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
          >
            ← Voir les stats détaillées
          </Link>
          <Link
            to={`/tournoi/${match.tournoi_slug}`}
            className="text-primary-orange hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
          >
            Tableau du Tournoi 🏆
          </Link>
        </div>

        {!isOwner && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <span className="text-2xl">👁️</span>
              <div>
                <p className="text-blue-400 font-black uppercase text-[10px] tracking-widest">Mode Consultant Actif</p>
                <p className="text-gray-400 text-xs">
                  Analyse en temps réel du tournoi de{" "}
                  <span className="text-white font-bold">{match.organisateur_nom || "l'organisateur"}</span>.
                </p>
              </div>
            </div>
            <div className="hidden sm:block text-[10px] font-black text-blue-500/50 uppercase tracking-tighter">
              Lecture seule
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-4 sm:p-8 mb-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
              <button className="hidden lg:flex w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                <span className="text-2xl">🏀</span>
              </button>

              <TableauChrono
                match={match}
                chrono={chrono}
                isOwner={isOwner}
                onToggleChrono={() => patchMatch({ chrono_en_cours: !match.chrono_en_cours })}
                onResetShotClock={(secondes) => patchMatch({ shot_clock_secondes: secondes })}
                onTogglePossession={() =>
                  patchMatch({ possession_fleche: ALTERNANCE[match.possession_fleche || "neutre"] })
                }
                onResetChrono={() =>
                  patchMatch({ temps_restant_secondes: match.duree_periode_secondes, chrono_en_cours: false })
                }
                onNextPeriode={() =>
                  patchMatch({
                    periode_actuelle: match.periode_actuelle + 1,
                    temps_restant_secondes: match.duree_periode_secondes,
                    chrono_en_cours: false,
                  })
                }
              />

              <MvpLive mvp={meilleurJoueur(statistiques)} />

              <div className="flex gap-4 items-center">
                {isOwner && (
                  <button
                    onClick={() => setIsCorrectionMode(!isCorrectionMode)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${isCorrectionMode ? "bg-red-500 border-red-400 text-white animate-pulse" : "bg-white/5 border-white/10 text-gray-500 hover:text-white"}`}
                  >
                    <span className="text-xl">{isCorrectionMode ? "✖️" : "✏️"}</span>
                    <span className="text-[8px] font-black uppercase mt-1">
                      {isCorrectionMode ? "Correction Active" : "Mode Edition"}
                    </span>
                  </button>
                )}
                <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                  <span className="text-2xl">⚙️</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8 items-start md:items-center">
              {panneau(equipes[0])}

              <div className="hidden md:flex flex-col items-center">
                <div className="text-6xl font-black text-white/20 italic mb-4">VS</div>
                <div className="w-1 h-32 bg-white/10"></div>
              </div>

              {panneau(equipes[1])}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipes.map(({ team, nom, stats }) => (
              <ListeJoueursEquipe
                key={team}
                titre={nom}
                stats={stats}
                idSelectionne={cibles[team]}
                match={match}
                isOwner={isOwner}
                onSelect={(stat) => selectionnerJoueur(team, stat)}
              />
            ))}
          </div>
        </div>

        {actionEnAttente && (
          <ModalSelectionJoueur
            action={actionEnAttente}
            stats={actionEnAttente.team === "home" ? homeStats : awayStats}
            match={match}
            onSelect={handlePlayerSelect}
            onAnnuler={() => setActionEnAttente(null)}
          />
        )}

        {statACorriger && (
          <ModalCorrection
            stat={statACorriger}
            onConfirmer={handleConfirmCorrections}
            onAnnuler={() => setStatACorriger(null)}
          />
        )}
      </div>
    </div>
  );
}

export default MatchLive;
