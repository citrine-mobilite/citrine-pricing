import React from 'react';
import { Building2, Clock, Activity, CheckCircle2 } from 'lucide-react';

interface DashboardMetricCardsProps {
  activeCitiesCount: number;
  totalCitiesCount: number;
  activeCampaignsCount: number;
  totalTrips: number;
  successRate: string;
}

export const DashboardMetricCards: React.FC<DashboardMetricCardsProps> = ({
  activeCitiesCount,
  totalCitiesCount,
  activeCampaignsCount,
  totalTrips,
  successRate
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 font-medium block mb-1">Villes Monitorées</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {activeCitiesCount} <span className="text-xs text-slate-400 font-normal">/ {totalCitiesCount}</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#1F4F4A]">
          <Building2 className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 font-medium block mb-1">Campagnes en cours</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {activeCampaignsCount}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 font-medium block mb-1">Trajets Relevés</span>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {totalTrips.toLocaleString('fr-FR')}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
          <Activity className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 font-medium block mb-1">Taux de Succès</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            {successRate}%
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
