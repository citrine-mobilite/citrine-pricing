import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { User } from '../../types';

interface DeleteUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onConfirm,
  isDeleting
}) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Supprimer l'utilisateur
            </h2>
            <p className="text-xs text-slate-500">
              Confirmation de suppression définitive
            </p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3.5 mb-5 space-y-1.5">
          <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Action irréversible</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            Êtes-vous certain de vouloir supprimer le compte de <span className="font-bold text-slate-900">{user.name}</span> ({user.email}) ?
          </p>
          <p className="text-[11px] text-rose-700">
            Cet utilisateur n'aura plus accès à la plateforme ni à la base de tarification.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Suppression en cours...' : 'Oui, supprimer le compte'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
