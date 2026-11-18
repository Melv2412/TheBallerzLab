import React, { useState } from "react";
import { messageErreur, restaurerTournoi } from "../../api";
import { ModalSuppressionTournoi } from "./ModalSuppressionTournoi";
import { texteJoursRestants } from "./suppression";

// Tournois supprimés : restaurables jusqu'à leur effacement automatique
export function ModalCorbeille({ tournois, onFermer, onChange }) {
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState("");
  const [aEffacer, setAEffacer] = useState(null);

  const restaurer = async (slug) => {
    setEnCours(slug);
    setErreur("");
    try {
      await restaurerTournoi(slug);
      await onChange();
    } catch (err) {
      setErreur(messageErreur(err, "La restauration a échoué."));
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-corbeille"
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 id="titre-corbeille" className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">Corbeille</h2>
        <p className="text-sm text-gray-400 mb-5">Ces tournois sont invisibles. Restaure-les avant leur effacement.</p>

        {erreur && <p role="alert" className="text-sm text-red-400 mb-4">{erreur}</p>}

        {tournois.length === 0 ? (
          <p className="text-gray-400 text-sm mb-5">La corbeille est vide.</p>
        ) : (
          <ul className="space-y-3 mb-5">
            {tournois.map((tournoi) => (
              <li key={tournoi.slug} className="bg-white/5 border border-white/5 rounded-xl p-4">
                <p className="font-black text-white break-words">{tournoi.nom}</p>
                <p className="text-xs text-gray-400 mb-3">{texteJoursRestants(tournoi.jours_restants)}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-widest">
                  <button type="button" onClick={() => restaurer(tournoi.slug)} disabled={enCours !== null} className="text-primary-orange hover:underline disabled:opacity-50">
                    {enCours === tournoi.slug ? "Restauration…" : "Restaurer"}
                  </button>
                  <button type="button" onClick={() => setAEffacer(tournoi)} disabled={enCours !== null} className="text-red-400 hover:underline disabled:opacity-50">
                    Supprimer définitivement
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button type="button" onClick={onFermer} className="bg-white/10 text-white w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs">
          Fermer
        </button>
      </div>

      {aEffacer && (
        <ModalSuppressionTournoi
          tournoi={aEffacer}
          definitive
          onFermer={() => setAEffacer(null)}
          onSupprime={async () => {
            setAEffacer(null);
            await onChange();
          }}
        />
      )}
    </div>
  );
}
