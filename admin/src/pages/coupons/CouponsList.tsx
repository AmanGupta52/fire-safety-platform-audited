import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, toastApiError } from '../../lib/apiClient';
import { Coupon } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { formatInr, formatDate } from '../../lib/format';

interface FormValues {
  code: string; discountType: 'percentage' | 'fixed'; discountValue: number;
  minimumOrder?: number; maximumDiscount?: number; startDate: string; endDate: string;
  usageLimit?: number; perUserLimit?: number; isActive?: boolean;
}

export default function CouponsList() {
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => (await api.get('/coupons')).data.data as Coupon[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => { toast.success('Coupon deleted'); queryClient.invalidateQueries({ queryKey: ['coupons'] }); },
    onError: toastApiError
  });

  // Quick toggle for "deactivate this coupon early" without opening the full edit form —
  // previously the only way to do this at all was delete-and-lose-history.
  const toggleActiveMutation = useMutation({
    mutationFn: async (c: Coupon) => api.put(`/coupons/${c._id}`, { isActive: !c.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons'] }),
    onError: toastApiError
  });

  const columns: Column<Coupon>[] = [
    { header: 'Code', render: (c) => <span className="font-medium text-ink">{c.code}</span> },
    { header: 'Discount', render: (c) => c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}` },
    { header: 'Min. order', render: (c) => formatInr(c.minimumOrder, 2) },
    { header: 'Usage', render: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` },
    { header: 'Valid until', render: (c) => formatDate(c.endDate) },
    {
      header: 'Status',
      render: (c) => (
        <button disabled={toggleActiveMutation.isPending} onClick={() => toggleActiveMutation.mutate(c)} title="Click to toggle">
          <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
        </button>
      )
    },
    {
      header: '', className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button aria-label="Edit" onClick={() => setEditing(c)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
          <button aria-label="Delete" disabled={deleteMutation.isPending} onClick={() => { if (confirm(`Delete coupon ${c.code}?`)) deleteMutation.mutate(c._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Coupons" description="Percentage and fixed-value discount codes for checkout." actions={<Button onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add coupon</Button>} />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(c) => c._id} isLoading={isLoading} emptyIcon={Ticket} emptyTitle="No coupons yet" />
      </Card>
      {editing && <CouponForm coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function toDateInput(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10);
}

function CouponForm({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(coupon);
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: coupon
      ? {
          code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue,
          minimumOrder: coupon.minimumOrder, maximumDiscount: coupon.maximumDiscount,
          startDate: toDateInput(coupon.startDate), endDate: toDateInput(coupon.endDate),
          usageLimit: coupon.usageLimit, perUserLimit: coupon.perUserLimit, isActive: coupon.isActive
        }
      : { discountType: 'percentage', isActive: true }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (isEdit && coupon ? api.put(`/coupons/${coupon._id}`, values) : api.post('/coupons', values)),
    onSuccess: () => { toast.success(isEdit ? 'Coupon updated' : 'Coupon created'); queryClient.invalidateQueries({ queryKey: ['coupons'] }); onClose(); },
    onError: toastApiError
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${coupon?.code}` : 'Add coupon'}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Coupon code" required placeholder="e.g. WELCOME10" {...register('code')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Discount type" options={[{ label: 'Percentage', value: 'percentage' }, { label: 'Fixed amount', value: 'fixed' }]} {...register('discountType')} />
          <Input label="Discount value" type="number" required {...register('discountValue')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Minimum order (₹)" type="number" {...register('minimumOrder')} />
          <Input label="Max discount cap (₹)" type="number" {...register('maximumDiscount')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Start date" type="date" required {...register('startDate')} />
          <Input label="End date" type="date" required {...register('endDate')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Total usage limit" type="number" {...register('usageLimit')} />
          <Input label="Per-user limit" type="number" {...register('perUserLimit')} />
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register('isActive')} /> Active
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create coupon'}</Button>
        </div>
      </form>
    </Modal>
  );
}
