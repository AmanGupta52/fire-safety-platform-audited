import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, FileUp, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ServiceBooking, ServiceStatus, Technician } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select, Input } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { MultiImageUploader } from '../../components/ui/ImageUploader';

const STATUS_OPTIONS: ServiceStatus[] = [
  'requested', 'confirmed', 'assigned', 'technician_on_the_way',
  'in_progress', 'completed', 'cancelled', 'rejected'
];

// Mirrors the server's allowed status flow so the admin is only offered moves that will succeed.
const NEXT_STATUSES: Record<ServiceStatus, ServiceStatus[]> = {
  requested: ['confirmed', 'assigned', 'cancelled', 'rejected'],
  confirmed: ['assigned', 'cancelled', 'rejected'],
  assigned: ['confirmed', 'technician_on_the_way', 'in_progress', 'cancelled'],
  technician_on_the_way: ['in_progress', 'assigned', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: []
};

const statusTone: Record<ServiceStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', confirmed: 'info', assigned: 'info',
  technician_on_the_way: 'info', in_progress: 'info',
  completed: 'success', cancelled: 'danger', rejected: 'danger'
};

const serviceTypeLabel: Record<string, string> = {
  installation: 'Installation', inspection: 'Inspection', refilling: 'Refilling',
  repair: 'Repair', fire_safety_audit: 'Fire Safety Audit', amc_visit: 'AMC Visit'
};

// Customer service bookings live on their own admin page, separate from the service catalog
// (Services page) and from product Orders.
export default function BookingsList() {
  return (
    <div>
      <PageHeader
        title="Service Bookings"
        description="Every on-site service a customer has booked from the storefront. Assign technicians, update status and attach service reports."
      />
      <BookingsSection />
    </div>
  );
}

