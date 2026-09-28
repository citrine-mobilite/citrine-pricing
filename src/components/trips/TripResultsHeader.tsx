import React from 'react';
import { PricingCampaign } from '../../types';
import { TableProperties, Download, Grid, List } from 'lucide-react';

interface TripResultsHeaderProps {
  campaigns: PricingCampaign[];
  currentCampaign?: PricingCampaign;
  onSelectCampaignId: (id: string) => void;
  viewMode: 'table' | 'matrix';
  onViewModeChange: (mode: 'table' | 'matrix') => void;
  onExportCsv: () => void;
}

export const TripResultsHeader: React.FC<TripResultsHeaderProps> = ({
  campaigns,
  currentCampaign,
  onSelectCampaignId,
  viewMode,
  onViewModeChange,
  onExportCsv
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <TableProperties className="w-5 h-5 text-[#1F4F4A]" />
          <span>Résultats Détaillés des Trajets & Matrice</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Analyse comparative des prix réels collectés pour chaque paire Origine ➔ Destination.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Campaign select */}
        <select
          value={currentCampaign?.id || ''}
          onChange={(e) => onSelectCampaignId(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#3D8B85]"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.cityName} - {new Date(c.startedAt).toLocaleDateString('fr-FR')} ({c.completedPairs} trajets)
            </option>
          ))}
        </select>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Vue Tableau"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tableau</span>
          </button>
          <button
            onClick={() => onViewModeChange('matrix')}
            className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'matrix' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Vue Matrice Origine x Destination"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Matrice</span>
          </button>
        </div>

        {/* CSV Export */}
        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F4F4A] bg-[#1F4F4A]/10 hover:bg-[#1F4F4A]/20 border border-[#1F4F4A]/30 rounded-lg transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exporter CSV</span>
        </button>
      </div>
    </div>
  );
};
