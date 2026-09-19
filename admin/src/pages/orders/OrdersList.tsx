import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Order, OrderStatus } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'packed', 'dispatched', 'delivered', 'cancelled', 'refunded'];

const statusTone: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning', confirmed: 'info', processing: 'info', packed: 'info',
  dispatched: 'info', delivered: 'success', cancelled: 'danger', refunded: 'danger'
};

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function OrdersList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, status],
    queryFn: async () =>
      (await api.get('/orders', { params: { page, limit: 20, status: status || undefined } })).data as {
        data: Order[]; meta: { totalPages: number };
      }
  });

  const columns: Column<Order>[] = [
    { header: 'Order #', render: (o) => <span className="font-medium text-ink">{o.orderNumber}</span> },
    { header: 'Customer', render: (o) => typeof o.user === 'object' ? o.user.name : '—' },
    { header: 'Items', render: (o) => `${o.items.length} item${o.items.length !== 1 ? 's' : ''}` },
    { header: 'Total', render: (o) => formatInr(o.totalAmount) },
    { header: 'Payment', render: (o) => <Badge tone={o.paymentStatus === 'paid' ? 'success' : o.paymentStatus === 'failed' ? 'danger' : 'neutral'}>{o.paymentStatus}</Badge> },
    { header: 'Status', render: (o) => <Badge tone={statusTone[o.status]}>{o.status}</Badge> },
    { header: 'Date', render: (o) => format(new Date(o.createdAt), 'd MMM yyyy') }
  ];

  return (
    <div>
      <PageHeader title="Orders" description="Track and update fulfillment status for every order." />

      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Select
            className="w-56"
            placeholder="All statuses"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={STATUS_OPTIONS.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s }))}
          />
        </div>

        <DataTable
          columns={columns} rows={data?.data || []} rowKey={(o) => o._id} isLoading={isLoading}
          emptyIcon={ShoppingCart} emptyTitle="No orders yet"
          rowAccentColor={(o) => (o.status === 'cancelled' || o.status === 'refunded' ? '#C1272D' : o.status === 'delivered' ? '#2E7D4F' : undefined)}
          onRowClick={(o) => setSelected(o)}
        />

        <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />
      </Card>

      {selected && (
        <OrderDetailModal order={selected} canUpdate={hasPermission('orders.update')} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function OrderDetailModal({ order, canUpdate, onClose }: { order: Order; canUpdate: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => api.patch(`/orders/${order._id}/status`, { status }),
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const customer = typeof order.user === 'object' ? order.user : null;

  return (
    <Modal open onClose={onClose} title={`Order ${order.orderNumber}`} width="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slateink">Customer</p>
            <p className="text-ink">{customer?.name}</p>
            <p className="text-xs text-slateink">{customer?.email} {customer?.phone && `· ${customer.phone}`}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Placed on</p>
            <p className="text-ink">{format(new Date(order.createdAt), 'd MMM yyyy, h:mm a')}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slateink">Items</p>
          <div className="rounded border border-line">
            {order.items.map((item, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
                <div>
                  <p className="text-ink">{item.name}</p>
                  <p className="text-xs text-slateink">SKU {item.sku} · Qty {item.quantity}</p>
                </div>
                <p className="font-medium text-ink">{formatInr(item.lineTotal)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-sm">
          <span className="text-slateink">Subtotal</span><span className="text-right text-ink">{formatInr(order.subtotal)}</span>
          {order.discount > 0 && (<><span className="text-slateink">Discount {order.couponCode && `(${order.couponCode})`}</span><span className="text-right text-forest">-{formatInr(order.discount)}</span></>)}
          <span className="text-slateink">GST</span><span className="text-right text-ink">{formatInr(order.gstAmount)}</span>
          <span className="text-slateink">Shipping</span><span className="text-right text-ink">{formatInr(order.shippingFee)}</span>
          <span className="font-medium text-ink">Total</span><span className="text-right font-medium text-ink">{formatInr(order.totalAmount)}</span>
        </div>

        {canUpdate && (
          <div className="flex items-end gap-3 border-t border-line pt-4">
            <Select
              label="Update status" className="flex-1"
              value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}
              options={STATUS_OPTIONS.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s }))}
            />
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={status === order.status}>Update</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
