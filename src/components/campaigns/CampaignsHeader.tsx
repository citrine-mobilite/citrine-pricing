import React from 'react';
import { Activity, RotateCw } from 'lucide-react';

interface CampaignsHeaderProps {
  totalCount: number;
  activeCount: number;
  onRefresh: () => void;
}

export const CampaignsHeader: React.FC<CampaignsHeaderProps> = ({
  totalCount,
  activeCount,
  onRefresh
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Campagnes & Relevés de Tarification
          </h1>
          <p className="text-xs text-slate-500">
            {totalCount} campagne(s) enregistrée(s) • {activeCount} en cours d'exécution
          </p>
        </div>
      </div>

      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
      >
        <RotateCw className="w-3.5 h-3.5 text-slate-500" />
        <span>Actualiser</span>
      </button>
    </div>
  );
};
