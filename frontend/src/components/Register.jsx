import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../api';
import { useAuth } from '../AuthContext';
import { CarteAuth, Champ, LienAuth } from './auth/CarteAuth';
import { useModeAuth } from './auth/useModeAuth';

const SOUS_TITRES = {
  orga: 'Créer et gérer tes tournois',
  joueur: 'Rejoindre ton équipe et suivre tes stats',
};

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
  const { login } = useAuth();
  const auth = useModeAuth('register');
  const changer = (champ) => (e) => setFormData({ ...formData, [champ]: e.target.value });

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
        password: formData.password,
        type: auth.mode, // 'orga' : demande de validation organisateur
      });
      // Connexion directe, puis retour à l'invitation si on en vient
      await login({ username: formData.username, password: formData.password });
      navigate(auth.suite || '/');
    } catch (err) {
      // Afficher le premier message renvoyé par le serveur (pseudo pris, mot de passe trop faible…)
      const erreurs = err.response?.data;
      const message = erreurs && Object.values(erreurs).flat()[0];
      setError(typeof message === 'string' ? message : 'Erreur lors de l’inscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CarteAuth
      auth={auth}
      titre={<>JOIN <span className="text-primary-orange">THE LAB</span></>}
      sousTitres={SOUS_TITRES}
      erreur={error}
      bas={<>Déjà un compte ? <LienAuth to={auth.lien('login')}>Se connecter</LienAuth></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Champ
          theme={auth.theme}
          label="Pseudo"
          type="text"
          autoComplete="username"
          value={formData.username}
          onChange={changer('username')}
          placeholder="Ton pseudo"
          required
        />
        <Champ
          theme={auth.theme}
          label="Email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={changer('email')}
          placeholder="ton@email.com"
          required
        />
        <Champ
          theme={auth.theme}
          label="Mot de passe"
          motDePasse
          autoComplete="new-password"
          value={formData.password}
          onChange={changer('password')}
          placeholder="••••••••"
          required
        />
        <div className="pb-4">
          <Champ
            theme={auth.theme}
            label="Confirmer le mot de passe"
            motDePasse
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={changer('confirmPassword')}
            placeholder="••••••••"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="w-full btn-basketball py-4 text-sm tracking-widest">
          {loading ? 'INSCRIPTION...' : 'CRÉER MON COMPTE'}
        </button>
      </form>
    </CarteAuth>
  );
}

export default Register;
