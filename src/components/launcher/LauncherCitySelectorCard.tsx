import React from 'react';
import { City, Neighborhood } from '../../types';
import { Building2, Calculator, Clock } from 'lucide-react';

interface LauncherCitySelectorCardProps {
  cities: City[];
  currentCity?: City;
  onSelectCityId: (id: string) => void;
  activeCount: number;
  totalPairs: number;
  estimatedDurationSec: number;
}

export const LauncherCitySelectorCard: React.FC<LauncherCitySelectorCardProps> = ({
  cities,
  currentCity,
  onSelectCityId,
  activeCount,
  totalPairs,
  estimatedDurationSec
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <Building2 className="w-4 h-4 text-[#1F4F4A]" />
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          1. Sélection de la Ville
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="launcher-city-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Ville à évaluer
          </label>
          <select
            id="launcher-city-select"
            value={currentCity?.id || ''}
            onChange={(e) => onSelectCityId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#3D8B85]"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.country}) — {c.currency}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block">Volume & Quartiers</span>
            <strong className="text-xs text-slate-900 font-bold">
              {activeCount} quartiers actifs
            </strong>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Matrice trajets</span>
            <strong className="text-xs text-[#1F4F4A] font-bold font-mono">
              {totalPairs.toLocaleString('fr-FR')} paires
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
