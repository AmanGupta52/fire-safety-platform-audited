import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from './Button';

export function Modal({ open, onClose, title, children, width = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6 pt-16">
      <div className={`w-full ${widths[width]} rounded-lg border border-line bg-white shadow-popover`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="heading text-base text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slateink hover:bg-paper"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-3.5 w-3.5" /> Prev
      </Button>
      <span className="text-xs text-slateink">Page {page} of {totalPages}</span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
