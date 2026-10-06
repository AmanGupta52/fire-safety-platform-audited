import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HardHat, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { CustomerEquipment, EquipmentStatus } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormControls';

const statusTone: Record<EquipmentStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  healthy: 'success', inspection_due_soon: 'warning', refill_due_soon: 'warning', overdue: 'danger'
};
const statusLabel: Record<EquipmentStatus, string> = {
  healthy: 'Healthy', inspection_due_soon: 'Inspection due soon', refill_due_soon: 'Refill due soon', overdue: 'Overdue'
};

// Read-only by design: equipment is registered and maintained by the customer themselves
// (client account area) — this page exists so staff can see what's out there and what needs
// attention, driving service-visit scheduling, without duplicating that data-entry surface.
export default function EquipmentList() {
  const [dueOnly, setDueOnly] = useState(false);
  const [days, setDays] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['equipment-admin', dueOnly, days],
    queryFn: async () =>
      (await api.get(dueOnly ? '/equipment/due' : '/equipment', { params: dueOnly ? { days } : undefined })).data.data as CustomerEquipment[]
  });

  const columns: Column<CustomerEquipment>[] = [
    { header: 'Customer', render: (e) => typeof e.user === 'object' ? <div><p className="text-ink">{e.user.name}</p><p className="text-xs text-slateink">{e.user.phone || e.user.email}</p></div> : '—' },
    { header: 'Equipment', render: (e) => <span className="font-medium text-ink">{e.productNameSnapshot}</span> },
    { header: 'Serial #', render: (e) => e.serialNumber },
    { header: 'Location', render: (e) => e.installationLocation || '—' },
    { header: 'Next inspection', render: (e) => e.nextInspectionDate ? format(new Date(e.nextInspectionDate), 'd MMM yyyy') : '—' },
    { header: 'Next refill', render: (e) => e.nextRefillDate ? format(new Date(e.nextRefillDate), 'd MMM yyyy') : '—' },
    { header: 'Status', render: (e) => <Badge tone={statusTone[e.status]}>{statusLabel[e.status]}</Badge> }
  ];

  return (
    <div>
      <PageHeader
        title="Customer equipment"
        description="Fire safety equipment registered by customers — used to plan inspection and refill visits."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <button
            onClick={() => setDueOnly(false)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${!dueOnly ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card text-slateink hover:bg-paper'}`}
          >
            All equipment
          </button>
          <button
            onClick={() => setDueOnly(true)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${dueOnly ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card text-slateink hover:bg-paper'}`}
          >
            <AlertTriangle className="h-3 w-3" /> Due soon
          </button>
          {dueOnly && (
            <Select
              className="w-40" value={days} onChange={(e) => setDays(e.target.value)}
              options={[{ label: 'Within 7 days', value: '7' }, { label: 'Within 15 days', value: '15' }, { label: 'Within 30 days', value: '30' }, { label: 'Within 60 days', value: '60' }]}
            />
          )}
        </div>
        <DataTable columns={columns} rows={data || []} rowKey={(e) => e._id} isLoading={isLoading}
          emptyIcon={HardHat} emptyTitle={dueOnly ? 'Nothing due in this window' : 'No equipment registered yet'} />
      </Card>
    </div>
  );
}
