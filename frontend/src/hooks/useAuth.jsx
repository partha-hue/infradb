import { useState, createContext, useContext, useEffect } from 'react';
import { login as loginService, register as registerService } from '../api/dbService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // In a real app, you might fetch user info here
      setUser({ loggedIn: true });
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const data = await loginService(credentials);
    setUser({ loggedIn: true, ...data.user });
    return data;
  };

  const register = async (userData) => {
    return await registerService(userData);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
