import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Package, Plus, Search, Pencil, Trash2, PackageMinus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Product, Category } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import ProductForm from './ProductForm';

export default function ProductsList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const location = useLocation();
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('q');
    if (next !== null) setQ(next);
  }, [location.search]);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // /products?lowStock=true (linked from the Dashboard's "Low stock products" card) swaps
  // the normal paginated/search list for the dedicated low-stock endpoint — previously that
  // count had nothing to click through to.
  const lowStockOnly = searchParams.get('lowStock') === 'true';

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, q, lowStockOnly],
    queryFn: async () =>
      lowStockOnly
        ? { data: (await api.get('/products/low-stock')).data.data as Product[], meta: { totalPages: 1 } }
        : (await api.get('/products', { params: { page, limit: 20, q: q || undefined, includeInactive: true } })).data as {
            data: Product[]; meta: { totalPages: number };
          }
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => (await api.get('/categories?includeInactive=true')).data.data as Category[]
  });

  // Lets the Gallery page open straight into a specific product's edit form via
  // /products?open=<id>. The list above is paginated, so the product may not be on the
  // page currently loaded — fall back to fetching it directly by id when that happens.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    const clear = () => setSearchParams((prev) => { prev.delete('open'); return prev; }, { replace: true });

    const onCurrentPage = data?.data.find((p) => p._id === openId);
    if (onCurrentPage) {
      setEditing(onCurrentPage);
      clear();
      return;
    }
    if (!data) return; // wait for the current page to load before deciding it's not there

    api.get(`/products/admin/${openId}`)
      .then((res) => setEditing(res.data.data as Product))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(clear);
  }, [data, searchParams, setSearchParams]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Product deactivated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<Product>[] = [
    {
      header: 'Product',
      render: (p) => (
        <div>
          <p className="font-medium text-ink">{p.name}</p>
          <p className="text-xs text-slateink">SKU {p.sku}</p>
        </div>
      )
    },
    { header: 'Category', render: (p) => (categories?.find((c) => c._id === (typeof p.category === 'string' ? p.category : p.category._id))?.name || '—') },
    {
      header: 'Price',
      render: (p) => (
        <div>
          <p>₹{(p.discountPrice ?? p.price).toLocaleString('en-IN')}</p>
          {p.discountPrice && <p className="text-xs text-slateink line-through">₹{p.price.toLocaleString('en-IN')}</p>}
        </div>
      )
    },
    {
      header: 'Stock',
      render: (p) => <Badge tone={p.stock === 0 ? 'danger' : p.stock <= 5 ? 'warning' : 'neutral'}>{p.stock} {p.unit}</Badge>
    },
    { header: 'Status', render: (p) => <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1">
          {hasPermission('products.update') && (
            <button onClick={() => setAdjusting(p)} className="rounded p-1.5 text-slateink hover:bg-paper" aria-label="Adjust stock" title="Adjust stock">
              <PackageMinus className="h-3.5 w-3.5" />
            </button>
          )}
          {hasPermission('products.update') && (
            <button onClick={() => setEditing(p)} className="rounded p-1.5 text-slateink hover:bg-paper" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {hasPermission('products.delete') && (
            <button
              onClick={() => { if (confirm(`Deactivate "${p.name}"?`)) deleteMutation.mutate(p._id); }}
              className="rounded p-1.5 text-brand hover:bg-brand-light"
              aria-label="Deactivate"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
      className: 'text-right'
    }
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage the catalog customers see on the storefront."
        actions={
          hasPermission('products.create') && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" /> Add product
            </Button>
          )
        }
      />

      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          {lowStockOnly ? (
            <div className="flex items-center gap-2">
              <Badge tone="warning">Showing low-stock products only</Badge>
              <button
                onClick={() => setSearchParams((prev) => { prev.delete('lowStock'); return prev; })}
                className="flex items-center gap-1 text-xs font-medium text-slateink hover:text-ink"
              >
                <X className="h-3 w-3" /> Clear filter
              </button>
            </div>
          ) : (
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateink" />
              <Input
                placeholder="Search by name, SKU or brand..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyIcon={Package}
          emptyTitle={lowStockOnly ? 'Nothing low on stock right now' : 'No products yet'}
          emptyDescription={lowStockOnly ? undefined : 'Add your first fire-safety product to start building the catalog.'}
        />

        {!lowStockOnly && <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />}
      </Card>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories || []}
          onClose={() => setEditing(null)}
        />
      )}
      {adjusting && <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function AdjustStockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () => api.patch(`/products/${product._id}/stock`, { delta, reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Stock updated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`Adjust stock — ${product.name}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slateink">Current stock: <span className="font-medium text-ink">{product.stock} {product.unit}</span></p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setDelta((d) => d - 1)}>−</Button>
          <Input
            type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))}
            hint="Positive to add stock (e.g. new delivery), negative to remove (e.g. damage, correction)"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => setDelta((d) => d + 1)}>+</Button>
        </div>
        <p className="text-xs text-slateink">New stock will be <span className="font-medium text-ink">{product.stock + delta}</span> {product.unit}</p>
        <Input label="Reason (optional)" placeholder="e.g. Restock from supplier, damaged units" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()} loading={mutation.isPending}
            disabled={delta === 0 || product.stock + delta < 0}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
