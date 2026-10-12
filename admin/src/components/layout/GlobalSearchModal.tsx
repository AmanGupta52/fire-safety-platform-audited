import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingCart, User, Wrench, ArrowRight, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'Order' | 'Customer' | 'Booking' | 'Product';
  status: string;
  link: string;
}

interface SearchResponse {
  orders: SearchResultItem[];
  customers: SearchResultItem[];
  bookings: SearchResultItem[];
  products: SearchResultItem[];
}

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

/** One clickable search hit: title and subtitle, an optional status chip, and an arrow. */
function SearchResultRow({ item, showStatus, onSelect }: { item: SearchResultItem; showStatus?: boolean; onSelect: (link: string) => void }) {
  return (
    <button
      onClick={() => onSelect(item.link)}
      className="flex w-full items-center justify-between p-3 text-left hover:bg-card transition-colors"
    >
      <div>
        <p className="text-xs font-semibold text-ink">{item.title}</p>
        <p className="text-[11px] text-slateink">{item.subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {showStatus && (
          <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-medium text-slateink uppercase">
            {item.status.replace(/_/g, ' ')}
          </span>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-slateink" />
      </div>
    </button>
  );
}

/** A titled group of search hits (Orders, Customers, ...); renders nothing when the group is empty. */
function ResultGroup({
  icon: Icon, iconClass, title, items, onSelect, showStatus
}: {
  icon: typeof Search; iconClass: string; title: string; items: SearchResultItem[]; onSelect: (link: string) => void; showStatus?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slateink">
        <Icon className={`h-3.5 w-3.5 ${iconClass}`} /> {title} ({items.length})
      </p>
      <div className="divide-y divide-line rounded-lg border border-line bg-paper/50">
        {items.map((item) => <SearchResultRow key={item.id} item={item} showStatus={showStatus} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(focusTimer);
    }
    setQuery('');
    setResults(null);
  }, [open]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Each keystroke cancels the previous request, so a slow older answer can never overwrite a newer one, and
    // nothing updates state after the modal has closed.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/reports/global-search', { params: { q: query.trim() }, signal: controller.signal });
        if (!controller.signal.aborted) setResults(res.data.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(apiErrorMessage(err), { id: 'global-search-error' });
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const totalResults =
    (results?.orders.length || 0) +
    (results?.customers.length || 0) +
    (results?.bookings.length || 0) +
    (results?.products.length || 0);

  const handleSelect = (link: string) => {
    onClose();
    navigate(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="w-full max-w-2xl rounded-xl border border-line bg-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-line px-4 py-3">
          <Search className="h-5 w-5 text-slateink shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search orders, customers, bookings or products"
            placeholder="Search orders, customers, bookings, or products... (Esc to close)"
            className="w-full bg-transparent text-sm text-ink placeholder:text-slateink/60 focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand shrink-0" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="text-slateink hover:text-ink text-xs p-1"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline rounded bg-paper border border-line px-2 py-0.5 text-[11px] font-mono text-slateink">
              ESC
            </kbd>
          )}
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto p-4 flex flex-col gap-5">
          {!query || query.length < 2 ? (
            <div className="py-12 text-center text-xs text-slateink">
              <p className="font-semibold text-ink text-sm">Global Quick Search</p>
              <p className="mt-1">Type an order number, customer name, email, serial or SKU.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="rounded bg-paper px-2 py-1 text-[11px] border border-line">ORD-2026-0001</span>
                <span className="rounded bg-paper px-2 py-1 text-[11px] border border-line">SRV-1002</span>
                <span className="rounded bg-paper px-2 py-1 text-[11px] border border-line">Extinguisher</span>
                <span className="rounded bg-paper px-2 py-1 text-[11px] border border-line">Customer phone</span>
              </div>
            </div>
          ) : totalResults === 0 && !isLoading ? (
            <div className="py-12 text-center text-xs text-slateink">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {results && (
                <>
                  <ResultGroup icon={ShoppingCart} iconClass="text-brand" title="Orders" items={results.orders} onSelect={handleSelect} showStatus />
                  <ResultGroup icon={Wrench} iconClass="text-forest" title="Service Bookings" items={results.bookings} onSelect={handleSelect} showStatus />
                  <ResultGroup icon={User} iconClass="text-blue-600 dark:text-blue-400" title="Customers" items={results.customers} onSelect={handleSelect} />
                  <ResultGroup icon={Package} iconClass="text-amber-600 dark:text-amber-400" title="Products" items={results.products} onSelect={handleSelect} />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-line bg-paper/40 px-4 py-2 flex items-center justify-between text-[11px] text-slateink">
          <span>Navigate with mouse or keyboard</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
