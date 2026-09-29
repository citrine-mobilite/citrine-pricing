import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DataTablePaginationProps {
  totalCount: number;
  clampedPage: number;
  pageSize: number;
  totalPages: number;
  pageSizeOptions: number[];
  onPageSizeChange: (newSize: number) => void;
  onPageChange: (newPage: number) => void;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  totalCount,
  clampedPage,
  pageSize,
  totalPages,
  pageSizeOptions,
  onPageSizeChange,
  onPageChange
}) => {
  return (
    <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-white">
      {/* Left: Total counts & Page size selector */}
      <div className="flex items-center gap-3">
        <span>
          {totalCount === 0 ? (
            '0 résultat'
          ) : (
            <>
              Affichage de{' '}
              <strong className="font-semibold text-slate-700">
                {(clampedPage - 1) * pageSize + 1}
              </strong>{' '}
              à{' '}
              <strong className="font-semibold text-slate-700">
                {Math.min(clampedPage * pageSize, totalCount)}
              </strong>{' '}
              sur{' '}
              <strong className="font-semibold text-slate-700">
                {totalCount.toLocaleString('fr-FR')}
              </strong>{' '}
              {totalCount > 1 ? 'enregistrements' : 'enregistrement'}
            </>
          )}
        </span>

        <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
          <span className="text-[11px] text-slate-400">Par page :</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-[#3D8B85]"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt >= 999999 ? "Tous (Tout afficher)" : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Page navigation */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={clampedPage <= 1}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Première page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(Math.max(clampedPage - 1, 1))}
          disabled={clampedPage <= 1}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1 font-medium text-xs text-slate-700">
          Page {clampedPage} sur {totalPages}
        </span>

        <button
          onClick={() => onPageChange(Math.min(clampedPage + 1, totalPages))}
          disabled={clampedPage >= totalPages}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={clampedPage >= totalPages}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Dernière page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
