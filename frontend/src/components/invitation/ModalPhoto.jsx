import React, { useRef } from "react";

// Avant de rejoindre l'équipe sans photo : la photo aide l'organisateur à reconnaître le joueur pendant la prise de stats
export function ModalPhoto({ onContinuerSans, onPhoto, onFermer }) {
  const champ = useRef(null);
  const choisir = (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (fichier) onPhoto(fichier);
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modal-photo"
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-md p-6 space-y-4 text-center animate-fade-in"
      >
        <p className="text-4xl" aria-hidden="true">📸</p>
        <h2 id="titre-modal-photo" className="text-xl font-black uppercase">Tu es sûr de continuer sans photo ?</h2>
        <p className="text-sm text-gray-300">
          La photo aide beaucoup pendant la prise de stats : l'organisateur te reconnaît tout de suite et ne se trompe
          pas de joueur. Tu pourras aussi l'ajouter plus tard depuis ton profil.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onContinuerSans}
            className="bg-white/5 border border-white/10 hover:bg-white/10 py-3 rounded-xl font-black uppercase text-xs"
          >
            Continuer sans
          </button>
          <button type="button" onClick={() => champ.current?.click()} className="btn-basketball py-3 text-xs">
            Choisir une photo
          </button>
        </div>
        <input ref={champ} type="file" accept="image/*" className="hidden" onChange={choisir} />
      </div>
    </div>
  );
}
