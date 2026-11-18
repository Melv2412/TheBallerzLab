import React, { useEffect, useRef, useState } from "react";
import { enregistrerPresences, getPresences, messageErreur } from "../../api";
import { basculer, idsPresents, parEquipe } from "../feuille/presences";

// Joueurs sans aucune stat : l'organisateur coche ceux qui sont entrés sur le terrain.
// `automatique` : ouverte à la fin du match, elle ne s'affiche que s'il y a quelqu'un à confirmer.
export function ModalPresences({ matchId, automatique = false, onFermer }) {
  const [joueurs, setJoueurs] = useState(null);
  const [presents, setPresents] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;

  useEffect(() => {
    let actif = true;
    getPresences(matchId)
      .then(({ data }) => {
        if (!actif) return;
        if (automatique && data.length === 0) {
          fermerRef.current();
          return;
        }
        setJoueurs(data);
        setPresents(idsPresents(data));
      })
      .catch((e) => {
        if (actif) setErreur(messageErreur(e, "Impossible de charger les présences."));
      });
    return () => {
      actif = false;
    };
  }, [matchId, automatique]);

  if (automatique && !joueurs && !erreur) return null;

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      await enregistrerPresences(matchId, presents);
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err, "Les présences n'ont pas pu être enregistrées."));
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <form
        onSubmit={enregistrer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-presences"
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h3 id="titre-presences" className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">
          Qui a joué ?
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Ces joueurs n'ont aucune stat sur ce match. Coche ceux qui sont entrés sur le terrain : les autres ne seront
          pas comptés comme ayant joué.
        </p>

        {!joueurs && !erreur && <p className="text-gray-400 animate-pulse">Chargement...</p>}
        {joueurs?.length === 0 && <p className="text-gray-400">Tous les joueurs de ce match ont au moins une stat.</p>}

        {joueurs &&
          parEquipe(joueurs).map((equipe) => (
            <fieldset key={equipe.id} className="mb-5">
              <legend className="text-xs font-black uppercase tracking-widest text-primary-orange mb-2">{equipe.nom}</legend>
              <div className="space-y-1">
                {equipe.joueurs.map((joueur) => (
                  <label
                    key={joueur.joueur}
                    className="flex items-center gap-3 min-h-11 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={presents.includes(joueur.joueur)}
                      onChange={() => setPresents((ids) => basculer(ids, joueur.joueur))}
                      className="w-5 h-5 accent-primary-orange"
                    />
                    <span className="text-white font-bold">
                      #{joueur.numero} {joueur.nom}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

        {erreur && <p className="text-red-400 font-bold mb-4">{erreur}</p>}

        <div className="flex gap-4 mt-6">
          {joueurs?.length > 0 && (
            <button type="submit" disabled={envoi} className="btn-basketball flex-1 py-4 disabled:opacity-50">
              {envoi ? "Enregistrement..." : "Enregistrer"}
            </button>
          )}
          <button
            type="button"
            onClick={onFermer}
            className="bg-white/10 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs"
          >
            {automatique ? "Plus tard" : "Fermer"}
          </button>
        </div>
      </form>
    </div>
  );
}
