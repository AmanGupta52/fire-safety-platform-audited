import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Customer, Order, Quote, ServiceBooking } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export default function CustomersList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, q],
    queryFn: async () => (await api.get('/customers', { params: { page, limit: 20, q: q || undefined } })).data as {
      data: Customer[]; meta: { totalPages: number };
    }
  });

  const columns: Column<Customer>[] = [
    { header: 'Name', render: (c) => <span className="font-medium text-ink">{c.name}</span> },
    { header: 'Contact', render: (c) => <div><p className="text-ink">{c.email}</p><p className="text-xs text-slateink">{c.phone}</p></div> },
    { header: 'Type', render: (c) => <Badge tone="neutral">{c.customerType.toUpperCase()}</Badge> },
    { header: 'Tags', render: (c) => <div className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} tone="info">{t}</Badge>)}</div> },
    { header: 'Status', render: (c) => <Badge tone={c.isActive ? 'success' : 'danger'}>{c.isActive ? 'Active' : 'Disabled'}</Badge> },
    { header: 'Joined', render: (c) => format(new Date(c.createdAt), 'd MMM yyyy') }
  ];

  return (
    <div>
      <PageHeader title="Customers" description="B2C, B2B and corporate accounts with full order, quote and service history." />
      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateink" />
            <Input placeholder="Search name, email or phone..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-8" />
          </div>
        </div>
        <DataTable
          columns={columns} rows={data?.data || []} rowKey={(c) => c._id} isLoading={isLoading}
          emptyIcon={Users} emptyTitle="No customers yet" onRowClick={(c) => setSelectedId(c._id)}
        />
        <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />
      </Card>

      {selectedId && <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [tagInput, setTagInput] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => (await api.get(`/customers/${customerId}`)).data.data as {
      user: Customer; orders: Order[]; quotes: Quote[]; services: ServiceBooking[]; revenue: number;
    }
  });

  const tagMutation = useMutation({
    mutationFn: async (tags: string[]) => api.patch(`/customers/${customerId}/tags`, { tags }),
    onSuccess: () => { toast.success('Tags updated'); queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async () => api.patch(`/customers/${customerId}/toggle-active`),
    onSuccess: () => { toast.success('Customer updated'); queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (isLoading || !data) return <Modal open onClose={onClose} title="Customer"><div className="py-8 text-center text-sm text-slateink">Loading…</div></Modal>;

  const { user, orders, quotes, services, revenue } = data;

  return (
    <Modal open onClose={onClose} title={user.name} width="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-xs font-medium text-slateink">Contact</p><p className="text-ink">{user.email}</p><p className="text-ink">{user.phone}</p></div>
          <div><p className="text-xs font-medium text-slateink">Type</p><p className="text-ink">{user.customerType.toUpperCase()} {user.companyName && `· ${user.companyName}`}</p></div>
          <div><p className="text-xs font-medium text-slateink">Lifetime revenue</p><p className="stat-number text-ink">₹{revenue.toLocaleString('en-IN')}</p></div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slateink">Tags</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {user.tags.map((t) => (
              <Badge key={t} tone="info">
                <button onClick={() => tagMutation.mutate(user.tags.filter((x) => x !== t))} className="mr-1">×</button>{t}
              </Badge>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  tagMutation.mutate([...user.tags, tagInput.trim()]);
                  setTagInput('');
                }
              }}
              placeholder="Add tag + Enter"
              className="w-32 rounded border border-line px-2 py-1 text-xs focus:border-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <SummaryBlock title="Orders" count={orders.length} />
          <SummaryBlock title="Quotes" count={quotes.length} />
          <SummaryBlock title="Service bookings" count={services.length} />
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <Button variant={user.isActive ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActiveMutation.mutate()} loading={toggleActiveMutation.isPending}>
            {user.isActive ? 'Disable account' : 'Enable account'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryBlock({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded border border-line p-3">
      <p className="stat-number text-lg text-ink">{count}</p>
      <p className="text-xs text-slateink">{title}</p>
    </div>
  );
}
