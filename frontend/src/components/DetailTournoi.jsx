import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  declarerForfaitGeneral,
  deleteEquipe,
  deleteJoueur,
  deleteMatch,
  messageErreur,
  reintegrerJoueur,
  retirerJoueur,
  rouvrirTournoi,
} from "../api";
import { useAuth } from "../AuthContext";
import { peutEditer, peutModifier } from "../permissions";
import { useTournoi } from "./tournoi/useTournoi";
import { OngletClassement } from "./tournoi/OngletClassement";
import { OngletCalendrier } from "./tournoi/OngletCalendrier";
import { OngletEquipes } from "./tournoi/OngletEquipes";
import { OngletPhaseFinale } from "./tournoi/OngletPhaseFinale";
import { OngletParametres } from "./tournoi/OngletParametres";
import { ModalEquipe, ModalJoueur, ModalMatch } from "./tournoi/Modales";
import { BandeauCloture, ModalCloture } from "./tournoi/ClotureTournoi";
import { RappelMatchsOublies } from "./tournoi/RappelMatchsOublies";

function DetailTournoi() {
  const { user } = useAuth();
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState("classement");
  const [typeClassement, setTypeClassement] = useState("poule");
  // Modale ouverte : { type: "equipe", equipe } | { type: "joueur", equipeId, joueur } | { type: "match", phase } | { type: "cloture" }
  const [modale, setModale] = useState(null);

  const { tournoi, equipes, matchs, joueursParEquipe, classement, tournamentMVP, loading, recharger } = useTournoi(
    slug,
    typeClassement,
  );

  const isOwner = Boolean(tournoi) && peutEditer(user, tournoi.organisateur, tournoi.cloture_le);

  const apresConfirmation = (message, action) => async (id) => {
    if (!window.confirm(message)) return;
    try {
      await action(id);
      recharger();
    } catch (error) {
      window.alert(messageErreur(error, "Action impossible."));
    }
  };
  const supprimerEquipe = apresConfirmation("Supprimer cette équipe ?", deleteEquipe);
  const supprimerJoueur = apresConfirmation("Supprimer ce joueur ?", deleteJoueur);
  const supprimerMatch = apresConfirmation("Supprimer ce match ?", deleteMatch);
  const retirer = apresConfirmation(
    "Retirer ce joueur de l'effectif ? Ses stats restent dans les matchs déjà joués.",
    retirerJoueur,
  );
  const reintegrer = apresConfirmation("Remettre ce joueur dans l'effectif ?", reintegrerJoueur);
  const forfaitGeneral = (equipe) =>
    apresConfirmation(
      `Déclarer ${equipe.nom} forfait général ? Tous ses matchs restants seront perdus par forfait (20-0).`,
      declarerForfaitGeneral,
    )(equipe.id);

  const apresEnregistrement = () => {
    setModale(null);
    recharger();
  };

  const apresCloture = () => {
    setActiveTab("classement"); // l'onglet Paramètres disparaît
    apresEnregistrement();
  };

  const rouvrir = async () => {
    if (!window.confirm("Rouvrir ce tournoi ? Son organisateur pourra de nouveau le modifier.")) return;
    try {
      await rouvrirTournoi(tournoi.slug);
      recharger();
    } catch (error) {
      window.alert(messageErreur(error, "Réouverture impossible."));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="text-6xl mb-4">🏀</div>
        <div className="text-xl athletic-font text-primary-orange">Analyse des tactiques...</div>
      </div>
    );
  }

  if (!tournoi) {
    return (
      <div className="glass-card p-20 text-center">
        <h2 className="text-3xl font-black italic">Tournoi Non Trouvé</h2>
        <Link to="/" className="text-primary-orange mt-4 inline-block font-bold underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const onglets = [
    { id: "classement", label: "Classement" },
    { id: "matchs", label: "Calendrier" },
    { id: "rosters", label: "Équipes" },
    { id: "brackets", label: "Phase Finale" },
    ...(isOwner ? [{ id: "settings", label: "Paramètres" }] : []),
  ];

  const boutonTypeClassement = (type, label) => (
    <button
      onClick={() => setTypeClassement(type)}
      className={`px-3 sm:px-6 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all ${typeClassement === type ? "bg-primary-orange text-white border-2 border-primary-orange" : "bg-white/5 text-gray-400 hover:text-white border-2 border-white/10"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-fade-in pb-20 relative">
      {/* Image de fond équipe officielle avec transparence */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-7 pointer-events-none z-0"
        style={{
          backgroundImage: "url(/images/backgrounds/team-official.jpg)",
          filter: "grayscale(30%) brightness(0.7)",
          backgroundPosition: "center 40%",
        }}
      />

      {/* Overlay gradient pour meilleure lisibilité */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/75 pointer-events-none z-0" />

      <div className="relative z-10">
        {tournoi.cloture_le && (
          <BandeauCloture tournoi={tournoi} peutRouvrir={Boolean(user?.is_staff)} onRouvrir={rouvrir} />
        )}

        {!isOwner && !tournoi.cloture_le && (
          <p className="mb-4 no-print flex items-center gap-2 text-[11px] text-gray-500 border-l-2 border-blue-500/40 pl-3 py-0.5">
            <span className="truncate">
              Lecture seule · tournoi de{" "}
              <span className="text-gray-300 font-bold">{tournoi.organisateur_nom || "l'organisateur"}</span>
            </span>
          </p>
        )}

        {/* En-tête */}
        <div className="mb-10 no-print">
          <Link
            to="/"
            className="text-gray-400 hover:text-white transition-colors mb-4 inline-block font-bold text-xs uppercase tracking-widest"
          >
            ← Retour aux championnats
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="card-title-accent min-w-0 max-w-full">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tighter text-white uppercase break-words">
                {tournoi.nom}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                <span className="bg-primary-orange text-white px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase">
                  Live Report
                </span>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest italic">
                  {new Date(tournoi.date_debut).toLocaleDateString("fr-FR")} —{" "}
                  {new Date(tournoi.date_fin).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase text-xs tracking-widest flex items-center gap-2"
              >
                Rapport PDF
              </button>
              {isOwner && (
                <>
                  <button onClick={() => setModale({ type: "equipe", equipe: null })} className="btn-basketball text-xs">
                    + Équipe
                  </button>
                  <button onClick={() => setModale({ type: "match", phase: "poule" })} className="btn-basketball">
                    + Nouveau Match
                  </button>
                  <button
                    onClick={() => setModale({ type: "cloture" })}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase text-xs tracking-widest"
                  >
                    Clôturer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {isOwner && <RappelMatchsOublies matchs={matchs} />}

        {/* Onglets */}
        <div className="flex gap-4 mb-8 border-b border-white/5 no-print overflow-x-auto sans-barre -mx-4 px-4 sm:mx-0 sm:px-0">
          {onglets.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-2 font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id ? "text-primary-orange border-primary-orange" : "text-gray-500 border-transparent hover:text-white"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "classement" && (
          <div className="grid grid-cols-2 sm:flex gap-3 sm:gap-4 mb-6 no-print">
            {boutonTypeClassement("poule", "Saison Régulière (Poules)")}
            {boutonTypeClassement("elimination", "Phases Éliminatoires")}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {activeTab === "classement" && (
            <OngletClassement
              classement={classement}
              tournamentMVP={tournamentMVP}
              equipes={equipes}
              type={typeClassement}
              slug={tournoi.slug}
              matchs={matchs}
            />
          )}
        </div>

        {activeTab === "rosters" && (
          <OngletEquipes
            tournoi={tournoi}
            onRecharger={recharger}
            equipes={equipes}
            matchs={matchs}
            joueursParEquipe={joueursParEquipe}
            isOwner={isOwner}
            peutDelier={peutModifier(user, tournoi.organisateur)}
            onNouvelleEquipe={() => setModale({ type: "equipe", equipe: null })}
            onEditerEquipe={(equipe) => setModale({ type: "equipe", equipe })}
            onSupprimerEquipe={supprimerEquipe}
            onNouveauJoueur={(equipeId) => setModale({ type: "joueur", equipeId, joueur: null })}
            onEditerJoueur={(joueur, equipeId) => setModale({ type: "joueur", equipeId, joueur })}
            onSupprimerJoueur={supprimerJoueur}
            onRetirerJoueur={retirer}
            onReintegrerJoueur={reintegrer}
            onForfaitGeneral={forfaitGeneral}
          />
        )}

        {activeTab === "matchs" && (
          <OngletCalendrier matchs={matchs} equipes={equipes} isOwner={isOwner} onSupprimerMatch={supprimerMatch} />
        )}

        {activeTab === "brackets" && (
          <OngletPhaseFinale
            tournoi={tournoi}
            matchs={matchs}
            equipes={equipes}
            isOwner={isOwner}
            onCreerMatch={(phase) => setModale({ type: "match", phase })}
            onSupprimerMatch={supprimerMatch}
            recharger={recharger}
          />
        )}

        {activeTab === "settings" && isOwner && (
          <OngletParametres tournoi={tournoi} matchs={matchs} recharger={recharger} />
        )}

        {modale?.type === "cloture" && (
          <ModalCloture tournoi={tournoi} matchs={matchs} onFermer={() => setModale(null)} onCloture={apresCloture} />
        )}
        {modale?.type === "equipe" && (
          <ModalEquipe
            tournoi={tournoi}
            equipe={modale.equipe}
            onFermer={() => setModale(null)}
            onEnregistre={apresEnregistrement}
          />
        )}
        {modale?.type === "joueur" && (
          <ModalJoueur
            equipeId={modale.equipeId}
            joueur={modale.joueur}
            onFermer={() => setModale(null)}
            onEnregistre={apresEnregistrement}
          />
        )}
        {modale?.type === "match" && (
          <ModalMatch
            tournoi={tournoi}
            equipes={equipes}
            phaseInitiale={modale.phase}
            onFermer={() => setModale(null)}
            onEnregistre={apresEnregistrement}
          />
        )}
      </div>
    </div>
  );
}

export default DetailTournoi;
