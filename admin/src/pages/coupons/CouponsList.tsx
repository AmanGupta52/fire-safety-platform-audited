import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Coupon } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';

interface FormValues {
  code: string; discountType: 'percentage' | 'fixed'; discountValue: number;
  minimumOrder?: number; maximumDiscount?: number; startDate: string; endDate: string;
  usageLimit?: number; perUserLimit?: number;
}

export default function CouponsList() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => (await api.get('/coupons')).data.data as Coupon[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => { toast.success('Coupon deleted'); queryClient.invalidateQueries({ queryKey: ['coupons'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<Coupon>[] = [
    { header: 'Code', render: (c) => <span className="font-medium text-ink">{c.code}</span> },
    { header: 'Discount', render: (c) => c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}` },
    { header: 'Min. order', render: (c) => `₹${c.minimumOrder.toLocaleString('en-IN')}` },
    { header: 'Usage', render: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` },
    { header: 'Valid until', render: (c) => format(new Date(c.endDate), 'd MMM yyyy') },
    { header: 'Status', render: (c) => <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '', className: 'text-right',
      render: (c) => (
        <button onClick={() => { if (confirm(`Delete coupon ${c.code}?`)) deleteMutation.mutate(c._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Coupons" description="Percentage and fixed-value discount codes for checkout." actions={<Button onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Add coupon</Button>} />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(c) => c._id} isLoading={isLoading} emptyIcon={Ticket} emptyTitle="No coupons yet" />
      </Card>
      {showForm && <CouponForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CouponForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { discountType: 'percentage' } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => api.post('/coupons', values),
    onSuccess: () => { toast.success('Coupon created'); queryClient.invalidateQueries({ queryKey: ['coupons'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title="Add coupon">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Coupon code" required placeholder="e.g. WELCOME10" {...register('code')} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Discount type" options={[{ label: 'Percentage', value: 'percentage' }, { label: 'Fixed amount', value: 'fixed' }]} {...register('discountType')} />
          <Input label="Discount value" type="number" required {...register('discountValue')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Minimum order (₹)" type="number" {...register('minimumOrder')} />
          <Input label="Max discount cap (₹)" type="number" {...register('maximumDiscount')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start date" type="date" required {...register('startDate')} />
          <Input label="End date" type="date" required {...register('endDate')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Total usage limit" type="number" {...register('usageLimit')} />
          <Input label="Per-user limit" type="number" {...register('perUserLimit')} />
        </div>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create coupon</Button>
        </div>
      </form>
    </Modal>
  );
}
