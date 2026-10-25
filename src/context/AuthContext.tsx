import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Vérification de la session locale Supabase au démarrage
    const saved = localStorage.getItem('vtc_pricing_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          // Restauration immédiate de l'utilisateur
          setUser(parsed);
          setIsLoading(false);

          // Validation asynchrone auprès de Supabase
          api.getUsers()
            .then((dbUsers) => {
              const matched = dbUsers.find(
                u => u.id === parsed.id || u.uuid === parsed.uuid || u.email.toLowerCase() === parsed.email.toLowerCase()
              );
              if (matched && matched.active) {
                setUser(matched);
                localStorage.setItem('vtc_pricing_user', JSON.stringify(matched));
              } else if (matched && !matched.active) {
                // Compte désactivé dans Supabase
                setUser(null);
                localStorage.removeItem('vtc_pricing_user');
                localStorage.removeItem('vtc_pricing_token');
              }
            })
            .catch(() => {
              // Réseau temporairement indisponible, garder la session
            });
          return;
        }
      } catch {
        localStorage.removeItem('vtc_pricing_user');
        localStorage.removeItem('vtc_pricing_token');
      }
    }
    setUser(null);
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
    localStorage.setItem('vtc_pricing_user', JSON.stringify(res.user));
    if (res.token) {
      localStorage.setItem('vtc_pricing_token', res.token);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vtc_pricing_user');
    localStorage.removeItem('vtc_pricing_token');
    sessionStorage.clear();
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole
      }}
    >
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
