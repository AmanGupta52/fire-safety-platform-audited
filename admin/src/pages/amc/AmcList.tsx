import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, UserCog, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { AMCContract, AMCStatus, Technician, Customer } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select, Input } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

const STATUS_OPTIONS: AMCStatus[] = ['requested', 'active', 'expiring_soon', 'expired', 'renewed', 'cancelled'];

export default function AmcList() {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<AMCContract | null>(null);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['amc', status],
    queryFn: async () => (await api.get('/amc', { params: { status: status || undefined } })).data.data as AMCContract[]
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AMCStatus }) => api.patch(`/amc/${id}/status`, { status }),
    onSuccess: () => { toast.success('AMC status updated'); queryClient.invalidateQueries({ queryKey: ['amc'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<AMCContract>[] = [
    { header: 'Contract #', render: (c) => <span className="font-medium text-ink">{c.contractNumber}</span> },
    { header: 'Customer', render: (c) => typeof c.user === 'object' ? c.user.name : '—' },
    { header: 'Plan', render: (c) => c.planName },
    { header: 'Start', render: (c) => format(new Date(c.startDate), 'd MMM yyyy') },
    { header: 'End', render: (c) => format(new Date(c.endDate), 'd MMM yyyy') },
    { header: 'Amount', render: (c) => `₹${c.amount.toLocaleString('en-IN')}` },
    { header: 'Visits', render: (c) => c.visits?.length || 0 },
    {
      header: 'Status',
      render: (c) => (
        <Select
          value={c.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => statusMutation.mutate({ id: c._id, status: e.target.value as AMCStatus })}
          options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
          className="w-40"
        />
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="AMC contracts" description="Track annual maintenance contracts, technician assignments, and scheduled visits."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Create AMC contract</Button>}
      />
      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Select className="w-56" placeholder="All statuses" value={status} onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS.map((s) => ({ label: s[0].toUpperCase() + s.slice(1).replace(/_/g, ' '), value: s }))} />
        </div>
        <DataTable
          columns={columns} rows={data || []} rowKey={(c) => c._id} isLoading={isLoading} onRowClick={setSelected}
          emptyIcon={ShieldCheck} emptyTitle="No AMC contracts yet"
          rowAccentColor={(c) => (c.status === 'expired' ? '#C1272D' : c.status === 'expiring_soon' ? '#E1890F' : undefined)}
        />
      </Card>

      {selected && <AmcDetailModal contract={selected} onClose={() => setSelected(null)} />}
      {creating && <CreateAmcModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function AmcDetailModal({ contract, onClose }: { contract: AMCContract; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [visitDate, setVisitDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['amc'] });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/technicians', { params: { status: 'active' } })).data.data as Technician[]
  });

  const assignMutation = useMutation({
    mutationFn: async (technicianId: string) => api.patch(`/amc/${contract._id}/assign-technician`, { technicianId }),
    onSuccess: () => { toast.success('Technician assigned'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const visitMutation = useMutation({
    mutationFn: async () => api.post(`/amc/${contract._id}/visits`, { scheduledDate: visitDate, notes: visitNotes || undefined }),
    onSuccess: () => { toast.success('Visit scheduled'); setVisitDate(''); setVisitNotes(''); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`AMC ${contract.contractNumber}`} width="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slateink">Customer</p>
            <p className="text-ink">{typeof contract.user === 'object' ? contract.user.name : '—'}</p>
            {typeof contract.user === 'object' && <p className="text-xs text-slateink">{contract.user.email} · {contract.user.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Plan</p>
            <p className="text-ink">{contract.planName} · ₹{contract.amount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slateink">{format(new Date(contract.startDate), 'd MMM yyyy')} – {format(new Date(contract.endDate), 'd MMM yyyy')}</p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slateink"><UserCog className="h-3.5 w-3.5" /> Assigned technician</p>
          <Select
            value={contract.assignedTechnician || ''}
            onChange={(e) => assignMutation.mutate(e.target.value)}
            placeholder="Unassigned"
            options={(technicians || []).map((t) => ({ label: t.name, value: t._id }))}
          />
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slateink"><CalendarPlus className="h-3.5 w-3.5" /> Visits</p>
          {contract.visits.length === 0 ? (
            <p className="text-xs text-slateink">No visits scheduled yet.</p>
          ) : (
            <div className="rounded border border-line">
              {contract.visits.map((v, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
                  <span className="text-ink">{format(new Date(v.scheduledDate), 'd MMM yyyy')}</span>
                  <span className="text-xs text-slateink">{v.notes || '—'}</span>
                  <Badge tone={v.status === 'completed' ? 'success' : v.status === 'missed' ? 'danger' : 'info'}>{v.status}</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-end gap-2">
            <Input label="Schedule new visit" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            <Input label="Notes" value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} placeholder="Optional" />
            <Button size="sm" onClick={() => visitMutation.mutate()} loading={visitMutation.isPending} disabled={!visitDate}>Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface CreateFormValues { userId: string; planName: string; startDate: string; endDate: string; amount: number }

function CreateAmcModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [customerQuery, setCustomerQuery] = useState('');
  const { register, handleSubmit, watch, setValue } = useForm<CreateFormValues>();
  const selectedUserId = watch('userId');

  const { data: customers } = useQuery({
    queryKey: ['customer-search', customerQuery],
    queryFn: async () => (await api.get('/customers', { params: { q: customerQuery, limit: 8 } })).data.data as Customer[],
    enabled: customerQuery.length > 1
  });

  const mutation = useMutation({
    mutationFn: async (values: CreateFormValues) => api.post('/amc', values),
    onSuccess: () => { toast.success('AMC contract created'); queryClient.invalidateQueries({ queryKey: ['amc'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title="Create AMC contract">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div>
          <Input
            label="Search customer" placeholder="Name, email or phone"
            value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)}
          />
          <input type="hidden" required {...register('userId')} />
          {customerQuery.length > 1 && (
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded border border-line">
              {(customers || []).length === 0 ? (
                <p className="px-3 py-2 text-xs text-slateink">No matching customers</p>
              ) : (
                customers!.map((c) => (
                  <button
                    key={c._id} type="button"
                    onClick={() => { setValue('userId', c._id); setCustomerQuery(`${c.name} (${c.email})`); }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-paper ${selectedUserId === c._id ? 'bg-brand-light' : ''}`}
                  >
                    {c.name} <span className="text-xs text-slateink">{c.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Input label="Plan name" required placeholder="e.g. Annual Comprehensive AMC" {...register('planName')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Start date" type="date" required {...register('startDate')} />
          <Input label="End date" type="date" required {...register('endDate')} />
        </div>
        <Input label="Amount (₹)" type="number" required {...register('amount', { valueAsNumber: true })} />

        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending} disabled={!selectedUserId}>Create contract</Button>
        </div>
      </form>
    </Modal>
  );
}
