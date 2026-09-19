import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ServiceBooking, ServiceStatus, Technician } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

const STATUS_OPTIONS: ServiceStatus[] = ['requested', 'confirmed', 'assigned', 'technician_on_the_way', 'in_progress', 'completed', 'cancelled'];
const statusTone: Record<ServiceStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', confirmed: 'info', assigned: 'info', technician_on_the_way: 'info',
  in_progress: 'info', completed: 'success', cancelled: 'danger'
};
const serviceTypeLabel: Record<string, string> = {
  installation: 'Installation', inspection: 'Inspection', refilling: 'Refilling',
  repair: 'Repair', fire_safety_audit: 'Fire Safety Audit', amc_visit: 'AMC Visit'
};

export default function ServicesList() {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ServiceBooking | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['services', status],
    queryFn: async () => (await api.get('/services', { params: { status: status || undefined, limit: 50 } })).data.data as ServiceBooking[]
  });

  const columns: Column<ServiceBooking>[] = [
    { header: 'Booking #', render: (b) => <span className="font-medium text-ink">{b.bookingNumber}</span> },
    { header: 'Customer', render: (b) => typeof b.user === 'object' ? b.user.name : '—' },
    { header: 'Type', render: (b) => serviceTypeLabel[b.serviceType] },
    { header: 'Preferred date', render: (b) => format(new Date(b.preferredDate), 'd MMM yyyy') },
    { header: 'Technician', render: (b) => (b.assignedTechnician && typeof b.assignedTechnician === 'object' ? b.assignedTechnician.name : 'Unassigned') },
    { header: 'Status', render: (b) => <Badge tone={statusTone[b.status]}>{b.status.replace(/_/g, ' ')}</Badge> }
  ];

  return (
    <div>
      <PageHeader title="Service bookings" description="Installation, inspection, refilling, repair and audit requests." />

      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Select className="w-56" placeholder="All statuses" value={status} onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))} />
        </div>
        <DataTable columns={columns} rows={data || []} rowKey={(b) => b._id} isLoading={isLoading}
          emptyIcon={Wrench} emptyTitle="No service bookings yet" onRowClick={setSelected} />
      </Card>

      {selected && <BookingDetailModal booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BookingDetailModal({ booking, onClose }: { booking: ServiceBooking; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ServiceStatus>(booking.status);
  const [technicianId, setTechnicianId] = useState(
    booking.assignedTechnician && typeof booking.assignedTechnician === 'object' ? booking.assignedTechnician._id : ''
  );

  const { data: technicians } = useQuery({
    queryKey: ['technicians-active'],
    queryFn: async () => (await api.get('/technicians', { params: { status: 'active' } })).data.data as Technician[]
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['services'] });

  const assignMutation = useMutation({
    mutationFn: async () => api.patch(`/services/${booking._id}/assign`, { technicianId }),
    onSuccess: () => { toast.success('Technician assigned'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const statusMutation = useMutation({
    mutationFn: async () => api.patch(`/services/${booking._id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); invalidate(); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const customer = typeof booking.user === 'object' ? booking.user : null;

  return (
    <Modal open onClose={onClose} title={`Booking ${booking.bookingNumber}`} width="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slateink">Customer</p>
            <p className="text-ink">{customer?.name}</p>
            <p className="text-xs text-slateink">{customer?.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Service type</p>
            <p className="text-ink">{serviceTypeLabel[booking.serviceType]}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Address</p>
            <p className="text-ink">{booking.address}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Preferred date</p>
            <p className="text-ink">{format(new Date(booking.preferredDate), 'd MMM yyyy')} {booking.preferredTime}</p>
          </div>
        </div>

        {booking.problemDescription && (
          <div>
            <p className="text-xs font-medium text-slateink">Problem description</p>
            <p className="text-sm text-ink">{booking.problemDescription}</p>
          </div>
        )}

        <div className="flex items-end gap-3 border-t border-line pt-4">
          <Select
            label="Assign technician" className="flex-1" value={technicianId} placeholder="Select technician"
            onChange={(e) => setTechnicianId(e.target.value)}
            options={(technicians || []).map((t) => ({ label: t.name, value: t._id }))}
          />
          <Button variant="secondary" onClick={() => assignMutation.mutate()} loading={assignMutation.isPending} disabled={!technicianId}>
            Assign
          </Button>
        </div>

        <div className="flex items-end gap-3">
          <Select
            label="Update status" className="flex-1" value={status}
            onChange={(e) => setStatus(e.target.value as ServiceStatus)}
            options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
          />
          <Button onClick={() => statusMutation.mutate()} loading={statusMutation.isPending} disabled={status === booking.status}>
            Update
          </Button>
        </div>
      </div>
    </Modal>
  );
}
