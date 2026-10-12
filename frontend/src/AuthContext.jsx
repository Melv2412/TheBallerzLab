import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as loginApi, getMe } from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Recharge le profil (organisateur validé, nombre de tournois actifs) depuis l'API
  const rafraichirProfil = async () => {
    try {
      const { data } = await getMe();
      const profil = { username: data.username, ...data };
      localStorage.setItem('user', JSON.stringify(profil));
      setUser(profil);
      return profil;
    } catch {
      return null; // hors ligne ou session expirée : on garde ce qu'on a
    }
  };

  useEffect(() => {
    // Vérifier si un utilisateur est déjà connecté
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      rafraichirProfil();
    }
    setLoading(false);

    // Déclenché par api.js quand la session a expiré et ne peut pas être rafraîchie
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = async (credentials) => {
    try {
      const response = await loginApi(credentials);
      const { access, refresh } = response.data;
      
      // En théorie on devrait décoder le JWT pour avoir les infos user
      // Pour l'instant on fait simple en stockant le username
      const userData = { username: credentials.username };
      
      localStorage.setItem('token', access);
      localStorage.setItem('refresh', refresh);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      await rafraichirProfil();
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, rafraichirProfil }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
