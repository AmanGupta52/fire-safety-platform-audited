import { LucideIcon } from 'lucide-react';
import { Spinner } from './Primitives';
import { EmptyState } from './Primitives';

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
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
}

export function DataTable<T>({
  columns, rows, rowKey, isLoading, emptyIcon, emptyTitle, emptyDescription, rowAccentColor, onRowClick
}: DataTableProps<T>) {
  if (isLoading) return <Spinner />;
  if (rows.length === 0) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((col) => (
              <th key={col.header} className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slateink">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer border-b border-line last:border-0 hover:bg-paper/70' : 'border-b border-line last:border-0'}
              style={rowAccentColor ? { boxShadow: `inset 3px 0 0 0 ${rowAccentColor(row) || 'transparent'}` } : undefined}
            >
              {columns.map((col) => (
                <td key={col.header} className={`whitespace-nowrap px-4 py-3 text-ink ${col.className || ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
