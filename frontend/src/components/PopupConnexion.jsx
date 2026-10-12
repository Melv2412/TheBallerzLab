import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

const CLE_MASQUER = 'popupConnexionMasque'

// Le localStorage peut être indisponible (navigation privée, stockage bloqué)
export const popupConnexionMasque = () => {
  try {
    return localStorage.getItem(CLE_MASQUER) === '1'
  } catch {
    return false
  }
}

/**
 * Prévient les visiteurs avant la connexion : un compte ne sert qu'aux
 * organisateurs, tout le monde peut suivre les tournois sans compte.
 */
function PopupConnexion({ onFermer }) {
  const navigate = useNavigate()
  const [neplusAfficher, setNePlusAfficher] = useState(false)

  useEffect(() => {
    const onTouche = (e) => e.key === 'Escape' && onFermer()
    document.addEventListener('keydown', onTouche)
    return () => document.removeEventListener('keydown', onTouche)
  }, [onFermer])

  const continuer = (chemin, organisateur = true) => {
    if (organisateur && neplusAfficher) {
      try {
        localStorage.setItem(CLE_MASQUER, '1')
      } catch {
        // Préférence non mémorisée : le popup réapparaîtra, ce n'est pas bloquant
      }
    }
    onFermer()
    navigate(chemin)
  }

  // Rendu dans <body> : le flou (backdrop-filter) de la navbar piégerait un élément `fixed`
  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-connexion-titre"
    >
      <div
        className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in ring-8 ring-primary-orange/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl text-center mb-4">🏀</div>
        <h2
          id="popup-connexion-titre"
          className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase text-white text-center mb-4"
        >
          Un compte, <span className="text-primary-orange">pour quoi faire ?</span>
        </h2>

        <div className="space-y-3 mb-6">
          <div className="flex gap-3 items-start bg-white/5 border border-white/10 rounded-2xl p-4">
            <span className="text-2xl">👀</span>
            <p className="text-sm text-gray-300">
              <span className="font-black text-white">Spectateur, joueur, supporter ?</span> Pas besoin de compte :
              tous les tournois, scores, stats et matchs en direct sont visibles librement.
            </p>
          </div>
          <div className="flex gap-3 items-start bg-primary-orange/10 border border-primary-orange/30 rounded-2xl p-4">
            <span className="text-2xl">📋</span>
            <p className="text-sm text-gray-300">
              <span className="font-black text-white">Organisateur ?</span> Le compte sert uniquement à
              créer et gérer ton tournoi : équipes, joueurs, matchs et table de marque.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => continuer('/', false)} className="btn-basketball w-full py-4">
            Voir les tournois sans compte
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => continuer('/login')}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
            >
              Se connecter
            </button>
            <button
              onClick={() => continuer('/register')}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
            >
              Créer un compte
            </button>
          </div>
        </div>

        <label className="flex items-center justify-center gap-2 mt-5 text-[11px] text-gray-500 font-bold uppercase tracking-widest cursor-pointer">
          <input
            type="checkbox"
            checked={neplusAfficher}
            onChange={(e) => setNePlusAfficher(e.target.checked)}
            className="accent-primary-orange w-4 h-4"
          />
          Je suis organisateur, ne plus afficher
        </label>
      </div>
    </div>,
    document.body,
  )
}

export default PopupConnexion
