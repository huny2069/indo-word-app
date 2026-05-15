import React, { createContext, useState, useEffect, useContext } from 'react';
import { useLanguage } from './LanguageContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { setLanguage } = useLanguage();
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      localStorage.removeItem('auth_user');
      return null;
    }
  });

  const [isOnboarded, setIsOnboarded] = useState(() => {
    return localStorage.getItem('onboarding_done') === 'true';
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = () => {
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          localStorage.removeItem('auth_user');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setIsOnboarded(false);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('onboarding_done');
    localStorage.removeItem('gcp_access_token');
    localStorage.removeItem('gcp_token_expiry');
  };

  const completeOnboarding = (nationality) => {
    setIsOnboarded(true);
    localStorage.setItem('onboarding_done', 'true');
    // 국적에 따라 언어 설정
    if (nationality === 'ID') {
      setLanguage('id');
    } else {
      setLanguage('ko');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isOnboarded, loading, login, logout, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
