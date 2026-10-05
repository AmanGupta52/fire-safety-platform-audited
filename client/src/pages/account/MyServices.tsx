import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, User, MapPin, Calendar, Star, QrCode, FileText } from 'lucide-react';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { ServiceBooking, Service } from '../../types';
import { Card, Badge, EmptyState, ErrorState, Spinner } from '../../components/ui/Primitives';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea, Input } from '../../components/ui/FormControls';
import { TrackingTimeline } from '../../components/tracking/TrackingTimeline';

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning',
  confirmed: 'info',
  assigned: 'info',
  technician_on_the_way: 'warning',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger'
};

const typeLabel: Record<string, string> = {
  installation: 'Installation',
  inspection: 'Inspection',
  refilling: 'Refilling',
  repair: 'Repair',
  fire_safety_audit: 'Fire Safety Audit',
  amc_visit: 'AMC Visit'
};

const SERVICE_TRACKING_STEPS = [
  { key: 'requested', label: 'Requested', description: 'Request received' },
  { key: 'confirmed', label: 'Confirmed', description: 'Schedule verified' },
  { key: 'assigned', label: 'Technician Assigned', description: 'Staff allocated' },
  { key: 'technician_on_the_way', label: 'On The Way', description: 'En route to site' },
  { key: 'in_progress', label: 'In Progress', description: 'On-site service' },
  { key: 'completed', label: 'Completed', description: 'Report certified' }
];

