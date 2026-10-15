import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Check, Loader2, PackageSearch, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/apiClient';
import { formatInr } from '../../lib/format';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ProductSearchHit } from '../../types';
import { ImageWithFallback } from '../ui/ImageWithFallback';

const PAGE_SIZE = 8;

interface SearchPage {
  items: ProductSearchHit[];
  meta: { page: number; totalPages: number; total: number };
}

interface ProductSearchBoxProps {
  /** "navbar": pill-shaped, for the header. "field": a normal form input. */
  variant?: 'navbar' | 'field';
  /** "popover": results float under the input. "inline": results sit in the page flow (for overlays that clip popovers). */
  mode?: 'popover' | 'inline';
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  /** Press "/" anywhere on the page to jump into this box (header search only). */
  focusShortcut?: boolean;
  /** Called when a product is chosen (click, or Enter on the highlighted row). */
  onSelect: (product: ProductSearchHit) => void;
  /** If given, Enter on plain text (and the "see all results" row) calls this with the typed query. */
  onSubmitQuery?: (query: string) => void;
  /** Products already chosen elsewhere get a tick in the list. */
  selectedIds?: string[];
  /** Empty the box after a choice (the header does; a picker usually does not need to). */
  clearOnSelect?: boolean;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps every typed word found in `text` in <mark>, so people can see why a row matched. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'ig');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="rounded-sm bg-amber-light px-0.5 text-ink">{part}</mark>
          : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  );
}

function StockLabel({ product }: { product: ProductSearchHit }) {
  if (product.stock > 0) return <span className="text-[11px] font-medium text-forest">In stock</span>;
  if (product.allowBackorder) return <span className="text-[11px] font-medium text-amber">On request</span>;
  return <span className="text-[11px] font-medium text-safety">Out of stock</span>;
}

function ResultRow({
  product, words, active, chosen, id, onPick, onHover
}: {
  product: ProductSearchHit; words: string[]; active: boolean; chosen: boolean; id: string; onPick: () => void; onHover: () => void;
}) {
  const unitPrice = product.discountPrice ?? product.price;
  const hasDiscount = product.discountPrice !== undefined && product.discountPrice < product.price;
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      // mousedown (not click) so the input keeps focus and the dropdown doesn't close before the choice registers
      onMouseDown={(e) => { e.preventDefault(); onPick(); }}
      onMouseMove={onHover}
      className={clsx('flex cursor-pointer items-center gap-3 px-3 py-2.5', active ? 'bg-paper' : 'bg-card')}
    >
      <ImageWithFallback
        src={product.image}
        alt=""
        className="h-12 w-12 shrink-0 overflow-hidden rounded border border-line bg-white"
        imgClassName="object-contain p-0.5"
        fallbackLabel=""
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink"><Highlight text={product.name} words={words} /></p>
        <p className="mt-0.5 truncate text-xs text-slateink">
          <Highlight text={product.sku} words={words} />
          {product.brand ? <> · <Highlight text={product.brand} words={words} /></> : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-ink">{formatInr(unitPrice)}</p>
        {hasDiscount && <p className="text-[11px] text-slateink line-through">{formatInr(product.price)}</p>}
        <StockLabel product={product} />
      </div>
      {chosen && <Check className="h-4 w-4 shrink-0 text-forest" aria-label="Already added" />}
    </li>
  );
}

/**
 * Product search with live suggestions, used by the header and the quote form.
 *  - Waits for a short pause in typing, then asks the server (partial words, SKU and brand all match; best match first).
 *  - Handles big catalogs: shows 8 at a time and loads the next 8 as you scroll (or press "Show more").
 *  - Keyboard: ↑ ↓ to move, Enter to choose, Esc to close. Screen readers get the standard combobox/listbox markup.
 *  - Shows a picture, SKU, brand, price and stock for every result.
 */
