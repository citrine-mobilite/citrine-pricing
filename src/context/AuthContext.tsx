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
    // Check local storage session
    const savedUser = localStorage.getItem('vtc_pricing_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('vtc_pricing_user');
      }
    } else {
      // Default to initial Admin user for ease of test/demo if empty
      const defaultAdmin: User = {
        id: 'usr_admin_01',
        email: 'admin@vtc-pricing.internal',
        name: 'Landry Admin',
        role: 'admin',
        active: true,
        createdAt: '2026-01-10T08:00:00.000Z'
      };
      setUser(defaultAdmin);
      localStorage.setItem('vtc_pricing_user', JSON.stringify(defaultAdmin));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, pass);
      setUser(res.user);
      localStorage.setItem('vtc_pricing_user', JSON.stringify(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vtc_pricing_user');
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
