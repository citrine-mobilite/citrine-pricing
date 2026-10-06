import React from 'react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  exportValue?: (item: T) => string | number;
}

export interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  exportFileName?: string;
  exportTitle?: string;
  exportSubtitle?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  defaultDisplayMode?: 'pagination' | 'infinite';
  emptyMessage?: string;
  actions?: React.ReactNode;
  isLoading?: boolean;
  hasGroupedHeaders?: boolean;
  rowClassName?: (item: T, index: number) => string;
}
