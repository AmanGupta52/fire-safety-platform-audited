import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, MapPin, Phone, Paperclip, Navigation, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ServiceBooking, ServiceStatus } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge, EmptyState } from '../../components/ui/Primitives';
import { Select, Input, Textarea } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { MultiImageUploader } from '../../components/ui/ImageUploader';

const statusTone: Record<ServiceStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', confirmed: 'info', assigned: 'info', technician_on_the_way: 'warning',
  in_progress: 'warning', completed: 'success', cancelled: 'danger', rejected: 'danger'
};

// HTML5 Signature Canvas for customer sign-off on mobile / tablet
function SignaturePad({ onSave, onClear }: { onSave: (dataUrl: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
    onSave(canvas.toDataURL('image/png'));
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-lg border-2 border-dashed border-line bg-card p-1">
        <canvas
          ref={canvasRef}
          width={400}
          height={130}
          className="h-28 w-full touch-none cursor-crosshair rounded bg-white shadow-inner"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium text-slateink/60">
            Sign inside this box (Customer Signature)
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slateink">Draw signature using touch, stylus or mouse</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-semibold text-brand hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

const TECHNICIAN_STATUS_OPTIONS: ServiceStatus[] = ['technician_on_the_way', 'in_progress'];

export default function MyJobs() {
  const [selected, setSelected] = useState<ServiceBooking | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: async () =>
      (await api.get('/bookings/technician/my-jobs')).data.data as {
        todaysJobs: ServiceBooking[]; upcomingJobs: ServiceBooking[]; overdueJobs?: ServiceBooking[]; completedJobs: ServiceBooking[];
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
      <PageHeader
        title="Technician Portal"
        description="Assigned equipment service jobs, on-site GPS check-in, and inspection reports."
      />
      {isLoading ? null : (
        <div className="flex flex-col gap-6">
          {(data?.overdueJobs?.length ?? 0) > 0 && (
            <JobSection title="Overdue (date has passed, not finished)" jobs={data?.overdueJobs || []} onSelect={setSelected} />
          )}
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
            <Card key={job._id} className="cursor-pointer p-4 transition-shadow hover:shadow-md" onClick={() => onSelect(job)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink">{job.bookingNumber}</span>
                    <span className="text-sm font-semibold capitalize text-ink">{job.serviceType.replace(/[-_]/g, ' ')}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slateink"><MapPin className="h-3 w-3" /> {job.address}</p>
                  <p className="flex items-center gap-1 text-xs text-slateink"><Phone className="h-3 w-3" /> {job.phone}</p>
                  <p className="mt-1 text-xs text-slateink">
                    {format(new Date(job.preferredDate), 'd MMM yyyy')}{job.timeSlot || job.preferredTime ? ` · ${job.timeSlot || job.preferredTime}` : ''}
                  </p>
                  {job.checkInLocation && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest">
                      <Navigation className="h-2.5 w-2.5" /> Checked-in On Site
                    </span>
                  )}
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
  // Technicians can only mark a job on the way / in progress; completing goes through the report below.
  const canWork = ['assigned', 'technician_on_the_way', 'in_progress'].includes(booking.status);
  const [status, setStatus] = useState<ServiceStatus>(
    TECHNICIAN_STATUS_OPTIONS.includes(booking.status) ? booking.status : 'technician_on_the_way'
  );
  const [pressureReading, setPressureReading] = useState(booking.pressureReading || '');
  const [sealIntact, setSealIntact] = useState(booking.sealIntact ?? true);
  const [physicalCondition, setPhysicalCondition] = useState(booking.physicalCondition || 'optimal');
  const [partsReplacedText, setPartsReplacedText] = useState((booking.partsReplaced || []).join(', '));
  const [workSummary, setWorkSummary] = useState(booking.workSummary || '');
  const [customerSignature, setCustomerSignature] = useState(booking.customerSignature || '');
  const [beforePhotos, setBeforePhotos] = useState<{ url: string; publicId?: string }[]>(
    (booking.beforePhotos || []).map((url) => ({ url }))
  );
  const [afterPhotos, setAfterPhotos] = useState<{ url: string; publicId?: string }[]>(
    (booking.afterPhotos || []).map((url) => ({ url }))
  );
  const [checkingIn, setCheckingIn] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-jobs'] });

  // 1. Quick status updater
  const statusMutation = useMutation({
    mutationFn: async () => api.patch(`/bookings/${booking._id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); invalidate(); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  // 2. GPS Check-in
  const handleCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post(`/bookings/${booking._id}/check-in`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: booking.address
          });
          toast.success('On-site GPS Check-In verified!');
          invalidate();
          setCheckingIn(false);
        } catch (err) {
          toast.error(apiErrorMessage(err));
          setCheckingIn(false);
        }
      },
      (err) => {
        toast.error(`GPS Error: ${err.message}`);
        setCheckingIn(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 3. Complete Mobile Flow & PDF Certificate Generation
  const completeMutation = useMutation({
    mutationFn: async () => {
      const parts = partsReplacedText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      return (
        await api.post(`/bookings/${booking._id}/complete-report`, {
          beforePhotos: beforePhotos.map((p) => p.url),
          afterPhotos: afterPhotos.map((p) => p.url),
          customerSignature,
          workSummary: workSummary.trim(),
          pressureReading,
          sealIntact,
          physicalCondition,
          partsReplaced: parts
        })
      ).data.data as ServiceBooking;
    },
    onSuccess: (updated) => {
      toast.success('Service completed & Certificate PDF generated!');
      invalidate();
      if (updated.serviceReportUrl) {
        window.open(updated.serviceReportUrl, '_blank');
      }
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`Job #${booking.bookingNumber}`} width="xl">
      <div className="flex flex-col gap-6">
        {/* Customer & Location Summary */}
        <div className="rounded-lg border border-line bg-paper p-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{typeof booking.user === 'object' ? booking.user.name : 'Customer'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slateink"><MapPin className="h-3.5 w-3.5 text-slateink" /> {booking.address}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slateink"><Phone className="h-3.5 w-3.5 text-slateink" /> {booking.phone}</p>
              {booking.problemDescription && (
                <p className="mt-2 text-xs italic text-slateink">Note: "{booking.problemDescription}"</p>
              )}
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <Badge tone={statusTone[booking.status]}>{booking.status.replace(/_/g, ' ')}</Badge>
              <span className="text-xs font-medium text-slateink">
                {format(new Date(booking.preferredDate), 'd MMM yyyy')}{booking.timeSlot ? ` (${booking.timeSlot})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* GPS Check-in Card */}
        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-brand" />
              <div>
                <p className="text-xs font-semibold text-ink">Technician On-Site Check-In</p>
                {booking.checkInLocation ? (
                  <p className="text-[11px] text-forest font-medium">
                    Verified: Lat {booking.checkInLocation.latitude.toFixed(4)}, Long {booking.checkInLocation.longitude.toFixed(4)} ({format(new Date(booking.checkInLocation.timestamp), 'p')})
                  </p>
                ) : (
                  <p className="text-[11px] text-slateink">Capture GPS coordinates upon reaching customer site</p>
                )}
              </div>
            </div>
            {booking.checkInLocation ? (
              <span className="inline-flex items-center gap-1 rounded bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest">
                <CheckCircle2 className="h-3.5 w-3.5" /> Checked In
              </span>
            ) : (
              <Button size="sm" onClick={handleCheckIn} loading={checkingIn}>
                <Navigation className="h-3.5 w-3.5" /> Check In Now
              </Button>
            )}
          </div>
        </div>

        {/* Official Certificate Banner if already completed */}
        {booking.serviceReportUrl && (
          <div className="flex items-center justify-between rounded-lg border border-forest/30 bg-forest/5 p-4">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-forest" />
              <div>
                <p className="text-xs font-bold text-forest">Official Service Certificate Issued</p>
                <p className="text-[11px] text-slateink">Tamper-evident certificate with customer signature & inspection readings.</p>
              </div>
            </div>
            <a
              href={booking.serviceReportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-forest/90"
            >
              <Paperclip className="h-3.5 w-3.5" /> View PDF Report
            </a>
          </div>
        )}

        {/* Mobile Inspection Form */}
        <div className="border-t border-line pt-4 flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slateink">Service & Inspection Readings</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Pressure Gauge Reading"
                value={pressureReading}
                onChange={(e) => setPressureReading(e.target.value)}
                placeholder="e.g. 15 bar (Normal Green Zone)"
              />
              <div className="mt-1.5 flex gap-1.5">
                {['15 bar (Normal)', '10 bar (Low)', '18 bar (High)'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPressureReading(p)}
                    className="rounded border border-line bg-paper px-2 py-0.5 text-[10px] text-slateink hover:text-ink"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Select
                label="Physical Condition"
                value={physicalCondition}
                onChange={(e) => setPhysicalCondition(e.target.value)}
                options={[
                  { label: 'Optimal / Ready for Use', value: 'optimal' },
                  { label: 'Fair / Minor Scratches', value: 'fair' },
                  { label: 'Damaged / Corroded', value: 'damaged' },
                  { label: 'Needs Replacement', value: 'needs_replacement' }
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sealIntact"
              checked={sealIntact}
              onChange={(e) => setSealIntact(e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
            />
            <label htmlFor="sealIntact" className="text-xs font-medium text-ink cursor-pointer">
              Safety pin seal and tamper indicator verified intact
            </label>
          </div>

          <Input
            label="Parts Replaced (comma separated)"
            placeholder="e.g. Discharge Hose, Rubber O-Ring, Wall Bracket"
            value={partsReplacedText}
            onChange={(e) => setPartsReplacedText(e.target.value)}
          />

          <Textarea
            label="Technician Work Summary & Recommendations"
            rows={2}
            placeholder="Extinguisher discharged test conducted, re-pressurized to 15 bar, hose cleared, certificate sticker affixed."
            value={workSummary}
            onChange={(e) => setWorkSummary(e.target.value)}
          />

          {/* Photo Documentation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slateink">Before Photos</p>
              <MultiImageUploader value={beforePhotos} onChange={setBeforePhotos} folder="service-reports" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slateink">After Photos</p>
              <MultiImageUploader value={afterPhotos} onChange={setAfterPhotos} folder="service-reports" />
            </div>
          </div>

          {/* Customer Signature Pad */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slateink">Customer Digital Signature Sign-Off</p>
            {booking.customerSignature && !customerSignature ? (
              <div className="rounded border border-line bg-paper p-3 text-center">
                <img src={booking.customerSignature} alt="Signed" className="mx-auto h-16 object-contain" />
                <p className="mt-1 text-[11px] text-slateink">Signature on file</p>
              </div>
            ) : (
              <SignaturePad
                onSave={setCustomerSignature}
                onClear={() => setCustomerSignature('')}
              />
            )}
          </div>

          {/* Submission Action */}
          <div className="mt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <Select
                label=""
                value={status}
                onChange={(e) => setStatus(e.target.value as ServiceStatus)}
                options={TECHNICIAN_STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMutation.mutate()}
                loading={statusMutation.isPending}
                disabled={status === booking.status || !canWork}
              >
                Update Status Only
              </Button>
            </div>

            <Button
              size="md"
              variant="primary"
              onClick={() => completeMutation.mutate()}
              loading={completeMutation.isPending}
              disabled={!canWork || !workSummary.trim()}
              title={!workSummary.trim() ? 'Write a work summary first' : undefined}
            >
              <ShieldCheck className="h-4 w-4" /> Complete Job & Issue Certificate PDF
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