export default function MyServices() {
  const queryClient = useQueryClient();
  const [rescheduleBooking, setRescheduleBooking] = useState<ServiceBooking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<ServiceBooking | null>(null);
  const [reviewBooking, setReviewBooking] = useState<ServiceBooking | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-services'],
    queryFn: async () => (await api.get('/bookings/my')).data.data as ServiceBooking[]
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading text-xl text-ink">Service history & tracking</h1>
          <p className="text-xs text-slateink mt-0.5">
            Real-time status tracker, technician dispatches, official service certificates, and slot management.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5"><SkeletonList count={4} /></div>
      ) : isError ? (
        <ErrorState title="Couldn't load your service history" onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No service bookings yet"
          description="Book an installation, inspection, refill or audit to see technician updates and service records here."
        />
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {data.map((b) => {
            const serviceObj = typeof b.service === 'object' && b.service !== null ? (b.service as Service) : null;
            const displayName = serviceObj?.name || typeLabel[b.serviceType] || b.serviceType;
            const technician = typeof b.assignedTechnician === 'object' ? b.assignedTechnician : null;
            const isCompleted = b.status === 'completed';
            const isCancelled = b.status === 'cancelled' || b.status === 'rejected';
            // Mirrors the server: rescheduling is allowed until a technician is on the way; cancelling until work starts.
            const canReschedule = ['requested', 'confirmed', 'assigned'].includes(b.status);
            const canCancel = ['requested', 'confirmed', 'assigned', 'technician_on_the_way'].includes(b.status);

            return (
              <Card key={b._id} className="p-5 flex flex-col gap-5">
                {/* Header & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink bg-paper px-2 py-0.5 rounded border border-line">
                        {b.bookingNumber}
                      </span>
                      <span className="text-base font-bold text-ink">{displayName}</span>
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slateink">
                      <Calendar className="h-3.5 w-3.5 text-slateink" />
                      Scheduled: <span className="font-semibold text-ink">{format(new Date(b.preferredDate), 'd MMMM yyyy')}</span>
                      {b.timeSlot || b.preferredTime ? ` · ${b.timeSlot || b.preferredTime}` : ''}
                    </p>

                    {b.address && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slateink truncate max-w-lg">
                        <MapPin className="h-3.5 w-3.5 text-slateink" /> {b.address}
                      </p>
                    )}

                    {technician?.name && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-forest font-semibold">
                        <User className="h-3.5 w-3.5" /> Assigned Technician: {technician.name} {technician.phone ? `(${technician.phone})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end justify-between gap-2">
                    <Badge tone={statusTone[b.status] || 'neutral'}>
                      {b.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-[10px] text-slateink">
                      Requested {format(new Date(b.createdAt), 'd MMM yyyy')}
                    </span>
                  </div>
                </div>

                {/* Live Delivery-Style Tracking Timeline */}
                <div className="rounded-lg bg-paper/40 p-4 border border-line/60">
                  <TrackingTimeline
                    steps={SERVICE_TRACKING_STEPS}
                    currentStepKey={b.status}
                    isCancelled={isCancelled}
                    cancelReason={b.status === 'cancelled' ? 'This service booking was cancelled.' : 'This booking was rejected.'}
                  />
                </div>

                {/* Actions & Official Document Links */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* View Certificate PDF if completed */}
                    {b.serviceReportUrl && (
                      <a
                        href={b.serviceReportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest/20 transition-colors"
                      >
                        <FileText className="h-4 w-4" /> Download Official Service Certificate (PDF)
                      </a>
                    )}

                    {/* View Passport if equipment is linked */}
                    {b.equipment && (
                      <Link
                        to={`/passport/${typeof b.equipment === 'object' ? (b.equipment as any).serialNumber || (b.equipment as any)._id : b.equipment}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-safety hover:underline"
                      >
                        <QrCode className="h-3.5 w-3.5" /> View Equipment Passport
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Customer Reschedule */}
                    {canReschedule && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRescheduleBooking(b)}
                        className="text-xs"
                      >
                        Reschedule Slot
                      </Button>
                    )}

                    {/* Customer Cancel */}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCancelBooking(b)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        Cancel Booking
                      </Button>
                    )}

                    {/* Leave Review for Completed Booking */}
                    {isCompleted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReviewBooking(b)}
                        className="text-xs inline-flex items-center gap-1 text-amber-600 hover:bg-amber-50"
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> Rate Service
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onSuccess={() => {
            setRescheduleBooking(null);
            queryClient.invalidateQueries({ queryKey: ['my-services'] });
          }}
        />
      )}

      {/* Cancel Modal */}
      {cancelBooking && (
        <CancelModal
          booking={cancelBooking}
          onClose={() => setCancelBooking(null)}
          onSuccess={() => {
            setCancelBooking(null);
            queryClient.invalidateQueries({ queryKey: ['my-services'] });
          }}
        />
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSuccess={() => {
            setReviewBooking(null);
            queryClient.invalidateQueries({ queryKey: ['my-services'] });
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// RESCHEDULE MODAL WITH LIVE CAPACITY SLOTS
// ----------------------------------------------------------------------
function RescheduleModal({
  booking,
  onClose,
  onSuccess
}: {
  booking: ServiceBooking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newDate, setNewDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState(booking.timeSlot || '09:00 - 11:00');
  const [reason, setReason] = useState('');

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['service-slots-reschedule', newDate],
    queryFn: async () =>
      (await api.get(`/bookings/slots?date=${newDate}`)).data.data as {
        slots: { slot: string; label: string; remainingCapacity: number; isAvailable: boolean }[];
      },
    enabled: Boolean(newDate)
  });

  const mutation = useMutation({
    mutationFn: async () =>
      api.patch(`/bookings/${booking._id}/reschedule`, {
        preferredDate: newDate,
        timeSlot: selectedSlot,
        reason
      }),
    onSuccess: () => {
      toast.success('Service booking rescheduled successfully');
      onSuccess();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`Reschedule Booking #${booking.bookingNumber}`} width="md">
      <div className="space-y-4">
        <p className="text-xs text-slateink">
          Select a new preferred service date and an available certified slot window.
        </p>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slateink">New Service Date</label>
          <input
            type="date"
            min={format(new Date(), 'yyyy-MM-dd')}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink focus:border-safety focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slateink">
            Available Slots
          </label>
          {slotsLoading ? (
            <div className="py-4 flex justify-center"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {(slotsData?.slots || []).map((s) => (
                <div
                  key={s.slot}
                  onClick={() => { if (s.isAvailable) setSelectedSlot(s.slot); }}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    !s.isAvailable
                      ? 'opacity-40 cursor-not-allowed bg-paper'
                      : selectedSlot === s.slot
                      ? 'border-safety bg-safety-light/30 font-semibold'
                      : 'border-line hover:border-slateink/40'
                  }`}
                >
                  <span className="text-ink">{s.label}</span>
                  <span className={`text-[10px] rounded px-2 py-0.5 font-bold ${
                    s.isAvailable ? 'bg-forest/10 text-forest' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {s.isAvailable ? `${s.remainingCapacity} slots left` : 'Full'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Textarea
          label="Reason for Rescheduling (Optional)"
          placeholder="e.g. Site undergoing maintenance; reschedule to morning."
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Confirm Reschedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// CANCEL MODAL
// ----------------------------------------------------------------------
function CancelModal({
  booking,
  onClose,
  onSuccess
}: {
  booking: ServiceBooking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: async () =>
      api.patch(`/bookings/${booking._id}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Booking cancelled');
      onSuccess();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`Cancel Booking #${booking.bookingNumber}`} width="md">
      <div className="space-y-4">
        <p className="text-xs text-slateink">
          Are you sure you want to cancel this booking? If you only need to change the time, you can reschedule instead.
        </p>

        <Textarea
          label="Cancellation Reason"
          placeholder="e.g. No longer required / Found alternative"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>Keep Booking</Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            Cancel Booking
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// REVIEW MODAL FOR COMPLETED BOOKING
// ----------------------------------------------------------------------
function ReviewModal({
  booking,
  onClose,
  onSuccess
}: {
  booking: ServiceBooking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: async () =>
      api.post('/reviews/booking', {
        bookingId: booking._id,
        rating,
        title,
        comment
      }),
    onSuccess: () => {
      toast.success('Thank you! Your review has been submitted for moderation.');
      onSuccess();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`Rate Service #${booking.bookingNumber}`} width="md">
      <div className="space-y-4">
        <p className="text-xs text-slateink">
          Share your experience with the technician and servicing quality to help us improve.
        </p>

        {/* Rating Stars */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slateink">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={`h-6 w-6 ${
                    star <= rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-transparent text-slateink/30'
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-xs font-semibold text-ink">{rating} out of 5 stars</span>
          </div>
        </div>

        <Input
          label="Headline (Optional)"
          placeholder="e.g. Prompt, thorough inspection and certified on time"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          label="Your Feedback *"
          placeholder="Tell us about the technician's professionalism, equipment inspection, and service quality..."
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!comment.trim()}
          >
            Submit Review
          </Button>
        </div>
      </div>
    </Modal>
  );
}
