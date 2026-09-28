import React from 'react';
import { TripResult } from '../../types';
import { Sparkles, TrendingDown, TrendingUp, Car } from 'lucide-react';

interface TripMetricsGridProps {
  stats: {
    min: number;
    max: number;
    avg: number;
    avgKm: number;
    maxTrip?: TripResult | null;
    minTrip?: TripResult | null;
  };
  currencySymbol: string;
}

export const TripMetricsGrid: React.FC<TripMetricsGridProps> = ({
  stats,
  currencySymbol
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Prix Moyen Relevé</span>
          <Sparkles className="w-4 h-4 text-[#1F4F4A]" />
        </div>
        <div className="text-xl font-bold font-mono text-slate-900">
          {stats.avg.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 font-normal">{currencySymbol}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Distance Moyenne</span>
          <Car className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-xl font-bold font-mono text-slate-900">
          {stats.avgKm} <span className="text-xs text-slate-400 font-normal">km</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] bg-emerald-50/10">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Trajet le Moins Cher</span>
          <TrendingDown className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-xl font-bold font-mono text-emerald-700">
          {stats.min.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 font-normal">{currencySymbol}</span>
        </div>
        {stats.minTrip && (
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {stats.minTrip.startNeighborhoodName} ➔ {stats.minTrip.endNeighborhoodName}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] bg-rose-50/10">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Trajet le Plus Cher</span>
          <TrendingUp className="w-4 h-4 text-rose-600" />
        </div>
        <div className="text-xl font-bold font-mono text-rose-700">
          {stats.max.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 font-normal">{currencySymbol}</span>
        </div>
        {stats.maxTrip && (
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {stats.maxTrip.startNeighborhoodName} ➔ {stats.maxTrip.endNeighborhoodName}
          </p>
        )}
      </div>
    </div>
  );
};
