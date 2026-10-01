import React from 'react';
import { Building2, CheckCircle2, MapPin, Download, ArrowRight, Activity } from 'lucide-react';

interface DashboardMetricCardsProps {
  activeCitiesCount: number;
  totalCitiesCount: number;
  completedCampaignsCount: number;
  failedCampaignsCount: number;
  activeNeighborhoodsCount: number;
  totalNeighborhoodsCount: number;
  availabilityStats?: {
    yangoRate: number;
    heroRate: number;
    tmRate: number;
  };
  onNavigate: (tab: string) => void;
}

export const DashboardMetricCards: React.FC<DashboardMetricCardsProps> = ({
  activeCitiesCount,
  totalCitiesCount,
  completedCampaignsCount,
  failedCampaignsCount,
  activeNeighborhoodsCount,
  totalNeighborhoodsCount,
  availabilityStats = { yangoRate: 98, heroRate: 95, tmRate: 75 },
  onNavigate
}) => {
  const totalRealized = completedCampaignsCount + failedCampaignsCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Villes Monitorées */}
      <div
        onClick={() => onNavigate('cities')}
        className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-[#1F4F4A]/40 transition cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Villes Monitorées</span>
          <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#1F4F4A] flex items-center justify-center group-hover:scale-105 transition">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {activeCitiesCount} <span className="text-xs text-slate-400 font-normal">/ {totalCitiesCount} active(s)</span>
          </div>
          <span className="text-[11px] text-[#1F4F4A] font-semibold flex items-center gap-0.5 group-hover:underline">
            Gérer <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 2. Campagnes Réalisées (avec Bouton de Téléchargement -> Historique) */}
      <div
        onClick={() => onNavigate('history')}
        className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-emerald-500/40 transition cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Campagnes Réalisées</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('history');
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer shadow-2xs"
              title="Télécharger / Exporter depuis l'historique"
            >
              <Download className="w-3 h-3 text-emerald-600" />
              <span>Exporter</span>
            </button>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {totalRealized}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
            <span className="text-emerald-700 font-semibold">{completedCampaignsCount} réussie(s)</span> • <span className="text-slate-400">{failedCampaignsCount} arrêtée(s)</span>
          </div>
        </div>
      </div>

      {/* 3. Quartiers Monitorés */}
      <div
        onClick={() => onNavigate('neighborhoods')}
        className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-blue-500/40 transition cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Quartiers Monitorés</span>
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
            <MapPin className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {activeNeighborhoodsCount} <span className="text-xs text-slate-400 font-normal">/ {totalNeighborhoodsCount} actif(s)</span>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5 group-hover:underline">
            Gérer <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* 4. Taux de Disponibilité / Réponse Agrégateurs */}
      <div
        onClick={() => onNavigate('pricing')}
        className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md hover:border-amber-500/40 transition cursor-pointer group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Taux de Disponibilité</span>
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold text-slate-900 font-mono flex items-baseline justify-between">
            <span>{availabilityStats.heroRate}%</span>
            <span className="text-xs font-normal text-slate-400">Hero Cab</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium flex items-center justify-between border-t border-slate-100 pt-1">
            <span>Hero <strong className="text-amber-700">{availabilityStats.heroRate}%</strong></span>
            <span>Yango <strong className="text-slate-700">{availabilityStats.yangoRate}%</strong></span>
            <span>TM <strong className="text-slate-700">{availabilityStats.tmRate}%</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

