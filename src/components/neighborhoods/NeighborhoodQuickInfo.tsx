import React from 'react';
import { Compass, CheckCircle2, Play } from 'lucide-react';
import { calculatePossiblePricingPairsCount } from '../../utils/routeMatrix';
import { Neighborhood } from '../../types';

interface NeighborhoodQuickInfoProps {
  totalCount: number;
  activeNeighborhoods: Neighborhood[];
  cityName: string;
  onLaunchPricing: () => void;
}

export const NeighborhoodQuickInfo: React.FC<NeighborhoodQuickInfoProps> = ({
  totalCount,
  activeNeighborhoods,
  cityName,
  onLaunchPricing
}) => {
  const activeCount = activeNeighborhoods.length;
  const totalCombinations = calculatePossiblePricingPairsCount(activeNeighborhoods);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Total quartiers</span>
            <strong className="text-slate-900 font-bold text-sm">{totalCount}</strong>
          </div>
        </div>

        <div className="h-7 w-[1px] bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Quartiers actifs</span>
            <strong className="text-emerald-700 font-bold text-sm">
              {activeCount} / {totalCount}
            </strong>
          </div>
        </div>

        <div className="h-7 w-[1px] bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-[#1F4F4A]">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Matrice pricing générée</span>
            <strong className="text-[#1F4F4A] font-bold text-sm font-mono">
              {totalCombinations.toLocaleString('fr-FR')} trajets
            </strong>
          </div>
        </div>
      </div>

      <button
        onClick={onLaunchPricing}
        disabled={activeCount < 2}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm"
      >
        <Play className="w-3.5 h-3.5 fill-white" />
        <span>Lancer Pricing ({cityName})</span>
      </button>
    </div>
  );
};
