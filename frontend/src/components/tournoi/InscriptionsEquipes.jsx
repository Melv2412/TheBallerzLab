import React, { useCallback, useEffect, useState } from "react";
import { accepterDemande, getDemandesEquipes, lienInscription, messageErreur, refuserDemande } from "../../api";

const BOUTON = "py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all";

// Organisateur : lien d'inscription du tournoi (un seul pour toutes les équipes) et demandes à valider
export function InscriptionsEquipes({ tournoi, onRecharger }) {
  const [code, setCode] = useState(tournoi.code_inscription);
  const [demandes, setDemandes] = useState([]);
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState(false);

  const chargerDemandes = useCallback(
    () =>
      getDemandesEquipes(tournoi.slug)
        .then(({ data }) => setDemandes(data))
        .catch(() => setDemandes([])),
    [tournoi.slug],
  );

  useEffect(() => {
    chargerDemandes();
  }, [chargerDemandes]);

  useEffect(() => setCode(tournoi.code_inscription), [tournoi.code_inscription]);

  const changerLien = async (options, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return;
    try {
      const { data } = await lienInscription(tournoi.slug, options);
      setCode(data.code);
      setMessage(options.regenerer ? "Nouveau lien créé : l'ancien ne marche plus." : options.desactiver ? "Lien désactivé." : "");
    } catch (error) {
      setMessage(messageErreur(error, "Impossible de modifier le lien."));
    }
  };

  const url = code ? `${window.location.origin}/inscription/${code}` : "";
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié : envoie-le aux capitaines.");
    } catch {
      setMessage("Copie impossible : sélectionne le lien à la main.");
    }
  };

  const traiter = async (demande, accepter) => {
    if (!accepter && !window.confirm(`Refuser l'équipe « ${demande.nom} » ?`)) return;
    setOccupe(true);
    try {
      await (accepter ? accepterDemande(demande.id) : refuserDemande(demande.id));
      await chargerDemandes();
      if (accepter) onRecharger();
    } catch (error) {
      window.alert(messageErreur(error));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="glass-card p-4 mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-300">
          <span className="font-black text-white">Lien d'inscription des équipes.</span>{" "}
          Un seul lien pour tous les capitaines : ils proposent leur équipe, tu valides, puis ils reçoivent le lien de leur équipe.
        </p>
        {!code && (
          <button
            onClick={() => changerLien({})}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary-orange/10 text-primary-orange hover:bg-primary-orange hover:text-white text-xs font-black uppercase tracking-widest transition-all"
          >
            🔗 Créer le lien
          </button>
        )}
      </div>

      {code && (
        <div className="space-y-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            aria-label="Lien d'inscription des équipes"
            className="w-full bg-black/30 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={copier} className={`${BOUTON} bg-primary-orange text-white`}>
              Copier
            </button>
            <button
              onClick={() => changerLien({ regenerer: true }, "Créer un nouveau lien ? L'ancien ne marchera plus.")}
              className={`${BOUTON} bg-white/10 text-gray-300 hover:bg-white/20`}
            >
              Nouveau lien
            </button>
            <button
              onClick={() => changerLien({ desactiver: true }, "Désactiver le lien ? Plus aucun capitaine ne pourra inscrire d'équipe avec.")}
              className={`${BOUTON} bg-white/10 text-gray-300 hover:bg-white/20`}
            >
              Désactiver
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-[11px] text-gray-400">{message}</p>}

      {demandes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary-orange">
            Équipes en attente de validation ({demandes.length})
          </h3>
          <ul className="space-y-2">
            {demandes.map((demande) => (
              <li key={demande.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-3">
                <span className="min-w-0">
                  <span className="font-black uppercase break-words">{demande.nom}</span>
                  <span className="block text-[11px] text-gray-400">capitaine : {demande.capitaine}</span>
                </span>
                <span className="flex gap-2 shrink-0">
                  <button
                    onClick={() => traiter(demande, true)}
                    disabled={occupe}
                    className={`${BOUTON} bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white`}
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => traiter(demande, false)}
                    disabled={occupe}
                    className={`${BOUTON} bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white`}
                  >
                    Refuser
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
