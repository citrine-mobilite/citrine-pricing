import React, { useState, useMemo } from 'react';
import { exportToExcel, exportToPdf, exportCanonicalJson } from '../utils/exportUtils';
import { Column, DataTableProps } from './datatable/types';
import { DataTableHeader } from './datatable/DataTableHeader';
import { DataTableBody } from './datatable/DataTableBody';
import { DataTablePagination } from './datatable/DataTablePagination';
import { DataTableInfiniteFooter } from './datatable/DataTableInfiniteFooter';

export type { Column, DataTableProps };

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Rechercher...',
  searchKeys,
  exportFileName = 'export',
  exportTitle = 'Rapport Citrine Pricing',
  exportSubtitle = '',
  pageSizeOptions = [10, 25, 50, 100, 250, 500, 999999],
  defaultPageSize = 25,
  defaultDisplayMode = 'pagination',
  emptyMessage = 'Aucune donnée disponible.',
  actions,
  isLoading = false,
  hasGroupedHeaders = false,
  rowClassName
}: DataTableProps<T>) {
  const [displayMode, setDisplayMode] = useState<'pagination' | 'infinite'>(defaultDisplayMode);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [infiniteVisibleCount, setInfiniteVisibleCount] = useState(50);
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

  // Pagination vs Infinite Slicing
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);

  const displayedData = useMemo(() => {
    if (displayMode === 'infinite') {
      return sortedData.slice(0, infiniteVisibleCount);
    }
    const startIndex = (clampedPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [displayMode, sortedData, clampedPage, pageSize, infiniteVisibleCount]);

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

  const handleExportExcel = () => {
    const exportColumns = columns.filter((col) => col.key !== 'source');
    const exportRows = sortedData.map((row) => {
      const obj: Record<string, any> = {};
      exportColumns.forEach((col) => {
        if (col.exportValue) {
          const val = col.exportValue(row);
          if (typeof val === 'string' && val.includes('<div')) {
            const textOnly = val
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .split(' ')
              .filter(v => v.length > 0 && v !== '/')
              .join(' / ');
            obj[col.label] = textOnly;
          } else {
            obj[col.label] = val;
          }
        } else {
          obj[col.label] = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '';
        }
      });
      return obj;
    });

    exportToExcel(exportRows, exportFileName, 'Données');
  };

  const handleExportCsv = () => {
    const exportColumns = columns.filter((col) => col.key !== 'source');
    const headers = exportColumns.map((col) => `"${col.label.replace(/"/g, '""')}"`);
    const rows = sortedData.map((row) => {
      return exportColumns.map((col) => {
        let val = col.exportValue ? col.exportValue(row) : (row as any)[col.key];
        if (val === undefined || val === null) val = '';
        if (typeof val === 'string' && val.includes('<div')) {
          val = val.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.join('\r\n')];
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${exportFileName || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    const exportColumns = columns.filter((col) => col.key !== 'source');
    const headers = exportColumns.map((c) => c.label);
    const rows = sortedData.map((row) =>
      exportColumns.map((col) => {
        if (col.exportValue) return col.exportValue(row);
        const val = row[col.key];
        return val !== undefined && val !== null ? val : '';
      })
    );

    exportToPdf(exportTitle, exportSubtitle, headers, rows, exportFileName);
  };

  const handleExportJson = () => {
    exportCanonicalJson(sortedData, exportFileName, exportTitle);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden transition-all">
      <DataTableHeader
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
          setInfiniteVisibleCount(50);
        }}
        searchPlaceholder={searchPlaceholder}
        totalCount={sortedData.length}
        displayMode={displayMode}
        onDisplayModeChange={(mode) => {
          setDisplayMode(mode);
          setCurrentPage(1);
          setInfiniteVisibleCount(50);
        }}
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onExportJson={handleExportJson}
        actions={actions}
      />

      <DataTableBody
        columns={columns}
        paginatedData={displayedData}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        hasGroupedHeaders={hasGroupedHeaders}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={handleSort}
        rowClassName={rowClassName}
      />

      {displayMode === 'pagination' ? (
        <DataTablePagination
          totalCount={sortedData.length}
          clampedPage={clampedPage}
          pageSize={pageSize}
          totalPages={totalPages}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          onPageChange={setCurrentPage}
        />
      ) : (
        <DataTableInfiniteFooter
          totalCount={sortedData.length}
          visibleCount={infiniteVisibleCount}
          onLoadMore={() => setInfiniteVisibleCount((prev) => Math.min(prev + 50, sortedData.length))}
          onLoadAll={() => setInfiniteVisibleCount(sortedData.length)}
          onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      )}
    </div>
  );
}
