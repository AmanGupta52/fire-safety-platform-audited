import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Search, Pencil, Trash2, RotateCcw, ArrowUp, ArrowDown, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Service, ServiceImage } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select, Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import ServiceFormModal from './ServiceFormModal';

const CATEGORY_OPTIONS = [
  { label: 'All Categories', value: '' },
  { label: 'Installation', value: 'installation' },
  { label: 'Refilling', value: 'refilling' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Fire Safety Audit', value: 'audit' },
  { label: 'AMC Plans', value: 'amc' },
  { label: 'Repair', value: 'repair' },
  { label: 'Other', value: 'other' }
];

// Service catalog only (what customers can book). Customer bookings are managed on the
// separate Bookings page, and product purchases on Orders.
export default function ServicesList() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = user?.role === 'super_admin' || hasPermission('services.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editingService, setEditingService] = useState<Service | 'new' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-services', search, category, includeDeleted],
    queryFn: async () => {
      const res = await api.get('/services/admin/catalog', {
        params: {
          search: search || undefined,
          category: category || undefined,
          includeDeleted: includeDeleted ? 'true' : 'false',
          limit: 100
        }
      });
      return res.data.data as Service[];
    }
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/services/catalog/${id}/status`, { isActive }),
    onSuccess: () => {
      toast.success('Service status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/services/catalog/${id}/status`, { isPublished }),
    onSuccess: () => {
      toast.success('Publish status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const featureMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      api.patch(`/services/catalog/${id}/status`, { isFeatured }),
    onSuccess: () => {
      toast.success('Featured status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/services/catalog/${id}`),
    onSuccess: () => {
      toast.success('Service soft-deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/services/catalog/${id}/restore`),
    onSuccess: () => {
      toast.success('Service restored');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const reorderMutation = useMutation({
    mutationFn: async (orders: { id: string; displayOrder: number }[]) =>
      api.put('/services/catalog/reorder', { items: orders }),
    onSuccess: () => {
      toast.success('Order saved');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  function handleMove(index: number, direction: 'up' | 'down') {
    if (!data) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= data.length) return;

    const currentItem = data[index];
    const targetItem = data[targetIndex];

    const newOrders = [
      { id: currentItem._id, displayOrder: targetItem.displayOrder ?? targetIndex },
      { id: targetItem._id, displayOrder: currentItem.displayOrder ?? index }
    ];

    reorderMutation.mutate(newOrders);
  }

  const columns: Column<Service>[] = [
    {
      header: 'Service',
      render: (s) => {
        const imgUrl = typeof s.image === 'string' ? s.image : (s.image as ServiceImage)?.url;
        return (
          <div className="flex items-center gap-3">
            {imgUrl ? (
              <img src={imgUrl} alt={s.name} className="h-10 w-10 rounded border border-line object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-paper text-slateink">
                <Wrench className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="font-medium text-ink">{s.name}</p>
              <p className="text-xs text-slateink font-mono">{s.slug}</p>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Category',
      render: (s) => <Badge tone="neutral">{s.category}</Badge>
    },
    {
      header: 'Starting Price',
      render: (s) => (
        <span className="font-medium text-ink">
          ₹{s.startingPrice?.toLocaleString('en-IN')} <span className="text-xs text-slateink font-normal">{s.priceUnit}</span>
        </span>
      )
    },
    {
      header: 'Order',
      render: (s) => {
        const index = data ? data.findIndex((item) => item._id === s._id) : 0;
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-5 text-center text-xs font-mono text-slateink">{s.displayOrder ?? index}</span>
            {canManage && (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMove(index, 'up')}
                  disabled={index === 0}
                  className="rounded p-0.5 text-slateink hover:bg-paper disabled:opacity-30"
                  title="Move Up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 'down')}
                  disabled={!data || index === data.length - 1}
                  className="rounded p-0.5 text-slateink hover:bg-paper disabled:opacity-30"
                  title="Move Down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Active',
      render: (s) => (
        <button
          type="button"
          disabled={!canManage || s.isDeleted}
          onClick={() => activateMutation.mutate({ id: s._id, isActive: !s.isActive })}
          className="focus:outline-none"
          title={s.isActive ? 'Active (Click to deactivate)' : 'Inactive (Click to activate)'}
        >
          <Badge tone={s.isActive ? 'success' : 'neutral'}>
            {s.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      )
    },
    {
      header: 'Published',
      render: (s) => (
        <button
          type="button"
          disabled={!canManage || s.isDeleted}
          onClick={() => publishMutation.mutate({ id: s._id, isPublished: !s.isPublished })}
          className="focus:outline-none"
          title={s.isPublished ? 'Published (Click to unpublish)' : 'Unpublished (Click to publish)'}
        >
          <Badge tone={s.isPublished ? 'info' : 'neutral'}>
            {s.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </button>
      )
    },
    {
      header: 'Featured',
      render: (s) => (
        <button
          type="button"
          disabled={!canManage || s.isDeleted}
          onClick={() => featureMutation.mutate({ id: s._id, isFeatured: !s.isFeatured })}
          className="rounded p-1 text-slateink hover:bg-paper focus:outline-none"
          title={s.isFeatured ? 'Featured (Click to unfeature)' : 'Not featured (Click to feature)'}
        >
          <Star className={clsx('h-4 w-4', s.isFeatured ? 'fill-amber text-amber' : 'text-slate-300')} />
        </button>
      )
    },
    {
      header: 'Status',
      render: (s) => (
        s.isDeleted ? (
          <Badge tone="danger">Deleted</Badge>
        ) : (
          <Badge tone="success">Live</Badge>
        )
      )
    },
    {
      header: '',
      render: (s) => (
        <div className="flex justify-end gap-1">
          {canManage && (
            <button
              onClick={() => setEditingService(s)}
              className="rounded p-1.5 text-slateink hover:bg-paper"
              aria-label="Edit"
              title="Edit service"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canManage && (
            s.isDeleted ? (
              <button
                onClick={() => restoreMutation.mutate(s._id)}
                className="rounded p-1.5 text-forest hover:bg-forest-light"
                aria-label="Restore"
                title="Restore service"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to deactivate and remove "${s.name}" from public listing?`)) {
                    deleteMutation.mutate(s._id);
                  }
                }}
                className="rounded p-1.5 text-brand hover:bg-brand-light"
                aria-label="Delete"
                title="Soft delete service"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      ),
      className: 'text-right'
    }
  ];

  return (
    <div>
      <PageHeader
        title="Services"
        description="Manage the public service catalog customers can book. Bookings they place appear on the Bookings page."
      />
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateink" />
            <Input
              placeholder="Search catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            className="w-44"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-slateink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded border-line text-brand focus:ring-brand"
            />
            Show Deleted
          </label>
        </div>

        {canManage && (
          <Button onClick={() => setEditingService('new')}>
            <Plus className="h-3.5 w-3.5" /> Add Service
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data || []}
        rowKey={(s) => s._id}
        isLoading={isLoading}
        emptyIcon={Wrench}
        emptyTitle="No services in catalog"
        emptyDescription="Create your first fire protection service to display on the client storefront."
      />

      {editingService && (
        <ServiceFormModal
          service={editingService === 'new' ? null : editingService}
          onClose={() => setEditingService(null)}
        />
      )}
    </Card>
    </div>
  );
}
