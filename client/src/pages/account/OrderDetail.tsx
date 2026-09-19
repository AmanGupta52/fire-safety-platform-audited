import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Order } from '../../types';
import { Card, Badge, Spinner } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'packed', 'dispatched', 'delivered'];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['my-order-detail', id],
    queryFn: async () => (await api.get(`/orders/my/${id}`)).data.data as Order,
    enabled: Boolean(id)
  });

  const cancelMutation = useMutation({
    mutationFn: async () => api.post(`/orders/my/${id}/cancel`, { reason: 'Cancelled by customer' }),
    onSuccess: () => { toast.success('Order cancelled'); queryClient.invalidateQueries({ queryKey: ['my-order-detail', id] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (isLoading || !order) return <Spinner />;

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
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
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 flex-col items-center">
                <div className={`h-2.5 w-2.5 rounded-full ${i <= currentStepIndex ? 'bg-brand' : 'bg-line'}`} />
                <p className={`mt-2 text-center text-[10px] capitalize ${i <= currentStepIndex ? 'text-ink' : 'text-slateink'}`}>{step}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {isTerminal && <div className="mt-5"><Badge tone="danger">{order.status}</Badge></div>}

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
