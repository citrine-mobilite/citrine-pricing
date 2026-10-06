import React, { useState } from 'react';
import { X, UserPlus, Pencil, AlertCircle, Shield, KeyRound, Eye, EyeOff } from 'lucide-react';

interface UserModalProps {
  isOpen: boolean;
  mode?: 'create' | 'edit';
  onClose: () => void;
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  role: 'admin' | 'responsable' | 'employe';
  onRoleChange: (val: 'admin' | 'responsable' | 'employe') => void;
  password?: string;
  onPasswordChange?: (val: string) => void;
  active?: boolean;
  onActiveChange?: (val: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error?: string | null;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  mode = 'create',
  onClose,
  name,
  onNameChange,
  email,
  onEmailChange,
  role,
  onRoleChange,
  password = '',
  onPasswordChange,
  active = true,
  onActiveChange,
  isSubmitting,
  onSubmit,
  error
}) => {
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const isEdit = mode === 'edit';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A]">
            {isEdit ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Modifier l’utilisateur' : 'Créer un nouvel utilisateur'}
            </h2>
            <p className="text-xs text-slate-500">
              {isEdit ? 'Édition des identifiants et du rôle' : 'Ajouter un nouveau membre d’équipe'}
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

          {/* Password field */}
          {onPasswordChange && (
            <div>
              <label htmlFor="user-password-input" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  {isEdit ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe (optionnel)'}
                </span>
                {isEdit && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    Laisser vide pour conserver l'actuel
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  id="user-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder={isEdit ? 'Laisser vide pour ne pas modifier...' : 'Par défaut : c!tr!n$@2026'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-9 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#3D8B85]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="user-role-select" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#1F4F4A]" />
              <span>Rôle & Permissions *</span>
            </label>
            <select
              id="user-role-select"
              value={role}
              onChange={(e) => onRoleChange(e.target.value as 'admin' | 'responsable' | 'employe')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#3D8B85]"
            >
              <option value="employe">Opérateur / Employé (Consultation & Lancement)</option>
              <option value="responsable">Responsable (Gestion Villes & Tarifs)</option>
              <option value="admin">Administrateur (Accès Total & Utilisateurs)</option>
            </select>
          </div>

          {isEdit && onActiveChange && (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Statut du compte</span>
                <span className="text-[11px] text-slate-500">
                  {active ? 'Le compte est actif et peut se connecter' : 'Le compte est suspendu/désactivé'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onActiveChange(!active)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  active ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    active ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {isSubmitting
                ? isEdit ? 'Enregistrement...' : 'Création...'
                : isEdit ? 'Enregistrer les modifications' : 'Créer l’utilisateur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
