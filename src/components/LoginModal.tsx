import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Gem, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre adresse email et mot de passe.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo1234');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-5">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-[#3D8B85] mx-auto flex items-center justify-center shadow-md shadow-[#3D8B85]/20">
            <Gem className="w-5 h-5 text-[#D4A82F] font-bold" />
          </div>
          <h2 className="text-base font-bold text-[#1F4F4A] tracking-tight">
            Citrine Pricing
          </h2>
          <p className="text-xs text-[#3D8B85]">
            Connexion à l'espace VTC Cameroun
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#1F4F4A] mb-1">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="collab@citrine-pricing.cm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F0FAFA]/60 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-[#1F4F4A] placeholder-slate-400 focus:outline-none focus:border-[#3D8B85] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F4F4A] mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#F0FAFA]/60 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-[#1F4F4A] placeholder-slate-400 focus:outline-none focus:border-[#3D8B85] focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#3D8B85] hover:bg-[#347872] text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <span>{isLoading ? 'Connexion...' : 'Se connecter'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Demo Accounts */}
        <div className="pt-3 border-t border-slate-100">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-2 text-center tracking-wider">
            Comptes de test rapide :
          </span>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => selectDemoAccount('admin@citrine-pricing.cm')}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-900">Landry</div>
              <div className="text-[10px] text-slate-400 truncate">admin@...</div>
            </button>

            <button
              type="button"
              onClick={() => selectDemoAccount('responsable@citrine-pricing.cm')}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-900">Sarah</div>
              <div className="text-[10px] text-slate-400 truncate">sarah@...</div>
            </button>

            <button
              type="button"
              onClick={() => selectDemoAccount('employe@citrine-pricing.cm')}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-900">Marc</div>
              <div className="text-[10px] text-slate-400 truncate">marc@...</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