function BookingsSection() {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ServiceBooking | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['services-bookings', status],
    queryFn: async () =>
      (await api.get('/bookings', { params: { status: status || undefined, limit: 50 } })).data.data as ServiceBooking[]
  });

  const columns: Column<ServiceBooking>[] = [
    { header: 'Booking #', render: (b) => <span className="font-medium text-ink">{b.bookingNumber}</span> },
    { header: 'Customer', render: (b) => typeof b.user === 'object' ? b.user.name : '—' },
    {
      header: 'Service / Type',
      render: (b) => (
        <div>
          <p className="font-medium text-ink">
            {b.service && typeof b.service === 'object' ? b.service.name : serviceTypeLabel[b.serviceType] || b.serviceType}
          </p>
          {b.service && typeof b.service === 'object' && (
            <p className="text-xs text-slateink">{serviceTypeLabel[b.serviceType] || b.serviceType}</p>
          )}
        </div>
      )
    },
    { header: 'Preferred date', render: (b) => format(new Date(b.preferredDate), 'd MMM yyyy') },
    { header: 'Technician', render: (b) => (b.assignedTechnician && typeof b.assignedTechnician === 'object' ? b.assignedTechnician.name : 'Unassigned') },
    { header: 'Status', render: (b) => <Badge tone={statusTone[b.status] || 'neutral'}>{b.status.replace(/_/g, ' ')}</Badge> }
  ];

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-line p-4">
        <Select
          className="w-56"
          placeholder="All statuses"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
        />
      </div>
      <DataTable
        columns={columns}
        rows={data || []}
        rowKey={(b) => b._id}
        isLoading={isLoading}
        emptyIcon={Wrench}
        emptyTitle="No service bookings yet"
        onRowClick={setSelected}
      />

      {selected && <BookingDetailModal booking={selected} onClose={() => setSelected(null)} />}
    </Card>
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['services-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const assignMutation = useMutation({
    mutationFn: async () => api.patch(`/bookings/${booking._id}/assign`, { technicianId }),
    onSuccess: () => { toast.success('Technician assigned'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const statusMutation = useMutation({
    mutationFn: async () => api.patch(`/bookings/${booking._id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); invalidate(); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const customer = typeof booking.user === 'object' ? booking.user : null;
  const serviceName = booking.service && typeof booking.service === 'object' ? booking.service.name : serviceTypeLabel[booking.serviceType];

  return (
    <Modal open onClose={onClose} title={`Booking ${booking.bookingNumber}`} width="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slateink">Customer</p>
            <p className="text-ink">{customer?.name}</p>
            <p className="text-xs text-slateink">{customer?.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Service Name / Type</p>
            <p className="text-ink font-medium">{serviceName}</p>
            <p className="text-xs text-slateink">{booking.serviceType}</p>
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
            options={[booking.status, ...NEXT_STATUSES[booking.status]].map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
          />
          <Button onClick={() => statusMutation.mutate()} loading={statusMutation.isPending} disabled={status === booking.status}>
            Update
          </Button>
        </div>

        <ServiceReportSection booking={booking} onSaved={invalidate} />
      </div>
    </Modal>
  );
}

function ServiceReportSection({ booking, onSaved }: { booking: ServiceBooking; onSaved: () => void }) {
  const [reportUrl, setReportUrl] = useState('');
  const [newBeforePhotos, setNewBeforePhotos] = useState<{ url: string; publicId?: string }[]>([]);
  const [newAfterPhotos, setNewAfterPhotos] = useState<{ url: string; publicId?: string }[]>([]);

  const mutation = useMutation({
    mutationFn: async () =>
      api.post(`/bookings/${booking._id}/report`, {
        serviceReportUrl: reportUrl || undefined,
        beforePhotos: newBeforePhotos.map((p) => p.url),
        afterPhotos: newAfterPhotos.map((p) => p.url)
      }),
    onSuccess: () => {
      toast.success('Report saved');
      onSaved();
      setReportUrl('');
      setNewBeforePhotos([]);
      setNewAfterPhotos([]);
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const hasExistingAttachments = booking.serviceReportUrl || (booking.beforePhotos && booking.beforePhotos.length > 0) || (booking.afterPhotos && booking.afterPhotos.length > 0);

  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-xs font-medium text-slateink">Service report</p>

      {hasExistingAttachments && (
        <div className="mb-3 flex flex-col gap-2 rounded border border-line bg-paper p-3">
          {booking.serviceReportUrl && (
            <a href={booking.serviceReportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
              <Paperclip className="h-3 w-3" /> Current report document ↗
            </a>
          )}
          {booking.beforePhotos && booking.beforePhotos.length > 0 && (
            <div>
              <p className="text-[11px] text-slateink">Before photos ({booking.beforePhotos.length})</p>
              <div className="mt-1 flex gap-1.5">
                {booking.beforePhotos.map((url, i) => <img key={i} src={url} alt="Before" className="h-12 w-12 rounded object-cover" />)}
              </div>
            </div>
          )}
          {booking.afterPhotos && booking.afterPhotos.length > 0 && (
            <div>
              <p className="text-[11px] text-slateink">After photos ({booking.afterPhotos.length})</p>
              <div className="mt-1 flex gap-1.5">
                {booking.afterPhotos.map((url, i) => <img key={i} src={url} alt="After" className="h-12 w-12 rounded object-cover" />)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Input label="Report document link (PDF, or paste any hosted URL)" placeholder="https://..." value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-slateink">Add before photos</p>
            <MultiImageUploader value={newBeforePhotos} onChange={setNewBeforePhotos} folder="service-reports" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slateink">Add after photos</p>
            <MultiImageUploader value={newAfterPhotos} onChange={setNewAfterPhotos} folder="service-reports" />
          </div>
        </div>
        <Button
          size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending}
          disabled={!reportUrl && newBeforePhotos.length === 0 && newAfterPhotos.length === 0}
        >
          <FileUp className="h-3.5 w-3.5" /> Save report
        </Button>
      </div>
    </div>
  );
}
