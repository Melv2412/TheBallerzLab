import React, { useState } from 'react';
import { register } from '../api';
import { useNavigate, Link } from 'react-router-dom';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      navigate('/login');
    } catch (err) {
      setError('Erreur lors de l’inscription. Le pseudo est peut-être déjà pris.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-10 border-primary-orange/20 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-orange/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white mb-2 italic uppercase tracking-tighter">
            JOIN <span className="text-primary-orange">THE LAB</span>
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Devenir organisateur</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-xs font-bold mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-orange transition-all font-bold"
                placeholder="Votre pseudo"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-orange transition-all font-bold"
                placeholder="votre@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-orange transition-all font-bold"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="pb-4">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-orange transition-all font-bold"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-basketball py-4 text-sm tracking-widest"
            >
              {loading ? 'INSCRIPTION...' : 'CRÉER MON COMPTE'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-primary-orange hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
