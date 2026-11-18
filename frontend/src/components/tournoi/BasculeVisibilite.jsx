import React from "react";

// Interrupteur Public / Privé d'une carte de tournoi (affiché à son organisateur uniquement)
export function BasculeVisibilite({ tournoi, enCours, onBascule }) {
  const prive = Boolean(tournoi.prive);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prive}
      aria-label={`Tournoi ${tournoi.nom} privé`}
      disabled={enCours}
      onClick={() => onBascule(tournoi)}
      className="flex items-center gap-2 w-fit text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors disabled:opacity-50"
    >
      <span className={`relative w-8 h-4 rounded-full transition-colors ${prive ? "bg-primary-orange" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${prive ? "translate-x-4" : ""}`} />
      </span>
      {prive ? "Privé" : "Public"}
    </button>
  );
}

export const confirmationPriveRequise = (tournoi) =>
  !tournoi.prive && (tournoi.equipes_count > 0 || tournoi.matchs_count > 0);

export function ModalPasserPrive({ tournoi, enCours, onAnnuler, onConfirmer }) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-passer-prive"
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h2 id="titre-passer-prive" className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">
          Passer en privé
        </h2>
        <p className="text-primary-orange font-bold mb-4 break-words">{tournoi.nom}</p>
        <p className="text-sm text-gray-300 mb-6">
          Les joueurs et le public perdront l'accès au tournoi, y compris aux matchs en direct, et ses stats
          disparaîtront des profils des joueurs. Les liens d'invitation resteront actifs. Tu pourras le repasser en
          public à tout moment.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onAnnuler} className="bg-white/10 text-white flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs">
            Annuler
          </button>
          <button type="button" onClick={onConfirmer} disabled={enCours} className="btn-basketball flex-1 py-4 disabled:opacity-50">
            {enCours ? "Envoi…" : "Passer en privé"}
          </button>
        </div>
      </div>
    </div>
  );
}
