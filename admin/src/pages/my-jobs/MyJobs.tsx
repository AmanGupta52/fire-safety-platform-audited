import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, MapPin, Phone, FileUp, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ServiceBooking, ServiceStatus } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge, EmptyState } from '../../components/ui/Primitives';
import { Select, Input } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { MultiImageUploader } from '../../components/ui/ImageUploader';

const STATUS_OPTIONS: ServiceStatus[] = ['confirmed', 'assigned', 'technician_on_the_way', 'in_progress', 'completed', 'cancelled'];
const statusTone: Record<ServiceStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', confirmed: 'info', assigned: 'info', technician_on_the_way: 'warning',
  in_progress: 'warning', completed: 'success', cancelled: 'danger'
};

// This is the page linked-in technicians (see the "linked staff login" field on the
// Technicians admin form) land on to see their own assignments — previously the backend
// endpoint (GET /services/technician/my-jobs) had no page anywhere calling it at all.
export default function MyJobs() {
  const [selected, setSelected] = useState<ServiceBooking | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: async () =>
      (await api.get('/services/technician/my-jobs')).data.data as {
        todaysJobs: ServiceBooking[]; upcomingJobs: ServiceBooking[]; completedJobs: ServiceBooking[];
      }
  });

  if (error) {
    return (
      <div>
        <PageHeader title="My jobs" />
        <Card><EmptyState icon={Wrench} title="No technician profile linked" description={apiErrorMessage(error)} /></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My jobs" description="Service bookings assigned to you." />
      {isLoading ? null : (
        <div className="flex flex-col gap-6">
          <JobSection title="Today" jobs={data?.todaysJobs || []} onSelect={setSelected} />
          <JobSection title="Upcoming" jobs={data?.upcomingJobs || []} onSelect={setSelected} />
          <JobSection title="Completed (recent)" jobs={data?.completedJobs || []} onSelect={setSelected} />
        </div>
      )}
      {selected && <JobDetailModal booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function JobSection({ title, jobs, onSelect }: { title: string; jobs: ServiceBooking[]; onSelect: (b: ServiceBooking) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slateink">{title} ({jobs.length})</p>
      {jobs.length === 0 ? (
        <Card><p className="p-4 text-sm text-slateink">Nothing here.</p></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <Card key={job._id} className="cursor-pointer p-4 hover:shadow-md" onClick={() => onSelect(job)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{job.bookingNumber} · {job.serviceType.replace(/_/g, ' ')}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slateink"><MapPin className="h-3 w-3" /> {job.address}</p>
                  <p className="flex items-center gap-1 text-xs text-slateink"><Phone className="h-3 w-3" /> {job.phone}</p>
                  <p className="mt-1 text-xs text-slateink">{format(new Date(job.preferredDate), 'd MMM yyyy')}{job.preferredTime ? ` · ${job.preferredTime}` : ''}</p>
                </div>
                <Badge tone={statusTone[job.status]}>{job.status.replace(/_/g, ' ')}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function JobDetailModal({ booking, onClose }: { booking: ServiceBooking; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ServiceStatus>(booking.status);
  const [reportUrl, setReportUrl] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<{ url: string; publicId?: string }[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<{ url: string; publicId?: string }[]>([]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-jobs'] });

  const statusMutation = useMutation({
    mutationFn: async () => api.patch(`/services/${booking._id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); invalidate(); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const reportMutation = useMutation({
    mutationFn: async () =>
      api.post(`/services/${booking._id}/report`, {
        serviceReportUrl: reportUrl || undefined,
        beforePhotos: beforePhotos.map((p) => p.url),
        afterPhotos: afterPhotos.map((p) => p.url)
      }),
    onSuccess: () => { toast.success('Report saved'); invalidate(); setReportUrl(''); setBeforePhotos([]); setAfterPhotos([]); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={booking.bookingNumber} width="lg">
      <div className="flex flex-col gap-5">
        <div className="text-sm">
          <p className="text-ink">{booking.address}</p>
          <p className="text-xs text-slateink">{booking.phone}</p>
          {booking.problemDescription && <p className="mt-2 text-xs text-slateink">"{booking.problemDescription}"</p>}
        </div>

        <div className="flex items-end gap-3">
          <Select
            label="Update status" className="flex-1" value={status}
            onChange={(e) => setStatus(e.target.value as ServiceStatus)}
            options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
          />
          <Button onClick={() => statusMutation.mutate()} loading={statusMutation.isPending} disabled={status === booking.status}>Update</Button>
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-slateink">Service report</p>
          {(booking.serviceReportUrl || booking.beforePhotos.length > 0 || booking.afterPhotos.length > 0) && (
            <div className="mb-3 flex flex-col gap-2 rounded border border-line bg-paper p-3">
              {booking.serviceReportUrl && (
                <a href={booking.serviceReportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                  <Paperclip className="h-3 w-3" /> Current report ↗
                </a>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Input label="Report link (optional)" placeholder="https://..." value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-slateink">Before photos</p>
                <MultiImageUploader value={beforePhotos} onChange={setBeforePhotos} folder="service-reports" />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slateink">After photos</p>
                <MultiImageUploader value={afterPhotos} onChange={setAfterPhotos} folder="service-reports" />
              </div>
            </div>
            <Button size="sm" onClick={() => reportMutation.mutate()} loading={reportMutation.isPending}
              disabled={!reportUrl && beforePhotos.length === 0 && afterPhotos.length === 0}>
              <FileUp className="h-3.5 w-3.5" /> Save report
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
