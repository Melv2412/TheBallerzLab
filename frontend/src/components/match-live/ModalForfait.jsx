import React, { useState } from "react";
import { annulerForfait, declarerForfait, messageErreur } from "../../api";
import { choixForfait, erreurForfait, valeursForfait } from "./forfait";

const champScore = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none";

// Déclare, corrige ou annule le forfait d'un match
export function ModalForfait({ match, onFermer, onEnregistre }) {
  const [valeurs, setValeurs] = useState(() => valeursForfait(match));
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const changer = (champ, valeur) => setValeurs((actuelles) => ({ ...actuelles, [champ]: valeur }));

  const envoyer = async (action, defaut) => {
    setErreur("");
    setEnvoi(true);
    try {
      await action();
      onEnregistre();
    } catch (err) {
      setErreur(messageErreur(err, defaut));
      setEnvoi(false);
    }
  };

  const declarer = (e) => {
    e.preventDefault();
    const probleme = erreurForfait(valeurs);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    envoyer(
      () =>
        declarerForfait(match.id, {
          equipe: valeurs.equipe,
          ...(valeurs.equipe === "double"
            ? {}
            : { score_vainqueur: Number(valeurs.vainqueur), score_perdant: Number(valeurs.perdant) }),
        }),
      "Le forfait n'a pas pu être enregistré.",
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <form
        onSubmit={declarer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-forfait"
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h3 id="titre-forfait" className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">
          Forfait
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Le résultat compte pour le tournoi, pas pour les stats des joueurs. Les stats déjà saisies sont gardées et
          reviennent si le forfait est annulé.
        </p>

        <fieldset className="mb-5">
          <legend className="text-xs font-black uppercase tracking-widest text-primary-orange mb-2">
            Équipe forfait
          </legend>
          <div className="space-y-1">
            {choixForfait(match).map((choix) => (
              <label
                key={choix.valeur}
                className="flex items-center gap-3 min-h-11 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                <input
                  type="radio"
                  name="equipe-forfait"
                  checked={valeurs.equipe === choix.valeur}
                  onChange={() => changer("equipe", choix.valeur)}
                  className="w-5 h-5 accent-primary-orange"
                />
                <span className="text-white font-bold break-words min-w-0">{choix.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {valeurs.equipe !== "double" && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <label className="text-xs font-bold text-gray-400">
              Score du vainqueur
              <input
                type="number"
                min="1"
                max="200"
                value={valeurs.vainqueur}
                onChange={(e) => changer("vainqueur", e.target.value)}
                className={`${champScore} mt-1`}
              />
            </label>
            <label className="text-xs font-bold text-gray-400">
              Score de l'équipe forfait
              <input
                type="number"
                min="0"
                max="200"
                value={valeurs.perdant}
                onChange={(e) => changer("perdant", e.target.value)}
                className={`${champScore} mt-1`}
              />
            </label>
          </div>
        )}

        {erreur && <p className="text-red-400 font-bold mb-4">{erreur}</p>}

        <div className="flex gap-4 mt-6">
          <button type="submit" disabled={envoi} className="btn-basketball flex-1 py-4 disabled:opacity-50">
            {envoi ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={onFermer}
            className="bg-white/10 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs"
          >
            Fermer
          </button>
        </div>
        {match.forfait && (
          <button
            type="button"
            disabled={envoi}
            onClick={() => envoyer(() => annulerForfait(match.id), "Le forfait n'a pas pu être annulé.")}
            className="w-full mt-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 font-black uppercase tracking-widest text-xs disabled:opacity-50"
          >
            Annuler le forfait
          </button>
        )}
      </form>
    </div>
  );
}
