import React from 'react';
import { Lightbulb, FileText } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';

interface PricingResultsFilterBarProps {
  neighborhoodNames: string[];
  startFilter: string;
  onStartFilterChange: (val: string) => void;
  endFilter: string;
  onEndFilterChange: (val: string) => void;
  activeCampaignId?: string;
  totalTripsCount: number;
  onOpenRecommendations?: () => void;
}

export const PricingResultsFilterBar: React.FC<PricingResultsFilterBarProps> = ({
  neighborhoodNames,
  startFilter,
  onStartFilterChange,
  endFilter,
  onEndFilterChange,
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
      {/* Filters : Departure & Destination dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          options={departureOptions}
          value={startFilter}
          onChange={onStartFilterChange}
          searchPlaceholder="Filtrer par quartier départ..."
        />

        <SearchableSelect
          options={arrivalOptions}
          value={endFilter}
          onChange={onEndFilterChange}
          searchPlaceholder="Filtrer par quartier arrivée..."
        />

        {(startFilter || endFilter) && (
          <button
            onClick={() => {
              onStartFilterChange('');
              onEndFilterChange('');
            }}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Réinitialiser filtres
          </button>
        )}
      </div>

      {/* Strategic Actions: Recommandations Hero */}
      <div className="flex items-center gap-2">
        {onOpenRecommendations && (
          <button
            onClick={onOpenRecommendations}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition cursor-pointer active:scale-95 shadow-2xs"
            title="Optimisation et recommandations tarifaires pour Hero Cab"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <span>Recommandations Hero</span>
          </button>
        )}
      </div>
    </div>
  );
};
