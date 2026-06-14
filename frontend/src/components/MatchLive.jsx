import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getMatch, updateMatch, updateStatistique } from "../api";
import { useAuth } from "../AuthContext";

const API_BASE_URL = "http://localhost:8000";

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
};

function MatchLive() {
  const { user } = useAuth();
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayerHome, setSelectedPlayerHome] = useState(null);
  const [selectedPlayerAway, setSelectedPlayerAway] = useState(null);
  const [showPlayerSelector, setShowPlayerSelector] = useState({
    show: false,
    team: null,
    field: "points",
    value: 0,
  });
  const [matchMVP, setMatchMVP] = useState(null);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [tempTime, setTempTime] = useState({ min: 0, sec: 0 });
  const [showCorrectionModal, setShowCorrectionModal] = useState({
    show: false,
    stat: null,
  });
  const [pendingCorrections, setPendingCorrections] = useState({
    points: 0,
    rebonds: 0,
    passes: 0,
    fautes: 0,
  });

  const isOwner = user && match && match.organisateur_nom === user.username;

  useEffect(() => {
    loadMatch();
    const interval = setInterval(loadMatch, 2000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!match || !match.chrono_en_cours) return;

    const interval = setInterval(async () => {
      const updates = {};

      // Chrono principal
      if (match.temps_restant_secondes > 0) {
        updates.temps_restant_secondes = match.temps_restant_secondes - 1;
      } else {
        updates.chrono_en_cours = false;
      }

      // Shot Clock
      if (match.shot_clock_secondes > 0 && match.temps_restant_secondes > 0) {
        updates.shot_clock_secondes = match.shot_clock_secondes - 1;
        if (updates.shot_clock_secondes === 0) {
          updates.chrono_en_cours = false;
        }
      }

      // Passage automatique à la période suivante si le temps est écoulé
      if (match.temps_restant_secondes === 0 && match.chrono_en_cours) {
        updates.chrono_en_cours = false;
        updates.periode_actuelle = match.periode_actuelle + 1;
        updates.temps_restant_secondes = match.duree_periode_secondes;
        updates.shot_clock_secondes = 24; // Reset shot clock too
      }

      if (Object.keys(updates).length > 0) {
        await updateMatch(id, updates);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    match?.chrono_en_cours,
    match?.temps_restant_secondes,
    match?.shot_clock_secondes,
    id,
  ]);

  const loadMatch = async () => {
    try {
      const response = await getMatch(id);
      setMatch(response.data);

      // Sélectionner automatiquement le premier joueur si aucun n'est sélectionné
      if (response.data.statistiques && response.data.statistiques.length > 0) {
        const homeStats = response.data.statistiques.filter(
          (s) => s.equipe_nom === response.data.equipe_domicile_nom,
        );
        const awayStats = response.data.statistiques.filter(
          (s) => s.equipe_nom === response.data.equipe_exterieur_nom,
        );

        /* Suppression de la sélection automatique pour laisser l'utilisateur choisir à chaque fois */

        // Calculer le MVP du match en direct
        const sortedStats = [...response.data.statistiques].sort((a, b) => {
          const evalA = a.points + a.passes + a.rebonds + a.contres - a.fautes;
          const evalB = b.points + b.passes + b.rebonds + b.contres - b.fautes;
          return evalB - evalA;
        });
        if (sortedStats.length > 0) setMatchMVP(sortedStats[0]);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChrono = async () => {
    await updateMatch(id, { chrono_en_cours: !match.chrono_en_cours });
    loadMatch();
  };

  const handleResetChrono = async () => {
    await updateMatch(id, {
      temps_restant_secondes: match.duree_periode_secondes,
      chrono_en_cours: false,
    });
    loadMatch();
  };

  const handleNextPeriode = async () => {
    await updateMatch(id, {
      periode_actuelle: match.periode_actuelle + 1,
      temps_restant_secondes: match.duree_periode_secondes,
      chrono_en_cours: false,
    });
    loadMatch();
  };

  const handleTimeout = async (team) => {
    const field = team === "home" ? "timeouts_domicile" : "timeouts_exterieur";
    const current =
      team === "home" ? match.timeouts_domicile : match.timeouts_exterieur;

    if (current > 0) {
      await updateMatch(id, { [field]: current - 1, chrono_en_cours: false });
      loadMatch();
    }
  };

  const handleResetShotClock = async (seconds) => {
    await updateMatch(id, { shot_clock_secondes: seconds });
    loadMatch();
  };

  const handleTogglePossession = async () => {
    const next = {
      neutre: "domicile",
      domicile: "exterieur",
      exterieur: "domicile",
    };
    await updateMatch(id, {
      possession_fleche: next[match.possession_fleche || "neutre"],
    });
    loadMatch();
  };

  const handleQuickStat = async (team, field, value) => {
    const action = isCorrectionMode ? "decrement" : "increment";
    const absoluteVal = Math.abs(value);
    setShowPlayerSelector({
      show: true,
      team,
      field,
      value: absoluteVal,
      action,
    });
  };

  const handlePlayerSelect = async (stat) => {
    // Vérifier si le joueur est exclu
    if (stat.fautes >= (match.tournoi_limite_fautes || 5)) {
      alert("Ce joueur est exclu pour limite de fautes !");
      return;
    }

    const { team, field, value, action } = showPlayerSelector;
    await updateStatistique(id, stat.id, field, action || "increment", value);

    // On ne définit plus de joueur "persistant" ici pour forcer le choix au prochain clic
    setShowPlayerSelector({
      show: false,
      team: null,
      field: "points",
      value: 0,
    });
    loadMatch();
  };

  const handleConfirmCorrections = async () => {
    if (!showCorrectionModal.stat) return;

    const fields = ["points", "rebonds", "passes", "fautes"];
    for (const field of fields) {
      const val = pendingCorrections[field];
      if (val !== 0) {
        // On utilise decrement pour les valeurs négatives, avec la valeur absolue
        const action = val > 0 ? "increment" : "decrement";
        const absoluteVal = Math.abs(val);
        await updateStatistique(
          id,
          showCorrectionModal.stat.id,
          field,
          action,
          absoluteVal,
        );
      }
    }

    setPendingCorrections({ points: 0, rebonds: 0, passes: 0, fautes: 0 });
    setShowCorrectionModal({ show: false, stat: null });
    loadMatch();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="text-6xl mb-4">🏀</div>
        <div className="text-xl athletic-font text-primary-orange">
          Chargement du match...
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-8 athletic-font text-2xl">
        Match non trouvé
      </div>
    );
  }

  const homeStats =
    match.statistiques?.filter(
      (s) => s.equipe_nom === match.equipe_domicile_nom,
    ) || [];
  const awayStats =
    match.statistiques?.filter(
      (s) => s.equipe_nom === match.equipe_exterieur_nom,
    ) || [];

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

      {/* Contenu principal */}
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          <Link
            to={`/match/${id}`}
            className="text-gray-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
          >
            ← Voir les stats détaillées
          </Link>
          {match && (
            <Link
              to={`/tournoi/${match.tournoi_slug}`}
              className="text-primary-orange hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
            >
              Tableau du Tournoi 🏆
            </Link>
          )}
        </div>
        
        {!isOwner && match && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <span className="text-2xl">👁️</span>
              <div>
                <p className="text-blue-400 font-black uppercase text-[10px] tracking-widest">Mode Consultant Actif</p>
                <p className="text-gray-400 text-xs">Analyse en temps réel du tournoi de <span className="text-white font-bold">{match.organisateur_nom || 'l\'organisateur'}</span>.</p>
              </div>
            </div>
            <div className="text-[10px] font-black text-blue-500/50 uppercase tracking-tighter">Lecture seule</div>
          </div>
        )}

        {/* Interface Scoreboard */}
        <div className="max-w-6xl mx-auto">
          {/* Header avec chronomètre et période */}
          <div className="glass-card p-8 mb-6">
            <div className="flex items-center justify-between mb-8">
              {/* Bouton Settings */}
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                <span className="text-2xl">🏀</span>
              </button>

              {/* Chronomètre */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-8 mb-4">
                  {/* Flèche Possession Gauche */}
                  <div
                    className={`text-4xl transition-all ${match.possession_fleche === "domicile" ? "text-primary-orange scale-125" : "text-white/5"}`}
                  >
                    ◄
                  </div>

                  {isOwner && (
                    <button
                      onClick={handleToggleChrono}
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${match.chrono_en_cours ? "bg-red-500/20 text-red-500 border-2 border-red-500/50" : "bg-green-500/20 text-green-500 border-2 border-green-500/50"}`}
                    >
                      <span className="text-4xl">
                        {match.chrono_en_cours ? "⏸️" : "▶️"}
                      </span>
                    </button>
                  )}
                  
                  {!isOwner && (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center bg-white/5 border-2 border-white/10 opacity-30">
                      <span className="text-2xl">{match.chrono_en_cours ? "⚡" : "⏸️"}</span>
                    </div>
                  )}

                  {/* Flèche Possession Droite */}
                  <div
                    className={`text-4xl transition-all ${match.possession_fleche === "exterieur" ? "text-primary-orange scale-125" : "text-white/5"}`}
                  >
                    ►
                  </div>
                </div>

                <div className="flex items-end gap-6 mb-4">
                  <div
                    className="text-8xl font-black text-red-500 digital-font leading-none"
                  >
                    {formatTime(match.temps_restant_secondes)}
                  </div>
                  {/* Shot Clock Display */}
                  <div
                    className={`text-6xl font-black digital-font leading-none pb-1 ${match.shot_clock_secondes <= 5 ? "text-yellow-500 animate-pulse" : "text-red-600"}`}
                  >
                    {match.shot_clock_secondes.toString().padStart(2, "0")}
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="text-2xl font-black text-white/40 uppercase tracking-widest italic"
                  >
                    {match.periode_actuelle === 1 && "1er Quart"}
                    {match.periode_actuelle === 2 && "2e Quart"}
                    {match.periode_actuelle === 3 && "3e Quart"}
                    {match.periode_actuelle === 4 && "4e Quart"}
                    {match.periode_actuelle > 4 &&
                      `Prolongation ${match.periode_actuelle - 4}`}
                  </div>
                </div>

                {/* Contrôles Rapides */}
                {isOwner && (
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => handleResetShotClock(24)}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                    >
                      Reset 24s
                    </button>
                    <button
                      onClick={() => handleResetShotClock(14)}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                    >
                      Reset 14s
                    </button>
                    <button
                      onClick={handleTogglePossession}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                    >
                      Alternance
                    </button>
                    <button
                      onClick={handleResetChrono}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 text-red-500"
                    >
                      Reset Temps
                    </button>
                    <button
                      onClick={handleNextPeriode}
                      className="px-4 py-2 bg-primary-orange rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-orange-600"
                    >
                      Période +1
                    </button>
                  </div>
                )}
              </div>

              {/* MVP Live Card */}
              <div className="hidden lg:flex flex-col items-center justify-center p-4 glass-card border-primary-orange/30 w-48">
                <div className="text-[10px] font-black text-primary-orange uppercase tracking-widest mb-2 animate-pulse">
                  MVP en Direct
                </div>
                {matchMVP ? (
                  <>
                    <div className="w-16 h-16 rounded-full border-2 border-primary-orange overflow-hidden mb-2">
                      {getImageUrl(matchMVP.joueur_photo) ? (
                        <img
                          src={getImageUrl(matchMVP.joueur_photo)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center text-xl">
                          👤
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-black uppercase text-white truncate w-full text-center">
                      #{matchMVP.joueur_numero} {matchMVP.joueur_nom}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                      Eval:{" "}
                      {matchMVP.points +
                        matchMVP.passes +
                        matchMVP.rebonds +
                        matchMVP.contres -
                        matchMVP.fautes}
                    </div>
                  </>
                ) : (
                  <div className="text-[8px] text-gray-600 italic">
                    Analyse des performances...
                  </div>
                )}
              </div>

              {/* Menu & Correction Toggle */}
              <div className="flex gap-4 items-center">
                {isOwner && (
                  <button
                    onClick={() => setIsCorrectionMode(!isCorrectionMode)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${isCorrectionMode ? "bg-red-500 border-red-400 text-white animate-pulse" : "bg-white/5 border-white/10 text-gray-500 hover:text-white"}`}
                  >
                    <span className="text-xl">
                      {isCorrectionMode ? "✖️" : "✏️"}
                    </span>
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

            {/* Scores et contrôles */}
            <div className="grid grid-cols-3 gap-8 items-center">
              {/* Équipe Domicile */}
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-4 uppercase">
                  {match.equipe_domicile_nom}
                </h2>

                {/* Boutons +1/+2/+3 */}
                {isOwner && (
                  <div className="flex justify-center gap-2 mb-4">
                    <button
                      onClick={() => handleQuickStat("home", "points", 1)}
                      className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-lg hover:bg-primary-orange hover:border-primary-orange transition-all"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => handleQuickStat("home", "points", 2)}
                      className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-lg hover:bg-primary-orange hover:border-primary-orange transition-all"
                    >
                      +2
                    </button>
                    <button
                      onClick={() => handleQuickStat("home", "points", 3)}
                      className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-lg hover:bg-primary-orange hover:border-primary-orange transition-all"
                    >
                      +3
                    </button>
                  </div>
                )}

                {/* Autres Stats Rapides */}
                {isOwner && (
                  <div className="flex justify-center gap-2 mb-6">
                    <button
                      onClick={() => handleQuickStat("home", "rebonds", 1)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] font-black text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                    >
                      REB
                    </button>
                    <button
                      onClick={() => handleQuickStat("home", "passes", 1)}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[10px] font-black text-purple-400 hover:bg-purple-500 hover:text-white transition-all"
                    >
                      AST
                    </button>
                    <button
                      onClick={() => handleQuickStat("home", "contres", 1)}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-[10px] font-black text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all"
                    >
                      BLK
                    </button>
                    <button
                      onClick={() => handleQuickStat("home", "fautes", 1)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] font-black text-red-400 hover:bg-red-500 hover:text-white transition-all"
                    >
                      FOU
                    </button>
                  </div>
                )}

                {/* Score */}
                <div className="text-9xl font-black text-green-400 digital-font mb-4">
                  {match.score_domicile}
                </div>

                {/* Fautes */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button className="text-red-500 text-2xl">◀</button>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">
                      Fautes
                    </div>
                    <div className="flex gap-1 justify-center mb-2">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${i < match.fautes_domicile ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-white/20"}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-2xl font-black text-red-500 digital-font">
                        {match.fautes_domicile}
                      </div>
                      {match.fautes_domicile >= 4 && (
                        <span className="bg-red-500 text-white text-[8px] font-black px-1 rounded animate-pulse">
                          BONUS
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="text-red-500 text-2xl">▶</button>
                </div>

                {/* Joueur sélectionné (HUD Actif) */}
                {selectedPlayerHome && (
                  <div
                    className={`group rounded-lg p-3 mb-4 flex items-center gap-3 relative overflow-hidden border ${selectedPlayerHome.fautes >= (match.tournoi_limite_fautes || 5) ? "bg-red-500/20 border-red-500" : "bg-white/5 border-white/20"}`}
                  >
                    <button
                      onClick={() => setSelectedPlayerHome(null)}
                      className="absolute top-1 right-1 w-5 h-5 bg-white/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-20"
                    >
                      <span className="text-[10px]">✕</span>
                    </button>
                    {selectedPlayerHome.fautes >=
                      (match.tournoi_limite_fautes || 5) && (
                      <div className="absolute inset-0 bg-red-600/60 flex items-center justify-center z-10">
                        <span className="text-white font-black italic text-sm tracking-widest">
                          EXCLU (FAUTES)
                        </span>
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center">
                      {getImageUrl(selectedPlayerHome.joueur_photo) ? (
                        <img
                          src={getImageUrl(selectedPlayerHome.joueur_photo)}
                          className="w-full h-full object-cover"
                          alt="photo"
                        />
                      ) : (
                        <span className="text-xl">👤</span>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        Joueur ciblé
                      </div>
                      <div className="font-black text-white text-sm">
                        #{selectedPlayerHome.joueur_numero}{" "}
                        {selectedPlayerHome.joueur_nom}
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeouts */}
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleTimeout("home")}
                      className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all mx-auto"
                      disabled={match.timeouts_domicile === 0}
                    >
                      <span className="text-2xl">⏱️</span>
                    </button>
                    <div className="text-xs text-gray-400 mt-2">
                      Timeouts: {match.timeouts_domicile}
                    </div>
                  </>
                )}
                {!isOwner && (
                  <div className="text-xs text-gray-500 mt-2 italic">
                    Timeouts restants: {match.timeouts_domicile}
                  </div>
                )}
              </div>

              {/* Séparateur VS */}
              <div className="flex flex-col items-center">
                <div className="text-6xl font-black text-white/20 italic mb-4">
                  VS
                </div>
                <div className="w-1 h-32 bg-white/10"></div>
              </div>

              {/* Équipe Extérieur */}
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-4 uppercase">
                  {match.equipe_exterieur_nom}
                </h2>

                {/* Boutons +1/+2/+3 */}
                {isOwner && (
                  <div className="flex justify-center gap-2 mb-4">
                    <button
                      onClick={() => handleQuickStat("away", "points", 1)}
                      className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-lg hover:bg-primary-orange hover:border-primary-orange transition-all"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => handleQuickStat("away", "points", 2)}
                      className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-lg hover:bg-primary-orange hover:border-primary-orange transition-all"
                    >
                      +2
                    </button>
                    <button
                      onClick={() => handleQuickStat("away", "points", 3)}
                      className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/20 text-white font-black text-lg hover:bg-primary-orange hover:border-primary-orange transition-all"
                    >
                      +3
                    </button>
                  </div>
                )}

                {/* Autres Stats Rapides */}
                {isOwner && (
                  <div className="flex justify-center gap-2 mb-6">
                    <button
                      onClick={() => handleQuickStat("away", "rebonds", 1)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] font-black text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                    >
                      REB
                    </button>
                    <button
                      onClick={() => handleQuickStat("away", "passes", 1)}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[10px] font-black text-purple-400 hover:bg-purple-500 hover:text-white transition-all"
                    >
                      AST
                    </button>
                    <button
                      onClick={() => handleQuickStat("away", "contres", 1)}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-[10px] font-black text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all"
                    >
                      BLK
                    </button>
                    <button
                      onClick={() => handleQuickStat("away", "fautes", 1)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] font-black text-red-400 hover:bg-red-500 hover:text-white transition-all"
                    >
                      FOU
                    </button>
                  </div>
                )}

                {/* Score */}
                <div className="text-9xl font-black text-green-400 digital-font mb-4">
                  {match.score_exterieur}
                </div>

                {/* Fautes */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button className="text-red-500 text-2xl">◀</button>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">
                      Fautes
                    </div>
                    <div className="flex gap-1 justify-center mb-2">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${i < match.fautes_exterieur ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-white/20"}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-2xl font-black text-red-500 digital-font">
                        {match.fautes_exterieur}
                      </div>
                      {match.fautes_exterieur >= 4 && (
                        <span className="bg-red-500 text-white text-[8px] font-black px-1 rounded animate-pulse">
                          BONUS
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="text-red-500 text-2xl">▶</button>
                </div>

                {/* Joueur sélectionné (HUD Actif) */}
                {selectedPlayerAway && (
                  <div
                    className={`group rounded-lg p-3 mb-4 flex items-center gap-3 relative overflow-hidden border ${selectedPlayerAway.fautes >= (match.tournoi_limite_fautes || 5) ? "bg-red-500/20 border-red-500" : "bg-white/5 border-white/20"}`}
                  >
                    <button
                      onClick={() => setSelectedPlayerAway(null)}
                      className="absolute top-1 right-1 w-5 h-5 bg-white/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-20"
                    >
                      <span className="text-[10px]">✕</span>
                    </button>
                    {selectedPlayerAway.fautes >=
                      (match.tournoi_limite_fautes || 5) && (
                      <div className="absolute inset-0 bg-red-600/60 flex items-center justify-center z-10">
                        <span className="text-white font-black italic text-sm tracking-widest">
                          EXCLU (FAUTES)
                        </span>
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center">
                      {getImageUrl(selectedPlayerAway.joueur_photo) ? (
                        <img
                          src={getImageUrl(selectedPlayerAway.joueur_photo)}
                          className="w-full h-full object-cover"
                          alt="photo"
                        />
                      ) : (
                        <span className="text-xl">👤</span>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        Joueur ciblé
                      </div>
                      <div className="font-black text-white text-sm">
                        #{selectedPlayerAway.joueur_numero}{" "}
                        {selectedPlayerAway.joueur_nom}
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeouts */}
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleTimeout("away")}
                      className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all mx-auto"
                      disabled={match.timeouts_exterieur === 0}
                    >
                      <span className="text-2xl">⏱️</span>
                    </button>
                    <div className="text-xs text-gray-400 mt-2">
                      Timeouts: {match.timeouts_exterieur}
                    </div>
                  </>
                )}
                {!isOwner && (
                  <div className="text-xs text-gray-500 mt-2 italic">
                    Timeouts restants: {match.timeouts_exterieur}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sélecteur de joueur rapide */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <h3 className="text-sm font-black text-gray-400 uppercase mb-3">
                {match.equipe_domicile_nom} - Sélectionner joueur
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {homeStats.map((stat) => (
                  <button
                    key={stat.id}
                    onClick={() => {
                      if (!isOwner) return;
                      setSelectedPlayerHome(stat);
                      setShowCorrectionModal({ show: true, stat });
                    }}
                    className={`w-full p-3 rounded-lg text-left transition-all relative overflow-hidden ${
                      selectedPlayerHome?.id === stat.id
                        ? "bg-primary-orange text-white"
                        : "bg-white/5 hover:bg-white/10"
                    } ${stat.fautes >= (match.tournoi_limite_fautes || 5) ? "opacity-50 grayscale" : ""}`}
                  >
                    {stat.fautes >= (match.tournoi_limite_fautes || 5) && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg">
                        EXCLU
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center">
                          {getImageUrl(stat.joueur_photo) ? (
                            <img
                              src={getImageUrl(stat.joueur_photo)}
                              className="w-full h-full object-cover"
                              alt="photo"
                            />
                          ) : (
                            <span className="text-sm">👤</span>
                          )}
                        </div>
                        <div>
                          <span className="font-black text-sm">
                            #{stat.joueur_numero}
                          </span>
                          <span className="ml-2 text-sm">
                            {stat.joueur_nom}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 text-[8px] font-black">
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Pts
                          </span>
                          <span className="text-white">{stat.points}</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Reb
                          </span>
                          <span className="text-white">{stat.rebonds}</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Ast
                          </span>
                          <span className="text-white">{stat.passes}</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Fou
                          </span>
                          <span
                            className={
                              stat.fautes >= (match.tournoi_limite_fautes || 5)
                                ? "text-red-500"
                                : "text-white"
                            }
                          >
                            {stat.fautes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="text-sm font-black text-gray-400 uppercase mb-3">
                {match.equipe_exterieur_nom} - Sélectionner joueur
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {awayStats.map((stat) => (
                  <button
                    key={stat.id}
                    onClick={() => {
                      if (!isOwner) return;
                      setSelectedPlayerAway(stat);
                      setShowCorrectionModal({ show: true, stat });
                    }}
                    className={`w-full p-3 rounded-lg text-left transition-all relative overflow-hidden ${
                      selectedPlayerAway?.id === stat.id
                        ? "bg-primary-orange text-white"
                        : "bg-white/5 hover:bg-white/10"
                    } ${stat.fautes >= (match.tournoi_limite_fautes || 5) ? "opacity-50 grayscale" : ""}`}
                  >
                    {stat.fautes >= (match.tournoi_limite_fautes || 5) && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg">
                        EXCLU
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center">
                          {getImageUrl(stat.joueur_photo) ? (
                            <img
                              src={getImageUrl(stat.joueur_photo)}
                              className="w-full h-full object-cover"
                              alt="photo"
                            />
                          ) : (
                            <span className="text-sm">👤</span>
                          )}
                        </div>
                        <div>
                          <span className="font-black text-sm">
                            #{stat.joueur_numero}
                          </span>
                          <span className="ml-2 text-sm">
                            {stat.joueur_nom}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 text-[8px] font-black">
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Pts
                          </span>
                          <span className="text-white">{stat.points}</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Reb
                          </span>
                          <span className="text-white">{stat.rebonds}</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Ast
                          </span>
                          <span className="text-white">{stat.passes}</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[24px]">
                          <span className="text-gray-500 uppercase text-[6px]">
                            Fou
                          </span>
                          <span
                            className={
                              stat.fautes >= (match.tournoi_limite_fautes || 5)
                                ? "text-red-500"
                                : "text-white"
                            }
                          >
                            {stat.fautes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
      </div>

      {/* Modal de sélection de joueur */}
      {showPlayerSelector.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full p-6">
            <h3 className="text-2xl font-black text-white mb-4">
              Action:{" "}
              <span className="text-primary-orange uppercase">
                {showPlayerSelector.field === "points"
                  ? `${showPlayerSelector.value} PTS`
                  : showPlayerSelector.field.toUpperCase()}
              </span>
            </h3>
            <p className="text-gray-400 text-sm mb-6 uppercase font-bold tracking-widest">
              Sélectionner le joueur concerné :
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {(showPlayerSelector.team === "home" ? homeStats : awayStats).map(
                (stat) => (
                  <button
                    key={stat.id}
                    onClick={() => handlePlayerSelect(stat)}
                    className="w-full p-4 rounded-lg bg-white/5 hover:bg-primary-orange transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center relative">
                          {getImageUrl(stat.joueur_photo) ? (
                            <img
                              src={getImageUrl(stat.joueur_photo)}
                              className="w-full h-full object-cover"
                              alt="photo"
                            />
                          ) : (
                            <span className="text-xl">👤</span>
                          )}
                          {stat.fautes >=
                            (match.tournoi_limite_fautes || 5) && (
                            <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center">
                              <span className="text-[8px] font-black text-white leading-tight text-center uppercase">
                                Exclu
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span
                            className={`font-black text-xl ${stat.fautes >= (match.tournoi_limite_fautes || 5) ? "text-red-500 line-through" : "text-white"}`}
                          >
                            #{stat.joueur_numero}
                          </span>
                          <span
                            className={`ml-4 text-lg font-bold ${stat.fautes >= (match.tournoi_limite_fautes || 5) ? "text-red-500" : "text-white"}`}
                          >
                            {stat.joueur_nom}
                          </span>
                          {stat.fautes === match.tournoi_limite_fautes - 1 && (
                            <span className="ml-2 text-[10px] text-yellow-500 font-black animate-pulse">
                              ! FOUL TROUBLE
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 text-[10px] font-black italic">
                        <div className="flex flex-col items-center bg-white/5 px-3 py-1 rounded border border-white/5">
                          <span className="text-primary-orange uppercase text-[8px]">
                            Pts
                          </span>
                          <span className="text-xl text-white">
                            {stat.points}
                          </span>
                        </div>
                        <div className="flex flex-col items-center bg-white/5 px-3 py-1 rounded border border-white/5">
                          <span className="text-blue-400 uppercase text-[8px]">
                            Reb
                          </span>
                          <span className="text-xl text-white">
                            {stat.rebonds}
                          </span>
                        </div>
                        <div className="flex flex-col items-center bg-white/5 px-3 py-1 rounded border border-white/5">
                          <span className="text-purple-400 uppercase text-[8px]">
                            Ast
                          </span>
                          <span className="text-xl text-white">
                            {stat.passes}
                          </span>
                        </div>
                        <div className="flex flex-col items-center bg-white/5 px-3 py-1 rounded border border-white/5">
                          <span className="text-red-500 uppercase text-[8px]">
                            Fou
                          </span>
                          <span
                            className={`text-xl ${stat.fautes >= (match.tournoi_limite_fautes || 5) ? "text-red-600" : "text-white"}`}
                          >
                            {stat.fautes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() =>
                setShowPlayerSelector({ show: false, team: null, points: 0 })
              }
              className="w-full py-3 bg-red-500 rounded-lg font-black hover:bg-red-600 transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {/* Modal Ajustement Temps */}
      {showTimeModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
          <div className="glass-card max-w-sm w-full p-8 text-center border-primary-orange/50">
            <h3 className="text-2xl font-black text-white mb-8 uppercase italic tracking-tighter">
              Ajuster le Chrono
            </h3>
            <div className="flex items-center justify-center gap-6 mb-10">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    setTempTime((p) => ({ ...p, min: Math.min(99, p.min + 1) }))
                  }
                  className="text-2xl text-primary-orange font-black"
                >
                  ▲
                </button>
                <div className="text-5xl font-black digital-font bg-white/5 p-4 rounded-xl w-24">
                  {tempTime.min.toString().padStart(2, "0")}
                </div>
                <button
                  onClick={() =>
                    setTempTime((p) => ({ ...p, min: Math.max(0, p.min - 1) }))
                  }
                  className="text-2xl text-primary-orange font-black"
                >
                  ▼
                </button>
              </div>
              <div className="text-4xl font-black text-white">:</div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    setTempTime((p) => ({ ...p, sec: Math.min(59, p.sec + 1) }))
                  }
                  className="text-2xl text-primary-orange font-black"
                >
                  ▲
                </button>
                <div className="text-5xl font-black digital-font bg-white/5 p-4 rounded-xl w-24">
                  {tempTime.sec.toString().padStart(2, "0")}
                </div>
                <button
                  onClick={() =>
                    setTempTime((p) => ({ ...p, sec: Math.max(0, p.sec - 1) }))
                  }
                  className="text-2xl text-primary-orange font-black"
                >
                  ▼
                </button>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  await updateMatch(id, {
                    temps_restant_secondes: tempTime.min * 60 + tempTime.sec,
                    chrono_en_cours: false,
                  });
                  setShowTimeModal(false);
                  loadMatch();
                }}
                className="btn-basketball flex-1 py-4"
              >
                Appliquer
              </button>
              <button
                onClick={() => setShowTimeModal(false)}
                className="bg-white/10 text-white flex-1 rounded-xl font-black uppercase tracking-widest text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustement Période */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
          <div className="glass-card max-w-sm w-full p-8 text-center border-primary-orange/50">
            <h3 className="text-2xl font-black text-white mb-8 uppercase italic tracking-tighter">
              Changer la Période
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {[1, 2, 3, 4, 5, 6].map((p) => (
                <button
                  key={p}
                  onClick={async () => {
                    await updateMatch(id, {
                      periode_actuelle: p,
                      chrono_en_cours: false,
                    });
                    setShowPeriodModal(false);
                    loadMatch();
                  }}
                  className={`py-4 rounded-xl font-black transition-all ${match.periode_actuelle === p ? "bg-primary-orange text-white" : "bg-white/5 text-gray-400 hover:text-white"}`}
                >
                  {p <= 4 ? `${p}e Quart` : `Prolongation ${p - 4}`}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPeriodModal(false)}
              className="w-full bg-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {/* Modal Correction Statistique Joueur */}
      {showCorrectionModal.show && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[70] p-4">
          <div className="glass-card max-w-sm w-full p-8 text-center border-red-500/50">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full border-2 border-red-500 overflow-hidden mb-4">
                {getImageUrl(showCorrectionModal.stat.joueur_photo) ? (
                  <img
                    src={getImageUrl(showCorrectionModal.stat.joueur_photo)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-2xl">
                    👤
                  </div>
                )}
              </div>
              <h3 className="text-xl font-black text-white uppercase italic">
                CORRIGER : #{showCorrectionModal.stat.joueur_numero}{" "}
                {showCorrectionModal.stat.joueur_nom}
              </h3>

              {/* Affichage des corrections en attente */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {Object.entries(pendingCorrections).map(
                  ([field, val]) =>
                    val !== 0 && (
                      <span
                        key={field}
                        className="px-3 py-1 bg-red-500 text-white text-[10px] font-black rounded-full animate-bounce"
                      >
                        {val} {field.toUpperCase()}
                      </span>
                    ),
                )}
                {Object.values(pendingCorrections).every((v) => v === 0) && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Choisir les éléments à retirer
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              <button
                onClick={() =>
                  setPendingCorrections((p) => ({ ...p, points: p.points - 1 }))
                }
                className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
              >
                -1 POINT
              </button>
              <button
                onClick={() =>
                  setPendingCorrections((p) => ({
                    ...p,
                    rebonds: p.rebonds - 1,
                  }))
                }
                className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
              >
                -1 REBOND
              </button>
              <button
                onClick={() =>
                  setPendingCorrections((p) => ({ ...p, passes: p.passes - 1 }))
                }
                className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
              >
                -1 ASSIST
              </button>
              <button
                onClick={() =>
                  setPendingCorrections((p) => ({ ...p, fautes: p.fautes - 1 }))
                }
                className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
              >
                -1 FAUTE
              </button>
              <button
                onClick={() =>
                  setPendingCorrections((p) => ({ ...p, points: p.points - 2 }))
                }
                className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
              >
                -2 POINTS
              </button>
              <button
                onClick={() =>
                  setPendingCorrections((p) => ({ ...p, points: p.points - 3 }))
                }
                className="py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all text-white"
              >
                -3 POINTS
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleConfirmCorrections}
                disabled={Object.values(pendingCorrections).every(
                  (v) => v === 0,
                )}
                className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${Object.values(pendingCorrections).every((v) => v === 0) ? "bg-gray-800 text-gray-600" : "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"}`}
              >
                Confirmer
              </button>
              <button
                onClick={() => {
                  setPendingCorrections({
                    points: 0,
                    rebonds: 0,
                    passes: 0,
                    fautes: 0,
                  });
                  setShowCorrectionModal({ show: false, stat: null });
                }}
                className="flex-1 py-4 bg-white/5 text-gray-400 rounded-xl font-black uppercase tracking-widest text-xs hover:text-white"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}

export default MatchLive;
