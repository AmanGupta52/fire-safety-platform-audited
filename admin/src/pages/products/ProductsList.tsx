import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Product, Category } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { useAuthStore } from '../../store/authStore';
import ProductForm from './ProductForm';

export default function ProductsList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, q],
    queryFn: async () =>
      (await api.get('/products', { params: { page, limit: 20, q: q || undefined, includeInactive: true } })).data as {
        data: Product[]; meta: { totalPages: number };
      }
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => (await api.get('/categories?includeInactive=true')).data.data as Category[]
  });

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
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateink" />
            <Input
              placeholder="Search by name, SKU or brand..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={data?.data || []}
          rowKey={(p) => p._id}
          isLoading={isLoading}
          emptyIcon={Package}
          emptyTitle="No products yet"
          emptyDescription="Add your first fire-safety product to start building the catalog."
        />

        <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />
      </Card>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories || []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
