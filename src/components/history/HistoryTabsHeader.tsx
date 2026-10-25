import React from 'react';
import { History, Download, FileSpreadsheet } from 'lucide-react';

interface HistoryTabsHeaderProps {
  activeSubTab: 'campaigns' | 'consolidation';
  onTabChange: (tab: 'campaigns' | 'consolidation') => void;
  campaignsCount: number;
}

export const HistoryTabsHeader: React.FC<HistoryTabsHeaderProps> = ({
  activeSubTab,
  onTabChange,
  campaignsCount
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <Download className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Centre de Téléchargement & Rapports
          </h1>
          <p className="text-xs text-slate-500">
            Exportation, bilans consolidés et téléchargement des relevés tarifaires
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
        <button
          onClick={() => onTabChange('campaigns')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === 'campaigns'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>Campagnes ({campaignsCount})</span>
        </button>

        <button
          onClick={() => onTabChange('consolidation')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === 'consolidation'
              ? 'bg-white text-emerald-900 shadow-xs font-bold border border-emerald-300/40 bg-emerald-50/60'
              : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50/40'
          }`}
          title="Télécharger des rapports consolidés en Excel ou PDF"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span>Télécharger & Consolider</span>
          <span className="ml-1 px-1.5 py-0.2 text-[9px] font-bold bg-emerald-600 text-white rounded-full">
            Excel / PDF
          </span>
        </button>
      </div>
    </div>
  );
};
