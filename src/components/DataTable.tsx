import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileText,
  X
} from 'lucide-react';
import { exportToExcel, exportToPdf } from '../utils/exportUtils';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
  exportValue?: (item: T) => string | number;
}

interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  exportFileName?: string;
  exportTitle?: string;
  exportSubtitle?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyMessage?: string;
  actions?: React.ReactNode;
  isLoading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Rechercher...',
  searchKeys,
  exportFileName = 'export',
  exportTitle = 'Rapport Citrine Pricing',
  exportSubtitle = '',
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  emptyMessage = 'Aucune donnée disponible.',
  actions,
  isLoading = false
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();

    return data.filter((item) => {
      if (searchKeys && searchKeys.length > 0) {
        return searchKeys.some((k) => {
          const val = item[k];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        });
      }
      return Object.values(item).some(
        (val) => val !== undefined && val !== null && String(val).toLowerCase().includes(q)
      );
    });
  }, [data, search, searchKeys]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedData = useMemo(() => {
    const startIndex = (clampedPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, clampedPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Handlers for export
  const handleExportExcel = () => {
    // Generate clean flat objects using column definitions
    const exportRows = sortedData.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        if (col.exportValue) {
          obj[col.label] = col.exportValue(row);
        } else {
          obj[col.label] = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '';
        }
      });
      return obj;
    });

    exportToExcel(exportRows, exportFileName, 'Données');
  };

  const handleExportPdf = () => {
    const headers = columns.map((c) => c.label);
    const rows = sortedData.map((row) =>
      columns.map((col) => {
        if (col.exportValue) return col.exportValue(row);
        const val = row[col.key];
        return val !== undefined && val !== null ? val : '';
      })
    );

    exportToPdf(exportTitle, exportSubtitle, headers, rows, exportFileName);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden transition-all">
      {/* Top Bar: Search, Exports, and Custom Actions */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-600 focus:bg-white focus:ring-1 focus:ring-amber-500/20 transition"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Buttons: Actions, Excel, PDF */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {actions}

          <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          {/* Excel Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={sortedData.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Exporter directement au format Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">Excel (.xlsx)</span>
          </button>

          {/* PDF Export Button */}
          <button
            onClick={handleExportPdf}
            disabled={sortedData.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Générer un rapport PDF imprimable"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden md:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`py-3 px-4 select-none ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.sortable ? 'cursor-pointer hover:text-slate-900 group' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="text-slate-400 group-hover:text-slate-600 transition">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-amber-600" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-amber-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-80" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400 text-xs">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <span>Chargement des données...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400 text-xs">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={item.id || index}
                  className="hover:bg-amber-50/20 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-4 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(item, index) : item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer & Pagination Controls */}
      <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-white">
        {/* Left: Total counts & Page size selector */}
        <div className="flex items-center gap-3">
          <span>
            {sortedData.length === 0 ? (
              '0 résultat'
            ) : (
              <>
                Affichage de{' '}
                <strong className="font-semibold text-slate-700">
                  {(clampedPage - 1) * pageSize + 1}
                </strong>{' '}
                à{' '}
                <strong className="font-semibold text-slate-700">
                  {Math.min(clampedPage * pageSize, sortedData.length)}
                </strong>{' '}
                sur{' '}
                <strong className="font-semibold text-slate-700">
                  {sortedData.length}
                </strong>{' '}
                {sortedData.length > 1 ? 'enregistrements' : 'enregistrement'}
              </>
            )}
          </span>

          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
            <span className="text-[11px] text-slate-400">Par page :</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Page navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={clampedPage <= 1}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Première page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
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
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={clampedPage >= totalPages}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={clampedPage >= totalPages}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Dernière page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
