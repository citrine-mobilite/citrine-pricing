import React from 'react';
import { City, PricingCampaign } from '../../types';
import { Play, RotateCw, Building2, SlidersHorizontal, Sparkles, Navigation, ArrowRight, Clock } from 'lucide-react';
import { computeCampaignDuration } from '../../utils/durationUtils';
import { SearchableSelect } from '../SearchableSelect';

interface PricingHeaderProps {
  cities: City[];
  currentCity: City;
  onSelectCityId: (cityId: string) => void;
  campaigns: PricingCampaign[];
  activeCampaignId: string;
  onCampaignChange: (campaignId: string) => void;
  onRefresh?: () => void;
  activeTesterPanel: 'none' | 'single' | 'intra' | 'inter';
  onToggleTesterPanel: (panel: 'single' | 'intra' | 'inter') => void;
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
  activeTesterPanel,
  onToggleTesterPanel,
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
            <SearchableSelect
              id="city-select"
              options={cities.map((c) => ({
                value: c.id,
                label: c.name,
                sublabel: c.country
              }))}
              value={currentCity.id}
              onChange={onSelectCityId}
              searchPlaceholder="Rechercher une ville..."
            />
          </div>
        </div>
      </div>

      {/* Right : Action Controls (Campaign Picker, Single Test, Launch Buttons) */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto justify-end">
        {/* Campaign Picker Dropdown */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {campaigns.length > 0 && (
            <div className="flex-1 sm:flex-none flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[11px] text-slate-400 font-medium shrink-0">Relevé :</span>
              <SearchableSelect
                options={campaigns.map((c) => ({
                  value: c.id,
                  label: `${c.cityName} — ${new Date(c.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
                  sublabel: `${c.completedPairs || 0} tr. - ⏱️ ${computeCampaignDuration(c)}`
                }))}
                value={activeCampaignId}
                onChange={onCampaignChange}
                searchPlaceholder="Rechercher un relevé..."
              />
            </div>
          )}

          {activeCampaign && (
            <span className="hidden sm:inline-flex items-center gap-1 bg-[#1F4F4A]/10 text-[#1F4F4A] px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0" title="Durée totale calculée">
              <Clock className="w-3.5 h-3.5" />
              <span>{computeCampaignDuration(activeCampaign)}</span>
            </span>
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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* 1. Test Trajet Unique */}
          <button
            onClick={() => onToggleTesterPanel('single')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[38px] sm:min-h-0 ${
              activeTesterPanel === 'single'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Test Trajet Unique</span>
          </button>

          {/* 2. 1 Arrondissement (Intra) */}
          <button
            onClick={() => onToggleTesterPanel('intra')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[38px] sm:min-h-0 ${
              activeTesterPanel === 'intra'
                ? 'bg-[#1F4F4A] text-white border-[#1F4F4A]'
                : 'bg-teal-50/70 text-teal-800 border-teal-200 hover:bg-teal-100'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>1 Arrondissement</span>
          </button>

          {/* 3. 2 Arrondissements (Inter) */}
          <button
            onClick={() => onToggleTesterPanel('inter')}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer min-h-[38px] sm:min-h-0 ${
              activeTesterPanel === 'inter'
                ? 'bg-blue-800 text-white border-blue-800'
                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>2 Arrondissements</span>
          </button>

          {/* 4. Test Sample (25 pairs) */}
          <button
            onClick={() => onLaunch(25)}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-2xs min-h-[38px] sm:min-h-0 active:scale-95"
            title="Lancer un échantillon rapide de 25 trajets"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{launchingTarget === '25' ? 'Démarrage...' : 'Test 25'}</span>
          </button>

          {/* 5. Full Benchmark Launch */}
          <button
            onClick={() => onLaunch('all')}
            disabled={isRunning || launchingTarget !== null || totalCombinations === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-semibold bg-[#1F4F4A] hover:bg-[#183F3B] text-white rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer min-h-[38px] sm:min-h-0 active:scale-95"
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
