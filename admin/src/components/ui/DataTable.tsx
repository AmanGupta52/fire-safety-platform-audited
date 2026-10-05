import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LucideIcon, ArrowUpDown, ArrowUp, ArrowDown, Download, Search, X } from 'lucide-react';
import { Spinner, EmptyState } from './Primitives';
import { Button } from './Button';

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  sortKey?: keyof T | ((row: T) => any);
  sortable?: boolean;
}

export interface BulkActionOption {
  label: string;
  action: string;
  tone?: 'primary' | 'danger' | 'neutral';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  rowAccentColor?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  // Enhanced Table Features
  enableSearch?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  enableExport?: boolean;
  exportFilename?: string;
  bulkActions?: BulkActionOption[];
  onBulkAction?: (action: string, selectedIds: string[]) => void;
}

// Escapes CSV cell to prevent formula injection & handle special characters
function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  // Neutralize formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  rowAccentColor,
  onRowClick,
  enableSearch = true,
  searchPlaceholder = 'Filter in current view...',
  searchFilter,
  enableExport = true,
  exportFilename = 'export',
  bulkActions = [],
  onBulkAction
}: DataTableProps<T>) {
  // Deep links such as /orders?q=ORD-1001 (from the Ctrl+K search) open the table already filtered.
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const location = useLocation();
  useEffect(() => {
    // Ctrl+K while already on this page changes only the query string; the table stays mounted, so follow it.
    const q = new URLSearchParams(location.search).get('q');
    if (q !== null) setSearchQuery(q);
  }, [location.search]);
  const [sortHeader, setSortHeader] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. Search filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();

    return rows.filter((row) => {
      if (searchFilter) {
        return searchFilter(row, q);
      }
      // Default heuristic: search across common fields or row keys
      for (const col of columns) {
        if (col.sortKey && typeof col.sortKey === 'string') {
          const val = (row as any)[col.sortKey];
          if (val !== undefined && val !== null && String(val).toLowerCase().includes(q)) {
            return true;
          }
        }
      }
      return JSON.stringify(row).toLowerCase().includes(q);
    });
  }, [rows, searchQuery, searchFilter, columns]);

  // 2. Sorting
  const sortedRows = useMemo(() => {
    if (!sortHeader || !sortDirection) return filteredRows;

    const targetCol = columns.find((c) => c.header === sortHeader);
    if (!targetCol) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (typeof targetCol.sortKey === 'function') {
        valA = targetCol.sortKey(a);
        valB = targetCol.sortKey(b);
      } else if (targetCol.sortKey) {
        valA = (a as any)[targetCol.sortKey];
        valB = (b as any)[targetCol.sortKey];
      } else {
        valA = (a as any)[targetCol.header.toLowerCase()];
        valB = (b as any)[targetCol.header.toLowerCase()];
      }

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredRows, sortHeader, sortDirection, columns]);

  const handleHeaderClick = (col: Column<T>) => {
    const isSortable = col.sortable ?? Boolean(col.sortKey);
    if (!isSortable) return;

    if (sortHeader !== col.header) {
      setSortHeader(col.header);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortHeader(null);
      setSortDirection(null);
    }
  };

  // 3. Selection & Master Checkbox
  const allVisibleKeys = useMemo(() => sortedRows.map((r) => rowKey(r)), [sortedRows, rowKey]);
  const isAllSelected = allVisibleKeys.length > 0 && allVisibleKeys.every((k) => selectedIds.has(k));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleKeys));
    }
  };

  const toggleSelectRow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // 4. CSV Export
  const handleExportCsv = () => {
    const exportableCols = columns.filter((c) => c.header && c.header !== 'Actions');
    const headerRow = exportableCols.map((c) => sanitizeCsvValue(c.header)).join(',');

    const rowsToExport = selectedIds.size > 0
      ? sortedRows.filter((r) => selectedIds.has(rowKey(r)))
      : sortedRows;

    const dataLines = rowsToExport.map((row) => {
      return exportableCols.map((col) => {
        let val: any;
        if (typeof col.sortKey === 'function') {
          val = col.sortKey(row);
        } else if (col.sortKey) {
          val = (row as any)[col.sortKey];
        } else {
          val = (row as any)[col.header.toLowerCase()];
        }
        return sanitizeCsvValue(val);
      }).join(',');
    });

    const csvContent = [headerRow, ...dataLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFilename}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <Spinner />;
  if (rows.length === 0) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;

  const hasBulkFeatures = bulkActions.length > 0 || Boolean(onBulkAction);

  return (
    <div className="flex flex-col gap-3">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {enableSearch ? (
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateink" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-line bg-paper py-1.5 pl-8 pr-7 text-xs text-ink placeholder:text-slateink/60 focus:border-brand focus:bg-card focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slateink hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : <div />}

        <div className="flex items-center gap-2">
          {enableExport && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 text-xs text-slateink hover:text-ink"
            >
              <Download className="h-3.5 w-3.5" />
              Export {selectedIds.size > 0 ? `(${selectedIds.size}) CSV` : 'CSV'}
            </Button>
          )}
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-brand/20 bg-brand/5 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-ink font-semibold">
            <span>{selectedIds.size} row{selectedIds.size > 1 ? 's' : ''} selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] font-normal text-slateink hover:underline"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            {bulkActions.map((ba) => (
              <Button
                key={ba.action}
                size="sm"
                variant={ba.tone === 'danger' ? 'danger' : ba.tone === 'primary' ? 'primary' : 'ghost'}
                onClick={() => onBulkAction?.(ba.action, Array.from(selectedIds))}
              >
                {ba.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Table Container with Sticky Header */}
      <div className="max-h-[72vh] overflow-auto rounded-lg border border-line bg-card shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-line shadow-sm">
            <tr className="text-left">
              {hasBulkFeatures && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-line text-brand focus:ring-brand cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSortable = col.sortable ?? Boolean(col.sortKey);
                const isActive = sortHeader === col.header;

                return (
                  <th
                    key={col.header}
                    onClick={() => handleHeaderClick(col)}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slateink ${
                      isSortable ? 'cursor-pointer select-none hover:text-ink' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="text-slateink/60">
                          {isActive && sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-brand" />
                          ) : isActive && sortDirection === 'desc' ? (
                            <ArrowDown className="h-3 w-3 text-brand" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasBulkFeatures ? 1 : 0)} className="px-4 py-8 text-center text-xs text-slateink">
                  No records match your search filter.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedIds.has(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={`${
                      onRowClick ? 'cursor-pointer' : ''
                    } border-b border-line last:border-0 hover:bg-paper/70 transition-colors ${
                      isSelected ? 'bg-brand/5' : ''
                    }`}
                    style={rowAccentColor ? { boxShadow: `inset 3px 0 0 0 ${rowAccentColor(row) || 'transparent'}` } : undefined}
                  >
                    {hasBulkFeatures && (
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectRow(e as any, key)}
                          className="h-3.5 w-3.5 rounded border-line text-brand focus:ring-brand cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.header} className={`whitespace-nowrap px-4 py-3 text-ink ${col.className || ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
