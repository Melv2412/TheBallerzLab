import React, { useState } from "react";
import { useRetours } from "../retours/contexte";
import { QrCode, qrEnPng } from "./QrCode";
import { lienAbsolu, nomFichier, partagerFichier, partagerLien } from "./partage";

const MESSAGES = {
  partage: null,
  annule: null,
  copie: "Lien copié.",
  telecharge: "Image téléchargée.",
  echec: "Copie impossible : sélectionne le lien à la main.",
};

const BOUTON =
  "py-3 rounded-xl font-black uppercase tracking-widest text-[11px] bg-white/10 hover:bg-white/15 text-white transition-all disabled:opacity-40";

// Lien + QR code d'une page publique (direct d'un match, tournoi), avec options de partage.
// `image` : fabrique facultative d'une image à partager (résultat du match)
export function ModalPartage({ titre, texte, chemin, prive, image, onFermer }) {
  const retours = useRetours();
  const [occupe, setOccupe] = useState(false);
  const url = lienAbsolu(chemin);

  const signaler = (resultat) => {
    if (MESSAGES[resultat]) (resultat === "echec" ? retours.erreur : retours.succes)(MESSAGES[resultat]);
  };

  const executer = async (action) => {
    setOccupe(true);
    try {
      signaler(await action());
    } catch {
      retours.erreur("Le partage a échoué.");
    } finally {
      setOccupe(false);
    }
  };

  const partagerImage = (fabrique, nom) =>
    executer(async () => partagerFichier(new File([await fabrique()], nomFichier(nom, "png"), { type: "image/png" }), titre));

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-partage"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 w-full max-w-sm max-h-[92vh] overflow-y-auto animate-fade-in"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="titre-partage" className="text-xl font-black italic uppercase tracking-tighter text-white break-words">
            {titre}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="text-gray-400 hover:text-white text-2xl leading-none">
            ×
          </button>
        </div>

        {prive && (
          <p className="mb-4 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
            Tournoi privé : ce lien ne s'ouvre que pour l'organisateur. Passe le tournoi en public pour le partager.
          </p>
        )}

        <QrCode url={url} titre={`QR code : ${titre}`} className="w-full max-w-[260px] mx-auto block p-2" />
        <p className="text-center text-[11px] text-gray-400 mt-2 mb-4">Scanne avec l'appareil photo du téléphone</p>

        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Lien"
          className="w-full bg-black/40 rounded-lg px-3 py-2 text-[11px] text-gray-300 font-mono mb-3"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={occupe}
            onClick={() => executer(() => partagerLien({ titre, texte, url }))}
            className="btn-basketball py-3 text-[11px] col-span-2"
          >
            Partager le lien
          </button>
          <button type="button" disabled={occupe} onClick={() => partagerImage(() => qrEnPng(url, titre), `qr-${titre}`)} className={BOUTON}>
            Image du QR
          </button>
          {image ? (
            <button type="button" disabled={occupe} onClick={() => partagerImage(image, `resultat-${titre}`)} className={BOUTON}>
              Image du résultat
            </button>
          ) : (
            <button type="button" disabled={occupe} onClick={() => window.open(url, "_blank", "noopener")} className={BOUTON}>
              Ouvrir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BoutonPartage({ className = "", libelle = "Partager", ...props }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={className}>
        {libelle}
      </button>
      {ouvert && <ModalPartage {...props} onFermer={() => setOuvert(false)} />}
    </>
  );
}
