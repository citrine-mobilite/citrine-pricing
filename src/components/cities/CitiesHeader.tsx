import React from 'react';
import { Building2, Plus, RotateCw } from 'lucide-react';

interface CitiesHeaderProps {
  totalCities: number;
  activeCities: number;
  onOpenAddModal: () => void;
  onRefresh: () => void;
}

export const CitiesHeader: React.FC<CitiesHeaderProps> = ({
  totalCities,
  activeCities,
  onOpenAddModal,
  onRefresh
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Villes & Territoires
          </h1>
          <p className="text-xs text-slate-500">
            {activeCities} active(s) sur {totalCities} configurée(s)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer"
          title="Actualiser"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter une ville</span>
        </button>
      </div>
    </div>
  );
};
