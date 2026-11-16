import React, { useState } from "react";
import { FormulaireReglement } from "../reglement/FormulaireReglement";
import { usePresets } from "../reglement/presets";

// Réglages de ce match uniquement : tout avant le coup d'envoi, une partie pendant, rien une fois terminé
export function ModalReglesMatch({ match, onEnregistrer, onFermer }) {
  const donnees = usePresets();
  const [reglement, setReglement] = useState(match.reglement);
  const [enregistrement, setEnregistrement] = useState(false);

  const termine = match.statut === "termine";
  const modifiables = termine ? [] : match.a_commence ? donnees?.modifiables_en_cours : undefined;

  const enregistrer = async (e) => {
    e.preventDefault();
    // N'envoyer que ce qui change : pendant le match, le serveur refuse les autres réglages
    const modifications = Object.fromEntries(
      Object.entries(reglement).filter(([cle, valeur]) => match.reglement[cle] !== valeur),
    );
    if (Object.keys(modifications).length === 0) return onFermer();
    setEnregistrement(true);
    try {
      // onEnregistrer renvoie false si le serveur a refusé : on garde la fenêtre ouverte
      if ((await onEnregistrer(modifications)) !== false) onFermer();
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <form
        onSubmit={enregistrer}
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">Réglages du match</h3>
        <p className="text-xs text-gray-500 mb-6">
          {termine
            ? "Match terminé : les réglages ne peuvent plus changer."
            : match.a_commence
              ? "Match commencé : seuls le shot clock, la durée des périodes et les temps morts peuvent encore changer."
              : "Ces réglages ne concernent que ce match (le règlement du tournoi ne change pas)."}
        </p>
        <FormulaireReglement
          reglement={reglement}
          donnees={donnees}
          modifiables={modifiables}
          avecClassement={false}
          onChange={setReglement}
        />
        <div className="flex gap-4 mt-6">
          {!termine && (
            <button type="submit" disabled={enregistrement} className="btn-basketball flex-1 py-4 disabled:opacity-50">
              Appliquer
            </button>
          )}
          <button
            type="button"
            onClick={onFermer}
            className="bg-white/10 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs"
          >
            Fermer
          </button>
        </div>
      </form>
    </div>
  );
}
