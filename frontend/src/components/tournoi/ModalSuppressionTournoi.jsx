import React, { useEffect, useState } from "react";
import { deleteTournoi, getApercuSuppression, messageErreur, supprimerDefinitivement } from "../../api";
import { consequenceSuppression, lignesPertes, nomConfirme } from "./suppression";

// Confirmation renforcée : on voit ce qui sera perdu et on retape le nom du tournoi.
// `definitive` : le tournoi est déjà dans la corbeille, son aperçu est fourni avec lui.
export function ModalSuppressionTournoi({ tournoi, definitive = false, onFermer, onSupprime }) {
  const [apercu, setApercu] = useState(definitive ? tournoi.apercu : null);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (definitive) return undefined;
    let actif = true;
    getApercuSuppression(tournoi.slug)
      .then(({ data }) => actif && setApercu(data))
      .catch((err) => actif && setErreur(messageErreur(err, "Impossible de préparer la suppression.")));
    return () => {
      actif = false;
    };
  }, [definitive, tournoi.slug]);

  const confirmer = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    try {
      await (definitive ? supprimerDefinitivement : deleteTournoi)(tournoi.slug, saisie);
      onSupprime();
    } catch (err) {
      setErreur(messageErreur(err, "La suppression a échoué."));
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[70] p-4">
      <form
        onSubmit={confirmer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-suppression-tournoi"
        className="bg-[#1a1a1b] border-2 border-red-500/40 rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 id="titre-suppression-tournoi" className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">
          Supprimer le tournoi
        </h2>
        <p className="text-primary-orange font-bold mb-5 break-words">{tournoi.nom}</p>

        {apercu ? (
          <>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sera perdu</p>
            <ul className="grid grid-cols-2 gap-2 mb-4">
              {lignesPertes(apercu).map((ligne) => (
                <li key={ligne} className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-sm font-bold text-gray-200">
                  {ligne}
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-300 mb-5">{consequenceSuppression(apercu, definitive)}</p>
          </>
        ) : (
          !erreur && <p className="text-sm text-gray-400 animate-pulse mb-5">Calcul de ce qui sera perdu…</p>
        )}

        <label htmlFor="confirmation-suppression" className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
          Retape le nom du tournoi pour confirmer
        </label>
        <input
          id="confirmation-suppression"
          type="text"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          autoComplete="off"
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-red-500/60 mb-4"
        />

        {erreur && <p role="alert" className="text-sm text-red-400 mb-4">{erreur}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onFermer} className="bg-white/10 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!apercu || envoi || !nomConfirme(saisie, tournoi.nom)}
            className="bg-red-600 hover:bg-red-500 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-40 disabled:hover:bg-red-600"
          >
            {envoi ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </form>
    </div>
  );
}
