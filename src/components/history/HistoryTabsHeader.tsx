import React from 'react';
import { History, Layers, ShieldCheck } from 'lucide-react';

interface HistoryTabsHeaderProps {
  activeSubTab: 'campaigns' | 'consolidation' | 'audit';
  onTabChange: (tab: 'campaigns' | 'consolidation' | 'audit') => void;
  campaignsCount: number;
  auditCount: number;
}

export const HistoryTabsHeader: React.FC<HistoryTabsHeaderProps> = ({
  activeSubTab,
  onTabChange,
  campaignsCount,
  auditCount
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1F4F4A]/10 flex items-center justify-center text-[#1F4F4A] shrink-0">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Historique & Audit
          </h1>
          <p className="text-xs text-slate-500">
            Traçabilité des relevés tarifaires, rapports consolidés et journal d'audit
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
          <History className="w-3.5 h-3.5" />
          <span>Campagnes ({campaignsCount})</span>
        </button>

        <button
          onClick={() => onTabChange('consolidation')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === 'consolidation'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Consolidation Multi-Périodes</span>
        </button>

        <button
          onClick={() => onTabChange('audit')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Audit ({auditCount})</span>
        </button>
      </div>
    </div>
  );
};
