import React from 'react';
import { City, PricingCampaign } from '../../types';
import { Play, RotateCw, Building2, SlidersHorizontal, Sparkles } from 'lucide-react';

interface PricingHeaderProps {
  cities: City[];
  currentCity: City;
  onSelectCityId: (cityId: string) => void;
  campaigns: PricingCampaign[];
  activeCampaignId: string;
  onCampaignChange: (campaignId: string) => void;
  onRefresh?: () => void;
  showSingleTester: boolean;
  onToggleSingleTester: () => void;
  totalCombinations: number;
  launchingTarget: string | null;
  onLaunch: (overrideLimit: number | 'all') => void;
  activeCampaign?: PricingCampaign;
}

export const PricingHeader: React.FC<PricingHeaderProps> = ({
  cities,
  currentCity,
  onSelectCityId,
  campaigns,
  activeCampaignId,
  onCampaignChange,
  onRefresh,
  showSingleTester,
  onToggleSingleTester,
  totalCombinations,
  launchingTarget,
  onLaunch,
  activeCampaign
}) => {
  const isRunning = activeCampaign?.status === 'in_progress';

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      {/* Left : City Selector & Title */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Tarification & Benchmark VTC
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <label htmlFor="city-select" className="text-xs text-slate-500 font-medium">Ville cible :</label>
            <select
              id="city-select"
              value={currentCity.id}
              onChange={(e) => onSelectCityId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#3D8B85]"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.country})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right : Action Controls (Campaign Picker, Single Test, Launch Buttons) */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto justify-end">
        {/* Campaign Picker Dropdown */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {campaigns.length > 0 && (
            <div className="flex-1 sm:flex-none flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 sm:py-1">
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Relevé :</span>
              <select
                value={activeCampaignId}
                onChange={(e) => onCampaignChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none w-full sm:max-w-[190px] truncate"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cityName} - {new Date(c.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ({c.completedPairs || 0} tr.)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Rafraîchir les données"
              className="p-2 sm:p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer shrink-0"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Buttons Row / Grid on Mobile */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {/* Single Test Toggle */}
          <button
            onClick={onToggleSingleTester}
            className={`col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[40px] sm:min-h-0 ${
              showSingleTester
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Test Trajet Unique</span>
          </button>

          {/* Test Sample (25 pairs) */}
          <button
            onClick={() => onLaunch(25)}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm min-h-[40px] sm:min-h-0 active:scale-95"
            title="Lancer un échantillon rapide de 25 trajets"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{launchingTarget === '25' ? 'Démarrage...' : 'Test 25'}</span>
          </button>

          {/* Full Benchmark Launch */}
          <button
            onClick={() => onLaunch('all')}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer min-h-[40px] sm:min-h-0 active:scale-95"
            title={`Lancer la tarification de TOUS les ${totalCombinations.toLocaleString('fr-FR')} trajets`}
          >
            <Play className="w-3.5 h-3.5 fill-white shrink-0" />
            <span className="truncate">{launchingTarget === 'all' ? 'Lancement...' : `Tout (${totalCombinations})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
