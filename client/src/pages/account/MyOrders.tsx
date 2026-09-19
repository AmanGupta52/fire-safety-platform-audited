import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { Order } from '../../types';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui/Primitives';

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning', confirmed: 'info', processing: 'info', packed: 'info',
  dispatched: 'info', delivered: 'success', cancelled: 'danger', refunded: 'danger'
};

export default function MyOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => (await api.get('/orders/my', { params: { limit: 50 } })).data.data as Order[]
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1 className="heading text-xl text-ink">My orders</h1>
      {!data || data.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" description="Once you place an order, it will show up here." />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {data.map((order) => (
            <Link key={order._id} to={`/account/orders/${order._id}`}>
              <Card className="flex flex-col gap-2 p-4 hover:shadow-lift sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{order.orderNumber}</p>
                  <p className="text-xs text-slateink">{format(new Date(order.createdAt), 'd MMM yyyy')} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone[order.status] || 'neutral'}>{order.status}</Badge>
                  <p className="text-sm font-medium text-ink">₹{order.totalAmount.toLocaleString('en-IN')}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
