import React, { useState } from "react";
import { departagerQualification, messageErreur } from "../../api";
import { deplacer } from "./phases";

const LIBELLES_DECISION = {
  organisateur: "Ordre choisi par l'organisateur.",
  tirage: "Résultat du tirage au sort, définitif.",
};

// Égalité que les critères FIBA ne tranchent pas : l'organisateur fixe l'ordre, ou le serveur tire au sort
export function EgaliteQualification({ slug, egalite, onDecision }) {
  const [equipes, setEquipes] = useState(egalite.equipes);
  const [enCours, setEnCours] = useState(false);
  const { decision, places_qualificatives: places, premiere_place: premierePlace } = egalite;
  const definitif = decision?.mode === "tirage";

  const envoyer = async (donnees, confirmation) => {
    if (!window.confirm(confirmation)) return;
    setEnCours(true);
    try {
      await departagerQualification(slug, donnees);
      onDecision();
    } catch (erreur) {
      alert(messageErreur(erreur, "Décision impossible."));
      setEnCours(false);
    }
  };

  const boutonOrdre = (index, decalage, symbole, libelle) => (
    <button
      type="button"
      onClick={() => setEquipes(deplacer(equipes, index, decalage))}
      disabled={enCours || index + decalage < 0 || index + decalage >= equipes.length}
      aria-label={libelle}
      className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-black disabled:opacity-20"
    >
      {symbole}
    </button>
  );

  return (
    <div className="text-left bg-black/20 border border-white/10 rounded-2xl p-4 sm:p-5 mb-6">
      <h4 className="text-sm font-black uppercase tracking-wider text-white mb-1">Égalité parfaite</h4>
      <p className="text-xs text-gray-400 mb-4">
        {decision
          ? LIBELLES_DECISION[decision.mode]
          : `Aucun critère ne sépare ces équipes pour ${places > 1 ? `${places} places qualificatives` : "la dernière place qualificative"}. Fixe l'ordre ou lance un tirage au sort.`}
      </p>
      <ol className="space-y-2 mb-4">
        {equipes.map((equipe, index) => (
          <li key={equipe.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
            <span className="w-6 text-center font-black text-primary-orange">{premierePlace + index}</span>
            <span className="flex-1 min-w-0 truncate font-bold text-white">{equipe.nom}</span>
            <span className={`text-[10px] font-black uppercase ${index < places ? "text-green-400" : "text-gray-500"}`}>
              {index < places ? "Qualifiée" : "Éliminée"}
            </span>
            {!definitif && (
              <span className="flex gap-1">
                {boutonOrdre(index, -1, "↑", `Monter ${equipe.nom}`)}
                {boutonOrdre(index, 1, "↓", `Descendre ${equipe.nom}`)}
              </span>
            )}
          </li>
        ))}
      </ol>
      {!definitif && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() =>
              envoyer({ ordre: equipes.map((e) => e.id) }, "Valider cet ordre pour les équipes à égalité ?")
            }
            disabled={enCours}
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            Valider cet ordre
          </button>
          <button
            onClick={() => envoyer({ tirage: true }, "Lancer le tirage au sort ? Son résultat sera définitif.")}
            disabled={enCours}
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            Tirage au sort
          </button>
        </div>
      )}
    </div>
  );
}
