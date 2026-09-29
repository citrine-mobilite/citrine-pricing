import React from 'react';
import { Search, FileSpreadsheet, FileText, Download, FileCode, X } from 'lucide-react';

interface DataTableHeaderProps {
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  totalCount: number;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportJson?: () => void;
  actions?: React.ReactNode;
}

export const DataTableHeader: React.FC<DataTableHeaderProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  totalCount,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportJson,
  actions
}) => {
  return (
    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3D8B85] focus:bg-white focus:ring-2 focus:ring-[#3D8B85]/20 transition"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right Buttons: Actions, Excel, CSV, JSON, PDF */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {actions}

        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

        <button
          onClick={onExportExcel}
          disabled={totalCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Exporter l'intégralité des ${totalCount.toLocaleString('fr-FR')} enregistrements au format Microsoft Excel (.xlsx)`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden md:inline">
            Excel {totalCount > 0 && `(${totalCount.toLocaleString('fr-FR')})`}
          </span>
        </button>

        <button
          onClick={onExportCsv}
          disabled={totalCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={`Exporter l'intégralité des ${totalCount.toLocaleString('fr-FR')} enregistrements au format CSV`}
        >
          <Download className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden md:inline">
            CSV {totalCount > 0 && `(${totalCount.toLocaleString('fr-FR')})`}
          </span>
        </button>

        {onExportJson && (
          <button
            onClick={onExportJson}
            disabled={totalCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-sm transition hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Exporter le JSON canonique ultra-léger (Départ, Arrivée, Prix par agrégateur et classe)"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden md:inline">JSON Léger</span>
          </button>
        )}

        <button
          onClick={onExportPdf}
          disabled={totalCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Générer un rapport PDF imprimable"
        >
          <FileText className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden md:inline">PDF</span>
        </button>
      </div>
    </div>
  );
};
