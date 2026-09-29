import React from 'react';
import { Lightbulb, FileText } from 'lucide-react';

interface PricingResultsFilterBarProps {
  neighborhoodNames: string[];
  startFilter: string;
  onStartFilterChange: (val: string) => void;
  endFilter: string;
  onEndFilterChange: (val: string) => void;
  activeCampaignId?: string;
  totalTripsCount: number;
  onOpenRecommendations?: () => void;
  onOpenExecutiveReport?: () => void;
}

export const PricingResultsFilterBar: React.FC<PricingResultsFilterBarProps> = ({
  neighborhoodNames,
  startFilter,
  onStartFilterChange,
  endFilter,
  onEndFilterChange,
  onOpenRecommendations,
  onOpenExecutiveReport
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
      {/* Filters : Departure & Destination dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={startFilter}
          onChange={(e) => onStartFilterChange(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#3D8B85]"
        >
          <option value="">Tous les départs</option>
          {neighborhoodNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={endFilter}
          onChange={(e) => onEndFilterChange(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#3D8B85]"
        >
          <option value="">Toutes les arrivées</option>
          {neighborhoodNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

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

      {/* Strategic Actions: Recommandations Hero & Fiche Synthèse PDF */}
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

        {onOpenExecutiveReport && (
          <button
            onClick={onOpenExecutiveReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer active:scale-95 shadow-2xs"
            title="Générer la Fiche Synthèse Exécutive (Format A4 / 1 page)"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Fiche Synthèse PDF</span>
          </button>
        )}
      </div>
    </div>
  );
};
