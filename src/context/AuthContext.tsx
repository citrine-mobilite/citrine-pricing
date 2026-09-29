import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { auth, loginWithGoogle, logoutFirebase } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
    // 1. Listen for live Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        let role: UserRole = 'employe';
        if (
          fbUser.email === 'citrinemobilite@gmail.com' ||
          fbUser.email === 'landrymouns@gmail.com' ||
          fbUser.email === 'admin@vtc-pricing.internal'
        ) {
          role = 'admin';
        }

        let userName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur';
        if (
          fbUser.email === 'citrinemobilite@gmail.com' ||
          fbUser.email === 'landrymouns@gmail.com' ||
          fbUser.email === 'admin@vtc-pricing.internal' ||
          userName.toLowerCase().includes('landry')
        ) {
          userName = 'Admin Citrine';
        }

        const currentUser: User = {
          id: fbUser.uid,
          email: fbUser.email || '',
          name: userName,
          role,
          active: true,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        setUser(currentUser);
        localStorage.setItem('vtc_pricing_user', JSON.stringify(currentUser));
        setIsLoading(false);
      } else {
        // Fallback to local session if no Firebase user
        const savedUser = localStorage.getItem('vtc_pricing_user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            if (parsed.name && parsed.name.toLowerCase().includes('landry')) {
              parsed.name = 'Citrine Mobilité (Super Admin)';
              localStorage.setItem('vtc_pricing_user', JSON.stringify(parsed));
            }
            setUser(parsed);
          } catch {
            localStorage.removeItem('vtc_pricing_user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
    localStorage.setItem('vtc_pricing_user', JSON.stringify(res.user));
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const userData = await loginWithGoogle();
      setUser(userData);
      localStorage.setItem('vtc_pricing_user', JSON.stringify(userData));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutFirebase().catch(() => {});
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
        signInWithGoogle,
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

