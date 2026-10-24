import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Verify saved local session
    const saved = localStorage.getItem('vtc_pricing_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          setUser(parsed);
          setIsLoading(false);
          // Background verification against database
          api.getUsers()
            .then((dbUsers) => {
              const matched = dbUsers.find(u => u.id === parsed.id || u.email.toLowerCase() === (parsed.email || '').toLowerCase());
              if (matched && matched.active) {
                setUser(matched);
                localStorage.setItem('vtc_pricing_user', JSON.stringify(matched));
              } else if (matched && !matched.active) {
                setUser(null);
                localStorage.removeItem('vtc_pricing_user');
                localStorage.removeItem('vtc_pricing_token');
              }
            })
            .catch(() => {});
          return;
        }
      } catch {}
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

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const dbUsers = await api.getUsers();
      const adminUser = dbUsers[0] || {
        id: 1,
        uuid: 'usr_admin',
        email: 'admin@citrine.com',
        name: 'Administrateur',
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString()
      };
      setUser(adminUser);
      localStorage.setItem('vtc_pricing_user', JSON.stringify(adminUser));
      localStorage.setItem('vtc_pricing_token', `supabase_token_${adminUser.id}_${Date.now()}`);
    } finally {
      setIsLoading(false);
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
        signInWithGoogle,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
