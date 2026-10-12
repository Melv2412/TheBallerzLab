import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ username, password });
      navigate('/');
    } catch (err) {
      setError('Identifiants invalides. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-6 sm:p-10 border-primary-orange/20 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-orange/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 italic uppercase tracking-tighter">
            THE <span className="text-primary-orange">LAB</span>
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Connexion organisateur</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-xs font-bold mb-6 animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary-orange transition-all font-bold"
                placeholder="Entrez votre nom d'utilisateur"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary-orange transition-all font-bold"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-basketball py-4 text-sm tracking-widest"
            >
              {loading ? 'CHARGEMENT...' : 'SE CONNECTER'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
              Pas encore de compte ?{' '}
              <Link to="/register" className="text-primary-orange hover:underline">
                Créer un profil
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
