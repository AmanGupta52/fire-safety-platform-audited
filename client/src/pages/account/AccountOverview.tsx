import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, FileText, FlameKindling, Wrench } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Order, Quote, CustomerEquipment, ServiceBooking } from '../../types';
import { Card } from '../../components/ui/Primitives';

export default function AccountOverview() {
  const user = useAuthStore((s) => s.user);

  const { data: orders } = useQuery({ queryKey: ['my-orders-summary'], queryFn: async () => (await api.get('/orders/my', { params: { limit: 3 } })).data.data as Order[] });
  const { data: quotes } = useQuery({ queryKey: ['my-quotes-summary'], queryFn: async () => (await api.get('/quotes/my')).data.data as Quote[] });
  const { data: equipment } = useQuery({ queryKey: ['my-equipment-summary'], queryFn: async () => (await api.get('/equipment/my')).data.data as CustomerEquipment[] });
  const { data: services } = useQuery({ queryKey: ['my-services-summary'], queryFn: async () => (await api.get('/services/my')).data.data as ServiceBooking[] });

  const dueEquipment = (equipment || []).filter((e) => e.status !== 'healthy');

  return (
    <div>
      <h1 className="heading text-xl text-ink">Welcome back, {user?.name?.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-slateink">Here's a quick look at your account.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBlock icon={Package} label="Orders" value={orders?.length ?? '—'} to="/account/orders" />
        <StatBlock icon={FileText} label="Quotes" value={quotes?.length ?? '—'} to="/account/quotes" />
        <StatBlock icon={FlameKindling} label="Equipment tracked" value={equipment?.length ?? '—'} to="/account/equipment" />
        <StatBlock icon={Wrench} label="Service bookings" value={services?.length ?? '—'} to="/account/services" />
      </div>

      {dueEquipment.length > 0 && (
        <Card className="mt-6 border-amber/30 bg-amber-light p-5">
          <p className="heading text-sm text-ink">Equipment needing attention</p>
          <div className="mt-3 flex flex-col gap-2">
            {dueEquipment.slice(0, 3).map((e) => (
              <div key={e._id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{e.productNameSnapshot} — {e.serialNumber}</span>
                <span className="font-medium capitalize text-amber">{e.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
          <Link to="/account/equipment" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">View all equipment →</Link>
        </Card>
      )}

      <div className="mt-6">
        <p className="heading text-sm text-ink">Recent orders</p>
        <div className="mt-3 flex flex-col gap-2">
          {(orders || []).length === 0 && <p className="text-sm text-slateink">No orders yet.</p>}
          {(orders || []).map((o) => (
            <Link key={o._id} to={`/account/orders/${o._id}`}>
              <Card className="flex items-center justify-between p-4 hover:shadow-lift">
                <div>
                  <p className="text-sm font-medium text-ink">{o.orderNumber}</p>
                  <p className="text-xs capitalize text-slateink">{o.status}</p>
                </div>
                <p className="text-sm font-medium text-ink">₹{o.totalAmount.toLocaleString('en-IN')}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, to }: { icon: typeof Package; label: string; value: string | number; to: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:shadow-lift">
        <Icon className="h-4 w-4 text-brand" />
        <p className="heading mt-2 text-xl text-ink">{value}</p>
        <p className="text-xs text-slateink">{label}</p>
      </Card>
    </Link>
  );
}
