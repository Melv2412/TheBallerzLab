import React, { useState } from "react";
import { cloturerTournoi, messageErreur } from "../../api";

export function BandeauCloture({ tournoi, peutRouvrir, onRouvrir }) {
  return (
    <div className="mb-6 no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
      <p className="text-sm text-gray-300">
        <span className="font-black text-white">Tournoi clôturé</span> le{" "}
        {new Date(tournoi.cloture_le).toLocaleDateString("fr-FR")}. Résultats en lecture seule.
      </p>
      {peutRouvrir && (
        <button
          onClick={onRouvrir}
          className="shrink-0 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest transition-all"
        >
          Rouvrir le tournoi
        </button>
      )}
    </div>
  );
}

export function ModalCloture({ tournoi, matchs, onFermer, onCloture }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const matchsEnCours = matchs.filter((m) => m.statut === "en_cours").length;
  const matchsAVenir = matchs.filter((m) => m.statut === "a_venir").length;

  const confirmer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await cloturerTournoi(tournoi.slug);
      onCloture();
    } catch (e) {
      setErreur(messageErreur(e, "Clôture impossible."));
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-cloture"
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 id="titre-cloture" className="text-2xl font-black italic uppercase text-white mb-4">
          Clôturer {tournoi.nom} ?
        </h2>
        <ul className="space-y-2 text-sm text-gray-300 mb-6">
          <li>Plus aucune équipe, aucun joueur, aucun match ni réglage ne pourra être modifié.</li>
          <li>Les résultats, le classement et les statistiques restent consultables.</li>
          <li>Seul un administrateur pourra rouvrir le tournoi.</li>
          {matchsAVenir > 0 && (
            <li className="text-primary-orange font-bold">
              {matchsAVenir} match{matchsAVenir > 1 ? "s" : ""} à venir ne {matchsAVenir > 1 ? "seront" : "sera"} jamais
              joué{matchsAVenir > 1 ? "s" : ""}.
            </li>
          )}
          {matchsEnCours > 0 && (
            <li className="text-red-400 font-bold">
              {matchsEnCours} match{matchsEnCours > 1 ? "s" : ""} en cours : termine-les avant de clôturer.
            </li>
          )}
        </ul>
        {erreur && <p className="text-sm text-red-400 font-bold mb-4">{erreur}</p>}
        <div className="flex gap-3">
          <button
            onClick={onFermer}
            className="bg-white/10 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs"
          >
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={enCours || matchsEnCours > 0}
            className="btn-basketball flex-1 py-4 disabled:opacity-50"
          >
            {enCours ? "Clôture..." : "Clôturer"}
          </button>
        </div>
      </div>
    </div>
  );
}
