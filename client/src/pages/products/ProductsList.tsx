import { useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/apiClient';
import { Product, Category } from '../../types';
import { ProductCard } from '../../components/product/ProductCard';
import { Select, Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/Primitives';
import { Pagination } from '../../components/ui/Modal';

const SORT_OPTIONS = [
  { label: 'Featured', value: 'featured' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Popularity', value: 'popularity' }
];

export default function ProductsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams<{ category?: string }>();
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState(searchParams.get('minPrice') || '');
  const [maxPriceInput, setMaxPriceInput] = useState(searchParams.get('maxPrice') || '');

  const category = routeParams.category || searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'featured';
  const q = searchParams.get('q') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';

  const { data: categories } = useQuery({
    queryKey: ['categories-nav'],
    queryFn: async () => (await api.get('/categories')).data.data as Category[]
  });

  const activeCategory = categories?.find((c) => c.slug === category);

  const { data, isLoading } = useQuery({
    queryKey: ['products-list', category, sort, q, page, minPrice, maxPrice, inStock],
    queryFn: async () =>
      (await api.get('/products', {
        params: {
          category: activeCategory?._id, sort, q: q || undefined, page, limit: 20,
          minPrice: minPrice || undefined, maxPrice: maxPrice || undefined,
          inStock: inStock || undefined
        }
      })).data as { data: Product[]; meta: { totalPages: number; total: number } },
    enabled: !category || Boolean(activeCategory)
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next);
    setPage(1);
  }

  function applyPriceRange() {
    const next = new URLSearchParams(searchParams);
    if (minPriceInput) next.set('minPrice', minPriceInput); else next.delete('minPrice');
    if (maxPriceInput) next.set('maxPrice', maxPriceInput); else next.delete('maxPrice');
    setSearchParams(next);
    setPage(1);
  }

  function clearAll() {
    setSearchParams({});
    setMinPriceInput('');
    setMaxPriceInput('');
    setPage(1);
  }

  const activeFilters = [
    category && activeCategory ? { key: 'category', label: activeCategory.name } : null,
    minPrice ? { key: 'minPrice', label: `Min ₹${minPrice}` } : null,
    maxPrice ? { key: 'maxPrice', label: `Max ₹${maxPrice}` } : null,
    inStock ? { key: 'inStock', label: 'In stock only' } : null
  ].filter(Boolean) as { key: string; label: string }[];

  const filterPanel = (
    <div className="flex flex-col gap-6">
      <div className="border-b border-line pb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Categories</p>
        <div className="flex flex-col gap-1">
          <button onClick={() => updateParam('category', '')} className={clsx('rounded-btn px-2 py-2 text-left text-sm', !category ? 'bg-ink text-white' : 'text-slateink hover:bg-white')}>
            All categories
          </button>
          {(categories || []).map((c) => (
            <button
              key={c._id} onClick={() => updateParam('category', c.slug)}
              className={clsx('rounded-btn px-2 py-2 text-left text-sm', category === c.slug ? 'bg-ink text-white' : 'text-slateink hover:bg-white')}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-line pb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Price</p>
        <div className="flex items-center gap-2">
          <Input placeholder="Min" type="number" min={0} value={minPriceInput} onChange={(e) => setMinPriceInput(e.target.value)} className="w-full" />
          <span className="text-slate-400">–</span>
          <Input placeholder="Max" type="number" min={0} value={maxPriceInput} onChange={(e) => setMaxPriceInput(e.target.value)} className="w-full" />
        </div>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={applyPriceRange}>Apply</Button>
      </div>

      <div className="pb-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Availability</p>
        <label className="flex cursor-pointer items-center gap-2 py-2 text-sm text-ink">
          <input type="checkbox" checked={inStock} onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')} className="h-4 w-4 accent-safety" />
          In stock only
        </label>
      </div>
    </div>
  );

  return (
    <div className="container-page py-8">
      <p className="text-sm text-slate-600">Home / Products</p>
      <div className="mb-6 mt-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="heading text-3xl text-ink">{activeCategory ? activeCategory.name : q ? `Search: "${q}"` : 'Products'}</h1>
          <p className="mt-1 text-sm text-slateink">{data?.meta ? `${data.meta.total} product${data.meta.total !== 1 ? 's' : ''} found` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
          </Button>
          <span className="hidden items-center gap-2 text-sm text-slateink sm:flex">Sort:</span>
          <Select className="w-52" value={sort} onChange={(e) => updateParam('sort', e.target.value)} options={SORT_OPTIONS} />
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span key={f.key} className="flex items-center gap-1.5 rounded-pill bg-slate-100 px-3 py-1 text-sm text-ink">
              {f.label}
              <button
                onClick={() => {
                  if (f.key === 'minPrice') setMinPriceInput('');
                  if (f.key === 'maxPrice') setMaxPriceInput('');
                  updateParam(f.key, '');
                }}
                aria-label={`Remove ${f.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="text-sm font-medium text-safety hover:underline">Clear all</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">{filterPanel}</aside>

        <div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
            </div>
          ) : !data?.data.length ? (
            <EmptyState icon={PackageSearch} title="No products found" description="Try a different category, price range or search term." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {data.data.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40 lg:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-card bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="heading text-sm">Filters</span>
              <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters"><X className="h-5 w-5" /></button>
            </div>
            {filterPanel}
            <Button fullWidth className="mt-4" onClick={() => setMobileFiltersOpen(false)}>Show results</Button>
          </div>
        </div>
      )}
    </div>
  );
}
