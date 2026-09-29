import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HeroLogo } from './HeroLogo';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre adresse email et votre mot de passe.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Adresse email ou mot de passe incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 py-12 selection:bg-[#3D8B85] selection:text-white">
      <div className="max-w-sm w-full space-y-6">
        
        {/* Bigger Hero Logo directly on page */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <HeroLogo size="2xl" showSubtitle={true} />
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form directly on page */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="citrinemobilite@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#3D8B85] focus:bg-white transition shadow-2xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1F4F4A] hover:bg-[#183F3B] text-white font-semibold text-xs py-3.5 rounded-xl shadow-md transition duration-150 disabled:opacity-50 cursor-pointer mt-2"
          >
            <span>{isLoading ? 'Vérification en cours...' : 'Se connecter'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>
    </div>
  );
};
