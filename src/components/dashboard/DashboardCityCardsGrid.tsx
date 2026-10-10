import React from 'react';
import { City } from '../../types';
import { Building2, Compass, Play, ArrowRight } from 'lucide-react';

interface DashboardCityCardsGridProps {
  cities: City[];
  onSelectCityForLaunch: (city: City) => void;
  onNavigateToNeighborhoods: (cityId: string) => void;
}

export const DashboardCityCardsGrid: React.FC<DashboardCityCardsGridProps> = ({
  cities,
  onSelectCityForLaunch,
  onNavigateToNeighborhoods
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Territoires Monitorés
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {cities.map((city) => (
          <div
            key={city.id}
            className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{city.name}</h3>
                    <span className="text-[10px] text-slate-400">{city.country}</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    city.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {city.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mb-3">
                Devise : <strong>{city.currency} ({city.currencySymbol})</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => onNavigateToNeighborhoods(String(city.id))}
                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                <Compass className="w-3.5 h-3.5 text-slate-500" />
                <span>Quartiers</span>
              </button>

              <button
                onClick={() => onSelectCityForLaunch(city)}
                disabled={!city.active}
                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-white bg-[#1F4F4A] hover:bg-[#183F3B] rounded-lg transition disabled:opacity-40"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Benchmark</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
