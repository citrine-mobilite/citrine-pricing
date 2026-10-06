import React from 'react';
import { Lightbulb, RotateCcw, Filter } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';

export type TripJamsFilter = 'all' | 'with_jams' | 'without_jams';
export type TripAdvantageFilter = 'all' | 'hero' | 'yango' | 'equal';
export type TripDistanceFilter = 'all' | 'short' | 'medium' | 'long';
export type TripShortageFilter = 'all' | 'shortage' | 'available';

interface PricingResultsFilterBarProps {
  neighborhoodNames: string[];
  startFilter: string;
  onStartFilterChange: (val: string) => void;
  endFilter: string;
  onEndFilterChange: (val: string) => void;
  jamsFilter: TripJamsFilter;
  onJamsFilterChange: (val: TripJamsFilter) => void;
  advantageFilter: TripAdvantageFilter;
  onAdvantageFilterChange: (val: TripAdvantageFilter) => void;
  distanceFilter: TripDistanceFilter;
  onDistanceFilterChange: (val: TripDistanceFilter) => void;
  shortageFilter?: TripShortageFilter;
  onShortageFilterChange?: (val: TripShortageFilter) => void;
  activeCampaignId?: string;
  totalTripsCount: number;
  filteredTripsCount: number;
  hasJamsInCampaign?: boolean;
  hasShortageInCampaign?: boolean;
  onResetFilters: () => void;
  onOpenRecommendations?: () => void;
}

export const PricingResultsFilterBar: React.FC<PricingResultsFilterBarProps> = ({
  neighborhoodNames,
  startFilter,
  onStartFilterChange,
  endFilter,
  onEndFilterChange,
  jamsFilter,
  onJamsFilterChange,
  advantageFilter,
  onAdvantageFilterChange,
  distanceFilter,
  onDistanceFilterChange,
  shortageFilter = 'all',
  onShortageFilterChange,
  totalTripsCount,
  filteredTripsCount,
  hasJamsInCampaign = false,
  hasShortageInCampaign = false,
  onResetFilters,
  onOpenRecommendations
}) => {
  const departureOptions = [
    { value: '', label: 'Tous les départs' },
    ...neighborhoodNames.map((name) => ({ value: name, label: name }))
  ];

  const arrivalOptions = [
    { value: '', label: 'Toutes les arrivées' },
    ...neighborhoodNames.map((name) => ({ value: name, label: name }))
  ];

  const isFiltered =
    Boolean(startFilter) ||
    Boolean(endFilter) ||
    jamsFilter !== 'all' ||
    advantageFilter !== 'all' ||
    distanceFilter !== 'all' ||
    shortageFilter !== 'all';

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs space-y-2.5">
      {/* Top row: Counter + Quick Reset + Recommendations */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-50 text-[#1F4F4A] flex items-center justify-center">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
            Filtres sur les trajets
          </span>
          <span className="text-[11px] font-semibold text-[#1F4F4A] bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-full">
            {filteredTripsCount.toLocaleString('fr-FR')} / {totalTripsCount.toLocaleString('fr-FR')} trajet(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md transition cursor-pointer"
              title="Réinitialiser tous les filtres trajets"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser filtres</span>
            </button>
          )}

          {onOpenRecommendations && (
            <button
              onClick={onOpenRecommendations}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition cursor-pointer active:scale-95 shadow-2xs"
              title="Optimisation et recommandations tarifaires pour Hero Cab"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Recommandations Hero</span>
              <span className="sm:hidden">Conseils</span>
            </button>
          )}
        </div>
      </div>

      {/* Selectors grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        {/* 1. Quartier Départ */}
        <div>
          <SearchableSelect
            options={departureOptions}
            value={startFilter}
            onChange={onStartFilterChange}
            searchPlaceholder="Départ..."
          />
        </div>

        {/* 2. Quartier Arrivée */}
        <div>
          <SearchableSelect
            options={arrivalOptions}
            value={endFilter}
            onChange={onEndFilterChange}
            searchPlaceholder="Arrivée..."
          />
        </div>

        {/* 3. Trafic / Embouteillages */}
        <div>
          <select
            value={jamsFilter}
            onChange={(e) => onJamsFilterChange(e.target.value as TripJamsFilter)}
            className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none transition ${
              jamsFilter === 'with_jams'
                ? 'bg-amber-50/80 border-amber-200 text-amber-800 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">Trafic : Tous</option>
            <option value="with_jams">🚗 Embouteillages ({hasJamsInCampaign ? 'Détecté' : 'Actif'})</option>
            <option value="without_jams">🟢 Fluide uniquement</option>
          </select>
        </div>

        {/* 4. Compétitivité tarifaire */}
        <div>
          <select
            value={advantageFilter}
            onChange={(e) => onAdvantageFilterChange(e.target.value as TripAdvantageFilter)}
            className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none transition ${
              advantageFilter === 'hero'
                ? 'bg-teal-50 border-teal-300 text-teal-900 font-bold'
                : advantageFilter === 'yango'
                ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">Compétitivité : Tous</option>
            <option value="hero">🏆 Avantage Hero Cab</option>
            <option value="yango">⚡ Avantage Yango</option>
            <option value="equal">🤝 Tarifs équivalents</option>
          </select>
        </div>

        {/* 5. Tension / Disponibilité Chauffeurs Yango */}
        <div>
          <select
            value={shortageFilter}
            onChange={(e) => onShortageFilterChange?.(e.target.value as TripShortageFilter)}
            className={`w-full border rounded-lg px-2.5 py-1.5 font-medium text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none transition ${
              shortageFilter === 'shortage'
                ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">Véhicules : Tous les trajets</option>
            <option value="shortage">⚠️ Pénurie de véhicules ({hasShortageInCampaign ? 'Détecté' : 'Actif'})</option>
            <option value="available">🟢 Véhicules disponibles</option>
          </select>
        </div>

        {/* 6. Distance */}
        <div>
          <select
            value={distanceFilter}
            onChange={(e) => onDistanceFilterChange(e.target.value as TripDistanceFilter)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 text-xs focus:ring-1 focus:ring-[#1F4F4A] focus:outline-none"
          >
            <option value="all">Distance : Toutes</option>
            <option value="short">Courts (&le; 3 km)</option>
            <option value="medium">Moyens (3 à 7 km)</option>
            <option value="long">Longs (&gt; 7 km)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
