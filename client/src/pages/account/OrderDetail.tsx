import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { NotFound404 } from '../errors/StatusPages';
import { Order } from '../../types';
import { Card, ErrorState } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { TrackingTimeline } from '../../components/tracking/TrackingTimeline';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'packed', 'dispatched', 'delivered'];

// Mirrors the real page's section order (back link, header, status tracker, items, address)
// so the layout doesn't jump once the order loads.
function OrderDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order">
      <div className="skeleton-shimmer h-4 w-32 rounded" />
      <div className="mt-4 flex items-start justify-between">
        <div>
          <div className="skeleton-shimmer h-6 w-40 rounded" />
          <div className="skeleton-shimmer mt-2 h-3 w-56 rounded" />
        </div>
      </div>
      <div className="mt-5 rounded-card border border-line bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((step) => (
            <div key={step} className="flex flex-1 flex-col items-center gap-2">
              <div className="skeleton-shimmer h-2.5 w-2.5 rounded-full" />
              <div className="skeleton-shimmer h-2 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-card border border-line bg-card p-5 shadow-card">
        <div className="skeleton-shimmer h-3.5 w-16 rounded" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <div className="skeleton-shimmer h-4 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-card border border-line bg-card p-5 shadow-card">
        <div className="skeleton-shimmer h-3.5 w-32 rounded" />
        <div className="skeleton-shimmer mt-3 h-3 w-full rounded" />
        <div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded" />
      </div>
      <span className="sr-only">Loading order</span>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-order-detail', id],
    queryFn: async () => (await api.get(`/orders/my/${id}`)).data.data as Order,
    enabled: Boolean(id)
  });

  const cancelMutation = useMutation({
    mutationFn: async () => api.post(`/orders/my/${id}/cancel`, { reason: 'Cancelled by customer' }),
    onSuccess: () => { toast.success('Order cancelled'); queryClient.invalidateQueries({ queryKey: ['my-order-detail', id] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (isLoading) return <OrderDetailSkeleton />;
  // A missing order, or one that belongs to someone else (the API returns 404 either way, on
  // purpose, so it doesn't reveal that another customer's order exists) — "Retry" would just
  // 404 again. Any other failure (network, 500, etc.) keeps the retry affordance.
  if (isError) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return <NotFound404 />;
    return <ErrorState title="Couldn't load this order" onRetry={() => refetch()} />;
  }
  if (!order) return <NotFound404 />;

  const isTerminal = order.status === 'cancelled' || order.status === 'refunded';
  const canCancel = ['pending', 'confirmed'].includes(order.status);

  return (
    <div>
      <Link to="/account/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slateink hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to orders</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading text-xl text-ink">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slateink">Placed on {format(new Date(order.createdAt), 'd MMM yyyy, h:mm a')}</p>
        </div>
        {canCancel && <Button variant="danger" size="sm" loading={cancelMutation.isPending} onClick={() => { if (confirm('Cancel this order?')) cancelMutation.mutate(); }}>Cancel order</Button>}
      </div>

      {!isTerminal && (
        <Card className="mt-5 p-5">
          <TrackingTimeline
            steps={[
              { key: 'pending', label: 'Order Placed', description: 'Received in system' },
              { key: 'confirmed', label: 'Confirmed', description: 'Payment verified' },
              { key: 'processing', label: 'Processing', description: 'Equipment checked' },
              { key: 'packed', label: 'Packed', description: 'Safety packed' },
              { key: 'dispatched', label: 'Dispatched', description: 'Out for delivery' },
              { key: 'delivered', label: 'Delivered', description: 'Successfully handed over' }
            ]}
            currentStepKey={order.status}
          />
        </Card>
      )}
      {isTerminal && (
        <Card className="mt-5 p-5">
          <TrackingTimeline
            steps={[]}
            currentStepKey={order.status}
            isCancelled
            cancelReason={`Order ${order.status}.`}
          />
        </Card>
      )}

      <Card className="mt-5 p-5">
        <p className="heading text-sm text-ink">Items</p>
        <div className="mt-3 divide-y divide-line">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 text-sm">
              <div><p className="text-ink">{item.name}</p><p className="text-xs text-slateink">Qty {item.quantity}</p></div>
              <p className="font-medium text-ink">₹{item.lineTotal.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between text-slateink"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString('en-IN')}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-forest"><span>Discount</span><span>-₹{order.discount.toLocaleString('en-IN')}</span></div>}
          <div className="flex justify-between text-slateink"><span>GST</span><span>₹{order.gstAmount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between text-slateink"><span>Shipping</span><span>{order.shippingFee === 0 ? 'Free' : `₹${order.shippingFee}`}</span></div>
          <div className="flex justify-between font-medium text-ink"><span>Total</span><span>₹{order.totalAmount.toLocaleString('en-IN')}</span></div>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <p className="heading text-sm text-ink">Delivery address</p>
        <p className="mt-2 text-sm text-slateink">
          {order.shippingAddress.contactName} · {order.shippingAddress.phone}<br />
          {order.shippingAddress.line1}, {order.shippingAddress.line2 && `${order.shippingAddress.line2}, `}
          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
        </p>
      </Card>
    </div>
  );
}
