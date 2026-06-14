import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-3xl font-black italic tracking-tighter text-white hover:text-primary-orange transition-all uppercase">
            THE <span className="text-primary-orange">LAB</span>
          </Link>
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary-orange transition-all flex items-center gap-2"
            >
              <span className="text-lg">🏟️</span> Mon terrain 
            </Link>

            {user ? (
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary-orange bg-primary-orange/10 px-3 py-1.5 rounded-full border border-primary-orange/20">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-all"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="text-xs font-black uppercase tracking-widest text-white bg-primary-orange px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-primary-orange/20"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

