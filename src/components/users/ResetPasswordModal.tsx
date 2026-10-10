import React, { useState, useEffect } from 'react';
import { X, KeyRound, Eye, EyeOff, Sparkles, Check, AlertCircle } from 'lucide-react';
import { User } from '../../types';

interface ResetPasswordModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: string | number, newPassword: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  user,
  onClose,
  onConfirm,
  isSubmitting = false
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let gen = '';
    for (let i = 0; i < 10; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen);
    setShowPassword(true);
    setError(null);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = password.trim();
    if (!cleanPass) {
      setError('Veuillez renseigner un nouveau mot de passe.');
      return;
    }
    if (cleanPass.length < 4) {
      setError('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }

    try {
      await onConfirm(user.id, cleanPass);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification du mot de passe.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Modifier le mot de passe
            </h2>
            <p className="text-xs text-slate-500">
              Définir un nouveau mot de passe d'accès pour ce compte
            </p>
          </div>
        </div>

        {/* User Card Summary */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1F4F4A]/10 text-[#1F4F4A] flex items-center justify-center font-bold text-xs uppercase shrink-0">
            {user.name.substring(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
            <div className="text-[11px] font-mono text-slate-500 truncate">{user.email}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="new-user-password" className="block text-xs font-semibold text-slate-700">
                Nouveau mot de passe *
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-semibold text-[#1F4F4A] hover:text-[#163834] inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Générer un mot de passe
              </button>
            </div>

            <div className="relative">
              <input
                id="new-user-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nouveau mot de passe..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-20 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
              />

              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {password && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded text-[10px] cursor-pointer"
                    title="Copier le mot de passe"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : 'Copier'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 4 caractères. L'utilisateur devra utiliser ce mot de passe à sa prochaine connexion.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#163834] rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>Mettre à jour le mot de passe</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
