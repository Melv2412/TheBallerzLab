import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import PopupConnexion, { popupConnexionMasque } from './PopupConnexion'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [popupOuvert, setPopupOuvert] = useState(false)

  const handleConnexion = () => {
    if (popupConnexionMasque()) navigate('/login')
    else setPopupOuvert(true)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-2xl sm:text-3xl font-black italic tracking-tighter text-white hover:text-primary-orange transition-all uppercase whitespace-nowrap">
            THE <span className="text-primary-orange">LAB</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-8 min-w-0">
            <Link
              to="/"
              className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary-orange transition-all flex items-center gap-2 whitespace-nowrap"
              aria-label="Mon terrain"
            >
              <span className="text-lg">🏟️</span> <span className="hidden sm:inline">Mon terrain</span>
            </Link>

            {user ? (
              <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary-orange bg-primary-orange/10 px-3 py-1.5 rounded-full border border-primary-orange/20 truncate max-w-[90px] sm:max-w-none">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-all whitespace-nowrap"
                  aria-label="Déconnexion"
                >
                  <span className="sm:hidden text-base">⏻</span>
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnexion}
                className="text-xs font-black uppercase tracking-widest text-white bg-primary-orange px-4 sm:px-6 py-2.5 rounded-xl whitespace-nowrap hover:bg-orange-600 transition-all shadow-lg shadow-primary-orange/20"
              >
                Connexion
              </button>
            )}
          </div>
        </div>
      </div>
      {popupOuvert && <PopupConnexion onFermer={() => setPopupOuvert(false)} />}
    </nav>
  )
}

export default Navbar

