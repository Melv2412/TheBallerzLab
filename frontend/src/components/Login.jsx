import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { CarteAuth, Champ, LienAuth } from './auth/CarteAuth';
import { useModeAuth } from './auth/useModeAuth';

const SOUS_TITRES = {
  orga: 'Connexion organisateur',
  joueur: 'Connexion joueur : ton équipe et tes stats',
};

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const auth = useModeAuth('login');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ username, password });
      navigate(auth.suite || '/'); // venu d'un lien d'invitation : on y revient
    } catch {
      setError('Identifiants invalides. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CarteAuth
      auth={auth}
      titre={<>THE <span className="text-primary-orange">LAB</span></>}
      sousTitres={SOUS_TITRES}
      erreur={error}
      bas={<>Pas encore de compte ? <LienAuth to={auth.lien('register')}>Créer un compte</LienAuth></>}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Champ
          theme={auth.theme}
          label="Pseudo"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ton nom d'utilisateur"
          required
        />
        <Champ
          theme={auth.theme}
          label="Mot de passe"
          motDePasse
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <button type="submit" disabled={loading} className="w-full btn-basketball py-4 text-sm tracking-widest">
          {loading ? 'CHARGEMENT...' : 'SE CONNECTER'}
        </button>
      </form>
    </CarteAuth>
  );
}

export default Login;
