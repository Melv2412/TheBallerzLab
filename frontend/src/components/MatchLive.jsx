import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { updateStatistique, tempsMort, periodeSuivante, annulerDerniereAction, messageErreur } from "../api";
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
import { ModalReglesMatch } from "./match-live/ModalReglesMatch";
import { DerouleMatch, decrireAction } from "./match-live/DerouleMatch";
import { MatchForfait } from "./match-live/MatchForfait";

const ALTERNANCE = { neutre: "domicile", domicile: "exterieur", exterieur: "domicile" };

// Exécute une action et affiche le refus du serveur (match terminé, joueur exclu, plus de temps mort...)
const essayer = async (action) => {
  try {
    await action();
    return true;
  } catch (error) {
    alert(messageErreur(error, "Action impossible."));
    return false;
  }
};

function MatchLive() {
  const { user } = useAuth();
  const { id } = useParams();
  const { match, loading, chrono, loadMatch, patchMatch, actionMatch } = useMatchLive(id);

  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  // Action en attente du choix d'un joueur : { team, field, value, action }
  const [actionEnAttente, setActionEnAttente] = useState(null);
  const [statACorriger, setStatACorriger] = useState(null);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
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

  if (match.forfait) return <MatchForfait match={match} />;

  const isOwner = peutModifier(user, match.organisateur_id);
  const statistiques = match.statistiques || [];
  const homeStats = statistiques.filter((s) => s.equipe_nom === match.equipe_domicile_nom);
  const awayStats = statistiques.filter((s) => s.equipe_nom === match.equipe_exterieur_nom);
  const statParId = (statId) => statistiques.find((s) => s.id === statId) || null;

  const handleTimeout = (team) =>
    essayer(() => actionMatch(() => tempsMort(id, team === "home" ? "domicile" : "exterieur")));

  const ouvrirSelection = (team, field, value) => {
    setActionEnAttente({ team, field, value: Math.abs(value), action: isCorrectionMode ? "decrement" : "increment" });
  };

  const handlePlayerSelect = async (stat) => {
    const { field, value, action } = actionEnAttente;
    if (action === "increment" && estExclu(stat, match)) {
      alert("Ce joueur est exclu pour limite de fautes !");
      return;
    }
    await essayer(() => updateStatistique(id, stat.id, field, action, value));
    setActionEnAttente(null);
    loadMatch();
  };

  const handleConfirmCorrections = async (corrections) => {
    for (const [champ, delta] of Object.entries(corrections)) {
      if (delta !== 0) {
        const ok = await essayer(() =>
          updateStatistique(id, statACorriger.id, champ, delta > 0 ? "increment" : "decrement", Math.abs(delta)),
        );
        if (!ok) break;
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
      bonus: match.bonus_domicile,
      timeouts: match.temps_morts_domicile,
      stats: homeStats,
    },
    {
      team: "away",
      nom: match.equipe_exterieur_nom,
      score: match.score_exterieur,
      fautes: match.fautes_exterieur,
      bonus: match.bonus_exterieur,
      timeouts: match.temps_morts_exterieur,
      stats: awayStats,
    },
  ];

  const panneau = ({ team, nom, score, fautes, bonus, timeouts }) => (
    <PanneauEquipe
      match={match}
      nom={nom}
      score={score}
      fautes={fautes}
      bonus={bonus}
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
          <div className="flex flex-wrap gap-4">
            <a
              href={`/match/${id}/ecran`}
              target="_blank"
              rel="noreferrer"
              title="Ouvre le tableau de marque en grand, pour une télé ou un projecteur"
              className="text-gray-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
            >
              📺 Écran de salle
            </a>
            <Link
              to={`/match/${id}/feuille`}
              className="text-gray-400 hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
            >
              📄 Feuille de match
            </Link>
            <Link
              to={`/tournoi/${match.tournoi_slug}`}
              className="text-primary-orange hover:text-white transition-colors font-bold text-xs uppercase tracking-widest"
            >
              Tableau du Tournoi 🏆
            </Link>
          </div>
        </div>

        {!isOwner && (
          <p className="mb-6 no-print flex items-center gap-2 text-[11px] text-gray-500 border-l-2 border-blue-500/40 pl-3 py-0.5">
            <span className="truncate">
              Lecture seule · tournoi de{" "}
              <span className="text-gray-300 font-bold">{match.organisateur_nom || "l'organisateur"}</span>
            </span>
          </p>
        )}

        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-4 sm:p-8 mb-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
              <div className="hidden lg:block w-12" aria-hidden="true" />

              <TableauChrono
                match={match}
                chrono={chrono}
                isOwner={isOwner}
                onToggleChrono={() => essayer(() => patchMatch({ chrono_en_cours: !match.chrono_en_cours }))}
                onResetShotClock={(secondes) => essayer(() => patchMatch({ shot_clock_secondes: secondes }))}
                onTogglePossession={() =>
                  essayer(() => patchMatch({ possession_fleche: ALTERNANCE[match.possession_fleche || "neutre"] }))
                }
                onResetChrono={() =>
                  essayer(() => patchMatch({ temps_restant_secondes: match.duree_periode_secondes, chrono_en_cours: false }))
                }
                onNextPeriode={() => essayer(() => actionMatch(() => periodeSuivante(id)))}
              />

              <MvpLive mvp={meilleurJoueur(statistiques)} />

              <div className="flex gap-4 items-center">
                {isOwner && match.derniere_action && match.statut !== "termine" && (
                  <button
                    onClick={() => essayer(() => actionMatch(() => annulerDerniereAction(id)))}
                    title="Annuler la dernière action"
                    className="flex flex-col items-center justify-center p-3 rounded-xl border-2 bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-primary-orange transition-all max-w-[9rem]"
                  >
                    <span className="text-xl">↩</span>
                    <span className="text-[8px] font-black uppercase mt-1 text-center leading-tight">
                      Annuler {decrireAction(match.derniere_action, match.reglement.nb_periodes)}
                      {match.derniere_action.joueur_libelle && ` · ${match.derniere_action.joueur_libelle}`}
                    </span>
                  </button>
                )}
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
                {isOwner && (
                  <button
                    onClick={() => setReglagesOuverts(true)}
                    title="Réglages du match"
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                  >
                    <span className="text-2xl">⚙️</span>
                  </button>
                )}
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

          <DerouleMatch match={match} />
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

        {reglagesOuverts && (
          <ModalReglesMatch
            match={match}
            onEnregistrer={(reglement) => essayer(() => patchMatch({ reglement }))}
            onFermer={() => setReglagesOuverts(false)}
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
