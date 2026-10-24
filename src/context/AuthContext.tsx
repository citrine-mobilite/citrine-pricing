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
    // Listen for live Firebase auth state or verify saved local session
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const dbUsers = await api.getUsers();
          const matchedUser = dbUsers.find(
            (u) => u.email.toLowerCase() === (fbUser.email || '').toLowerCase() || u.id === fbUser.uid
          );

          if (matchedUser && matchedUser.active) {
            setUser(matchedUser);
            localStorage.setItem('vtc_pricing_user', JSON.stringify(matchedUser));
          } else if (matchedUser && !matchedUser.active) {
            setUser(null);
            localStorage.removeItem('vtc_pricing_user');
          } else {
            const currentUser: User = {
              id: fbUser.uid,
              email: fbUser.email || '',
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur',
              role: 'admin',
              active: true,
              createdAt: new Date().toISOString()
            };
            setUser(currentUser);
            localStorage.setItem('vtc_pricing_user', JSON.stringify(currentUser));
          }
        } catch {
          const saved = localStorage.getItem('vtc_pricing_user');
          setUser(saved ? JSON.parse(saved) : null);
        }
        setIsLoading(false);
      } else {
        // Verify local session against database
        const saved = localStorage.getItem('vtc_pricing_user');
        const token = localStorage.getItem('vtc_pricing_token');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (!parsed || !parsed.email) {
              localStorage.removeItem('vtc_pricing_user');
              localStorage.removeItem('vtc_pricing_token');
              setUser(null);
              setIsLoading(false);
              return;
            }
            // Restauration immédiate de l'utilisateur connecté pour préserver le jeton et éviter la redirection sur F5
            setUser(parsed);
            setIsLoading(false);

            // Vérification asynchrone en arrière-plan du compte en base
            api.getUsers()
              .then((dbUsers) => {
                const matched = dbUsers.find(u => u.id === parsed.id || u.email.toLowerCase() === (parsed.email || '').toLowerCase());
                if (matched && matched.active) {
                  setUser(matched);
                  localStorage.setItem('vtc_pricing_user', JSON.stringify(matched));
                } else if (matched && !matched.active) {
                  // Compte désactivé en base -> déconnexion forcée
                  setUser(null);
                  localStorage.removeItem('vtc_pricing_user');
                  localStorage.removeItem('vtc_pricing_token');
                }
              })
              .catch(() => {
                // En cas de micro-coupure réseau, garder la session de l'utilisateur actif
              });
          } catch {
            localStorage.removeItem('vtc_pricing_user');
            localStorage.removeItem('vtc_pricing_token');
            setUser(null);
            setIsLoading(false);
          }
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
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
      const userData = await loginWithGoogle();
      setUser(userData);
      localStorage.setItem('vtc_pricing_user', JSON.stringify(userData));
      localStorage.setItem('vtc_pricing_token', `google_token_${userData.id}_${Date.now()}`);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutFirebase().catch(() => {});
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

