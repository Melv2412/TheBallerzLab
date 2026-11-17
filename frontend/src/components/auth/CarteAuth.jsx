import React from "react";
import { Link } from "react-router-dom";
import { ChampMotDePasse } from "../ChampMotDePasse";

function Interrupteur({ mode, theme, onChange }) {
  const bouton = (valeur, libelle) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === valeur}
      onClick={() => onChange(valeur)}
      className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
        mode === valeur ? "bg-primary-orange text-white shadow-lg shadow-primary-orange/30" : theme.inactif
      }`}
    >
      {libelle}
    </button>
  );
  return (
    <div role="tablist" aria-label="Je suis" className={`flex gap-1 p-1 rounded-2xl mb-8 ${theme.switch}`}>
      {bouton("orga", "📋 Organisateur")}
      {bouton("joueur", "🏀 Joueur")}
    </div>
  );
}

// Carte commune à la connexion et à l'inscription : interrupteur organisateur / joueur, puis le formulaire
export function CarteAuth({ auth, titre, sousTitres, erreur, children, bas }) {
  const { mode, theme, changerMode } = auth;
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className={`max-w-md w-full p-6 sm:p-10 relative overflow-hidden transition-colors duration-300 ${theme.carte}`}>
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl ${theme.halo}`} />
        <div className="relative z-10">
          <Interrupteur mode={mode} theme={theme} onChange={changerMode} />
          <h2 className={`text-3xl sm:text-4xl font-black mb-2 italic uppercase tracking-tighter ${theme.titre}`}>{titre}</h2>
          <p className={`text-xs font-bold uppercase tracking-widest mb-8 ${theme.sousTitre}`}>{sousTitres[mode]}</p>

          {erreur && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-xs font-bold mb-6">
              {erreur}
            </div>
          )}

          {children}

          <div className="mt-8 text-center">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.bas}`}>{bas}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const CLASSE_CHAMP =
  "w-full rounded-xl px-4 py-3 focus:outline-none transition-all font-bold text-base normal-case tracking-normal";

export function Champ({ theme, label, motDePasse = false, ...props }) {
  return (
    <div>
      <label className={`block text-[10px] font-black uppercase tracking-widest ${theme.label}`}>
        {label}
        {motDePasse ? (
          <ChampMotDePasse {...props} classeOeil={theme.oeil} className={`${CLASSE_CHAMP} mt-2 ${theme.champ}`} />
        ) : (
          <input {...props} className={`${CLASSE_CHAMP} mt-2 ${theme.champ}`} />
        )}
      </label>
    </div>
  );
}

export function LienAuth({ to, children }) {
  return (
    <Link to={to} className="text-primary-orange hover:underline">
      {children}
    </Link>
  );
}
