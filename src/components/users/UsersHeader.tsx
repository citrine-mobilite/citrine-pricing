import React from 'react';
import { Users, UserPlus } from 'lucide-react';

interface UsersHeaderProps {
  totalCount: number;
  onOpenAddModal: () => void;
}

export const UsersHeader: React.FC<UsersHeaderProps> = ({
  totalCount,
  onOpenAddModal
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Gestion des Utilisateurs & Opérateurs
          </h1>
          <p className="text-xs text-slate-500">
            {totalCount} utilisateur(s) autorisé(s)
          </p>
        </div>
      </div>

      <button
        onClick={onOpenAddModal}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition cursor-pointer shadow-sm"
      >
        <UserPlus className="w-4 h-4" />
        <span>Ajouter un utilisateur</span>
      </button>
    </div>
  );
};
