import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RetoursContext } from "./contexte";
import { DUREES_MS, ajouterNotification, retirerNotification } from "./file";

const STYLES = {
  succes: { bord: "border-green-500/50", icone: "✓", couleur: "text-green-400" },
  info: { bord: "border-primary-orange/50", icone: "i", couleur: "text-primary-orange" },
  erreur: { bord: "border-red-500/60", icone: "!", couleur: "text-red-400" },
};

function Notification({ notification, fermer }) {
  const style = STYLES[notification.type];
  const { id, type } = notification;
  const onFermer = () => fermer(id);
  useEffect(() => {
    const minuteur = setTimeout(() => fermer(id), DUREES_MS[type]);
    return () => clearTimeout(minuteur);
  }, [id, type, fermer]);
  return (
    <div
      role={notification.type === "erreur" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 bg-[#1a1a1b]/95 backdrop-blur border-2 ${style.bord} rounded-2xl px-4 py-3 shadow-2xl animate-fade-in`}
    >
      <span aria-hidden="true" className={`font-black text-lg leading-6 ${style.couleur}`}>
        {style.icone}
      </span>
      <p className="flex-1 text-sm font-bold text-white break-words leading-6">{notification.message}</p>
      <button type="button" onClick={onFermer} aria-label="Fermer" className="text-gray-400 hover:text-white font-black px-1">
        ×
      </button>
    </div>
  );
}

function Confirmation({ demande, onRepondre }) {
  const { titre = "Confirmer", message, libelleOk = "Confirmer", danger = false } = demande;
  const boutonOk = useRef(null);
  useEffect(() => {
    boutonOk.current?.focus();
    const touche = (e) => e.key === "Escape" && onRepondre(false);
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, [onRepondre]);
  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => onRepondre(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titre-confirmation"
        aria-describedby="message-confirmation"
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#1a1a1b] border-2 ${danger ? "border-red-500/40" : "border-primary-orange/30"} rounded-3xl p-6 w-full max-w-md animate-fade-in`}
      >
        <h2 id="titre-confirmation" className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">
          {titre}
        </h2>
        <p id="message-confirmation" className="text-sm text-gray-300 mb-6 whitespace-pre-line">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onRepondre(false)}
            className="bg-white/10 hover:bg-white/15 text-white flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs"
          >
            Annuler
          </button>
          <button
            ref={boutonOk}
            type="button"
            onClick={() => onRepondre(true)}
            className={
              danger
                ? "bg-red-600 hover:bg-red-500 text-white flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs"
                : "btn-basketball flex-1 py-3 text-xs"
            }
          >
            {libelleOk}
          </button>
        </div>
      </div>
    </div>
  );
}

let prochainId = 1;

// Remplace alert() / confirm() : notifications en bas d'écran et fenêtre de confirmation aux couleurs de l'app
export function RetoursProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [demande, setDemande] = useState(null);

  const notifier = useCallback((type, message) => {
    setNotifications((file) => ajouterNotification(file, { id: prochainId++, type, message: String(message) }));
  }, []);

  const fermer = useCallback((id) => setNotifications((file) => retirerNotification(file, id)), []);

  const resolution = useRef(null);

  const confirmer = useCallback(
    (options) =>
      new Promise((resoudre) => {
        // Une nouvelle demande annule celle qui serait encore ouverte
        resolution.current?.(false);
        resolution.current = resoudre;
        setDemande(typeof options === "string" ? { message: options } : options);
      }),
    [],
  );

  const repondre = useCallback((reponse) => {
    resolution.current?.(reponse);
    resolution.current = null;
    setDemande(null);
  }, []);

  const valeur = useMemo(
    () => ({
      succes: (m) => notifier("succes", m),
      info: (m) => notifier("info", m),
      erreur: (m) => notifier("erreur", m),
      confirmer,
    }),
    [notifier, confirmer],
  );

  return (
    <RetoursContext.Provider value={valeur}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none print:hidden"
      >
        {notifications.map((n) => (
          <div key={n.id} className="w-full max-w-md">
            <Notification notification={n} fermer={fermer} />
          </div>
        ))}
      </div>
      {demande && <Confirmation demande={demande} onRepondre={repondre} />}
    </RetoursContext.Provider>
  );
}
