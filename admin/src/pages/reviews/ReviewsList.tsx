import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Review } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column, BulkActionOption } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormControls';

export default function ReviewsList() {
  const [status, setStatus] = useState('pending');
  const [reviewType, setReviewType] = useState('all');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', status, reviewType],
    queryFn: async () =>
      (
        await api.get('/reviews/admin', {
          params: {
            status: status || undefined,
            type: reviewType !== 'all' ? reviewType : undefined
          }
        })
      ).data.data as Review[]
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api.patch(`/reviews/admin/${id}/moderate`, { status }),
    onSuccess: (_, vars) => {
      toast.success(`Review ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  // Bulk moderation
  const handleBulkAction = async (action: string, selectedIds: string[]) => {
    if (action === 'approve' || action === 'reject') {
      try {
        const targetStatus = action === 'approve' ? 'approved' : 'rejected';
        await Promise.all(
          selectedIds.map((id) => api.patch(`/reviews/admin/${id}/moderate`, { status: targetStatus }))
        );
        toast.success(`${selectedIds.length} reviews ${targetStatus}`);
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
      } catch (err) {
        toast.error(apiErrorMessage(err));
      }
    }
  };

  const bulkOptions: BulkActionOption[] = [
    { label: 'Approve Selected', action: 'approve', tone: 'primary' },
    { label: 'Reject Selected', action: 'reject', tone: 'danger' }
  ];

  const columns: Column<Review>[] = [
    {
      header: 'Item Reviewed',
      sortKey: (r) => (r.booking ? 'Service' : 'Product'),
      render: (r) => {
        if (r.booking && typeof r.booking === 'object') {
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-forest/10 px-1.5 py-0.5 text-[10px] font-bold text-forest">
                  Service
                </span>
                <span className="font-semibold text-ink text-xs">{r.booking.bookingNumber}</span>
              </div>
              <span className="text-[11px] text-slateink capitalize">
                {r.booking.serviceType.replace(/_/g, ' ')}
              </span>
            </div>
          );
        }
        if (r.product && typeof r.product === 'object') {
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                  Product
                </span>
                <span className="font-semibold text-ink text-xs">{r.product.name}</span>
              </div>
            </div>
          );
        }
        return <span className="text-slateink">—</span>;
      }
    },
    {
      header: 'Customer',
      sortKey: (r) => (typeof r.user === 'object' ? r.user.name : ''),
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-ink">{typeof r.user === 'object' ? r.user.name : '—'}</p>
          <p className="text-[11px] text-slateink">{typeof r.user === 'object' ? r.user.email : ''}</p>
        </div>
      )
    },
    {
      header: 'Rating',
      sortKey: 'rating',
      render: (r) => (
        <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
          <span>{'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</span>
          <span className="text-slateink font-normal text-[11px]">({r.rating}/5)</span>
        </div>
      )
    },
    {
      header: 'Feedback / Comment',
      render: (r) => (
        <div className="max-w-xs">
          {r.title && <p className="text-xs font-bold text-ink">{r.title}</p>}
          <p className="line-clamp-2 text-xs text-slateink">{r.comment}</p>
        </div>
      )
    },
    {
      header: 'Status',
      sortKey: 'status',
      render: (r) => (
        <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>
          {r.status}
        </Badge>
      )
    },
    {
      header: 'Date',
      sortKey: (r) => new Date(r.createdAt).getTime(),
      render: (r) => format(new Date(r.createdAt), 'd MMM yyyy')
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.status !== 'approved' && (
            <button
              type="button"
              onClick={() => moderateMutation.mutate({ id: r._id, status: 'approved' })}
              className="inline-flex items-center gap-1 rounded bg-forest/10 px-2 py-1 text-xs font-semibold text-forest hover:bg-forest/20"
              title="Approve review"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
          )}
          {r.status !== 'rejected' && (
            <button
              type="button"
              onClick={() => moderateMutation.mutate({ id: r._id, status: 'rejected' })}
              className="inline-flex items-center gap-1 rounded bg-brand/10 px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
              title="Reject review"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Reviews & Moderation"
        description="Review and moderate ratings tied to purchased products and completed service bookings before public display."
      />

      <Card className="p-4">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select
              label=""
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { label: 'Pending Moderation', value: 'pending' },
                { label: 'Approved Reviews', value: 'approved' },
                { label: 'Rejected Reviews', value: 'rejected' },
                { label: 'All Statuses', value: '' }
              ]}
            />
          </div>

          <div className="w-44">
            <Select
              label=""
              value={reviewType}
              onChange={(e) => setReviewType(e.target.value)}
              options={[
                { label: 'All Review Types', value: 'all' },
                { label: 'Product Reviews', value: 'product' },
                { label: 'Service Bookings Only', value: 'service' }
              ]}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={data || []}
          rowKey={(r) => r._id}
          isLoading={isLoading}
          emptyIcon={Star}
          emptyTitle="No reviews found"
          emptyDescription="Reviews matching your filter criteria will appear here."
          bulkActions={bulkOptions}
          onBulkAction={handleBulkAction}
          exportFilename="reviews-moderation"
        />
      </Card>
    </div>
  );
}
