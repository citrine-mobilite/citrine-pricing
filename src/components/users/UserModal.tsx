import React from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error?: string | null;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  name,
  onNameChange,
  email,
  onEmailChange,
  isSubmitting,
  onSubmit,
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A]">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Créer un nouvel utilisateur
            </h2>
            <p className="text-xs text-slate-500">
              Rôle Opérateur / Gestionnaire de Tarification
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="user-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Nom complet *
            </label>
            <input
              id="user-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex: Jean Dupont"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div>
            <label htmlFor="user-email-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Adresse email *
            </label>
            <input
              id="user-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="jean.dupont@citrine.cm"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#3D8B85]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Création...' : 'Créer l’utilisateur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