export function ProductSearchBox({
  variant = 'field', mode = 'popover', placeholder = 'Search products by name, SKU or brand…', ariaLabel = 'Search products',
  autoFocus, focusShortcut, onSelect, onSubmitQuery, selectedIds = [], clearOnSelect
}: ProductSearchBoxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 250);
  const waitingForPause = trimmed !== debounced;

  const search = useInfiniteQuery({
    queryKey: ['product-search', debounced],
    queryFn: async ({ pageParam, signal }): Promise<SearchPage> => {
      const res = await api.get('/products/search', { params: { q: debounced, page: pageParam, limit: PAGE_SIZE }, signal });
      return { items: res.data.data as ProductSearchHit[], meta: res.data.meta as SearchPage['meta'] };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: open,
    staleTime: 60_000,
    // Keep the previous results on screen while the next ones load: no flashing between keystrokes.
    placeholderData: keepPreviousData
  });

  const items = useMemo(() => search.data?.pages.flatMap((p) => p.items) ?? [], [search.data]);
  const total = search.data?.pages[0]?.meta.total ?? 0;
  const words = useMemo(() => debounced.split(/\s+/).filter(Boolean), [debounced]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = search;

  // A new search starts at the top, with nothing highlighted.
  useEffect(() => { setActiveIndex(-1); }, [debounced]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keep the highlighted row visible while moving with the arrow keys.
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, baseId]);

  // "/" focuses the header search, like most large sites (ignored while typing in any field).
  useEffect(() => {
    if (!focusShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusShortcut]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function choose(product: ProductSearchHit) {
    onSelect(product);
    setOpen(false);
    setActiveIndex(-1);
    if (clearOnSelect) setQuery('');
  }

  function submitQuery() {
    if (!trimmed || !onSubmitQuery) return;
    onSubmitQuery(trimmed);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { setOpen(true); return; }
        if (activeIndex >= items.length - 1) { loadMore(); return; }
        setActiveIndex((i) => i + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.max(-1, i - 1));
        break;
      case 'Home':
        if (open && items.length > 0 && activeIndex >= 0) { e.preventDefault(); setActiveIndex(0); }
        break;
      case 'End':
        if (open && items.length > 0 && activeIndex >= 0) { e.preventDefault(); setActiveIndex(items.length - 1); }
        break;
      case 'Enter':
        e.preventDefault();
        if (open && activeIndex >= 0 && items[activeIndex]) choose(items[activeIndex]);
        else submitQuery();
        break;
      case 'Escape':
        if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  const showEmpty = open && !search.isPending && !search.isError && items.length === 0 && trimmed.length > 0 && !waitingForPause;
  const busy = search.isFetching || waitingForPause;

  const panel = open && (
    <div
      className={clsx(
        'overflow-hidden rounded-card border border-line bg-card',
        mode === 'popover' ? 'absolute left-0 top-full z-50 mt-2 w-[min(34rem,calc(100vw-2rem))] shadow-raised' : 'mt-3',
        variant === 'field' && mode === 'popover' && 'w-full'
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs text-slateink">
        <span>{trimmed ? (search.isPending ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`) : 'Popular products'}</span>
        {busy && !search.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Updating results" />}
      </div>

      {search.isPending && (
        <div className="divide-y divide-line" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="flex items-center gap-3 px-3 py-2.5">
              <div className="h-12 w-12 animate-pulse rounded bg-slate-100" />
              <div className="flex-1 space-y-2"><div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" /></div>
            </div>
          ))}
        </div>
      )}

      {search.isError && (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-slateink">
          <p>We couldn't load results.</p>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); void search.refetch(); }} className="rounded-btn border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper">Try again</button>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
          <PackageSearch className="h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-ink">No products match “{trimmed}”</p>
          <p className="text-xs text-slateink">Try a shorter word, the model number (SKU) or the brand.</p>
        </div>
      )}

      {items.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Product results"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) loadMore();
          }}
          className={clsx('divide-y divide-line overflow-y-auto', mode === 'popover' ? 'max-h-[min(26rem,60vh)]' : 'max-h-[60vh]')}
        >
          {items.map((product, index) => (
            <ResultRow
              key={product._id}
              id={optionId(index)}
              product={product}
              words={words}
              active={index === activeIndex}
              chosen={selectedIds.includes(product._id)}
              onPick={() => choose(product)}
              onHover={() => setActiveIndex(index)}
            />
          ))}
          {hasNextPage && (
            <li role="presentation" className="bg-card">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); loadMore(); }}
                disabled={isFetchingNextPage}
                className="flex w-full items-center justify-center gap-2 px-3 py-3 text-xs font-medium text-safety hover:bg-paper disabled:text-slateink"
              >
                {isFetchingNextPage ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</> : `Show more (${Math.max(0, total - items.length)} more)`}
              </button>
            </li>
          )}
        </ul>
      )}

      {onSubmitQuery && trimmed && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); submitQuery(); }}
          className="flex w-full items-center gap-2 border-t border-line bg-paper px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-slate-100"
        >
          <Search className="h-4 w-4 text-slateink" aria-hidden="true" /> See all results for “{trimmed}”
        </button>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateink" aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={items.length > 0 ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        className={clsx(
          'w-full border border-line pl-10 pr-9 text-sm text-ink outline-none transition focus:border-ink',
          variant === 'navbar' ? 'rounded-pill bg-paper py-2.5 focus:bg-card' : 'rounded-btn bg-card py-2.5'
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(''); setOpen(true); inputRef.current?.focus(); }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slateink hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div aria-live="polite" className="sr-only">
        {open && trimmed && !search.isPending ? `${total} product${total === 1 ? '' : 's'} found` : ''}
      </div>
      {panel}
    </div>
  );
}
