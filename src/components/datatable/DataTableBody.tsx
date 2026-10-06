import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Column } from './types';

interface DataTableBodyProps<T extends Record<string, any>> {
  columns: Column<T>[];
  paginatedData: T[];
  isLoading: boolean;
  emptyMessage: string;
  hasGroupedHeaders: boolean;
  sortKey: string | null;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
  rowClassName?: (item: T, index: number) => string;
}

export function DataTableBody<T extends Record<string, any>>({
  columns,
  paginatedData,
  isLoading,
  emptyMessage,
  hasGroupedHeaders,
  sortKey,
  sortOrder,
  onSort,
  rowClassName
}: DataTableBodyProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-700 border-collapse">
        <thead>
          {hasGroupedHeaders ? (
            <>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th rowSpan={2} className="py-3 px-4 text-left border-r border-slate-200/60 font-bold">Départ</th>
                <th rowSpan={2} className="py-3 px-4 text-left border-r border-slate-200/60 font-bold">Destination</th>
                <th rowSpan={2} className="py-3 px-4 text-right border-r border-slate-200/60 font-bold w-[60px]">Dist.</th>
                <th colSpan={4} className="py-2 px-2 text-center border-r border-slate-200 font-bold text-[#3D8B85] bg-slate-100/50">Yango</th>
                <th colSpan={4} className="py-2 px-2 text-center border-r border-slate-200 font-bold text-[#3D8B85] bg-slate-100/50">Hero Cab</th>
                <th colSpan={3} className="py-2 px-2 text-center border-r border-slate-200 font-bold text-[#3D8B85] bg-slate-100/50">Trip Master</th>
                <th rowSpan={2} className="py-3 px-4 text-center font-bold w-[50px]">Détails</th>
              </tr>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                {/* Yango */}
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('yango_eco')}>Éco</th>
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('yango_confort')}>Confort</th>
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('yango_confort_plus')}>Confort+</th>
                <th className="py-2 px-2 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('yango_moto')}>Moto</th>
                {/* Hero Cab */}
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('hero_eco')}>Éco</th>
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('hero_confort')}>Confort</th>
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('hero_suv')}>SUV</th>
                <th className="py-2 px-2 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('hero_per_km')}>PerKm</th>
                {/* Trip Master */}
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('tripmaster_eco')}>Éco</th>
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('tripmaster_confort')}>Confort</th>
                <th className="py-2 px-2 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100/40 hover:text-slate-900" onClick={() => onSort('tripmaster_moto')}>Moto</th>
              </tr>
            </>
          ) : (
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
                    onClick={() => col.sortable && onSort(col.key)}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 w-full ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      {col.headerRender ? col.headerRender() : <span>{col.label}</span>}
                      {col.sortable && (
                        <span className="text-slate-400 group-hover:text-slate-600 transition">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#3D8B85]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#3D8B85]" />
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
          )}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400 text-xs">
                <div className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#3D8B85] border-t-transparent rounded-full animate-spin" />
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
                className={`${rowClassName ? rowClassName(item, index) : 'hover:bg-slate-50/60'} transition-colors`}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    className={`py-3 px-4 ${
                      colIndex === 0
                        ? item.yangoUnavailable && item.jams
                          ? 'border-l-4 border-l-amber-500'
                          : item.yangoUnavailable
                          ? 'border-l-4 border-l-purple-600'
                          : item.jams
                          ? 'border-l-4 border-l-amber-500'
                          : 'border-l-4 border-l-transparent'
                        : ''
                    } ${
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
  );
}
