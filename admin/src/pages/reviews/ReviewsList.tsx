import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Review } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormControls';

export default function ReviewsList() {
  const [status, setStatus] = useState('pending');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', status],
    queryFn: async () => (await api.get('/reviews/admin', { params: { status: status || undefined } })).data.data as Review[]
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => api.patch(`/reviews/admin/${id}/moderate`, { status }),
    onSuccess: () => { toast.success('Review updated'); queryClient.invalidateQueries({ queryKey: ['reviews'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<Review>[] = [
    { header: 'Product', render: (r) => typeof r.product === 'object' ? r.product.name : '—' },
    { header: 'Customer', render: (r) => typeof r.user === 'object' ? r.user.name : '—' },
    { header: 'Rating', render: (r) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) },
    { header: 'Comment', render: (r) => <span className="line-clamp-2 max-w-xs text-slateink">{r.comment}</span> },
    { header: 'Date', render: (r) => format(new Date(r.createdAt), 'd MMM yyyy') },
    {
      header: '', className: 'text-right',
      render: (r) => r.status === 'pending' && (
        <div className="flex justify-end gap-1">
          <button onClick={() => moderateMutation.mutate({ id: r._id, status: 'approved' })} className="rounded p-1.5 text-forest hover:bg-forest-light"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => moderateMutation.mutate({ id: r._id, status: 'rejected' })} className="rounded p-1.5 text-brand hover:bg-brand-light"><X className="h-3.5 w-3.5" /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Reviews" description="Moderate customer reviews before they appear on product pages." />
      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Select className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}
            options={[{ label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }]} />
        </div>
        <DataTable columns={columns} rows={data || []} rowKey={(r) => r._id} isLoading={isLoading} emptyIcon={Star} emptyTitle="No reviews here" />
      </Card>
    </div>
  );
}
