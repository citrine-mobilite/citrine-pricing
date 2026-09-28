import React from 'react';
import { Download } from 'lucide-react';

interface PricingResultsFilterBarProps {
  neighborhoodNames: string[];
  startFilter: string;
  onStartFilterChange: (val: string) => void;
  endFilter: string;
  onEndFilterChange: (val: string) => void;
  activeCampaignId?: string;
  totalTripsCount: number;
}

export const PricingResultsFilterBar: React.FC<PricingResultsFilterBarProps> = ({
  neighborhoodNames,
  startFilter,
  onStartFilterChange,
  endFilter,
  onEndFilterChange,
  activeCampaignId,
  totalTripsCount
}) => {
  const handleDownloadFullCsv = () => {
    if (!activeCampaignId) return;
    const exportUrl = `/api/campaigns/${activeCampaignId}/export`;
    window.location.href = exportUrl;
  };

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

      {/* Direct CSV Download from Backend */}
      {activeCampaignId && (
        <button
          onClick={handleDownloadFullCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F4F4A] bg-[#1F4F4A]/10 hover:bg-[#1F4F4A]/20 border border-[#1F4F4A]/30 rounded-lg transition cursor-pointer"
          title="Télécharger l'intégralité des données directement depuis le serveur au format CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Télécharger CSV Complet ({totalTripsCount.toLocaleString('fr-FR')} trajets)</span>
        </button>
      )}
    </div>
  );
};
