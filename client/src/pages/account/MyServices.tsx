import { useQuery } from '@tanstack/react-query';
import { Wrench, Paperclip, User, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { ServiceBooking, Service } from '../../types';
import { Card, Badge, EmptyState, ErrorState } from '../../components/ui/Primitives';
import { SkeletonList } from '../../components/ui/Skeleton';

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning',
  confirmed: 'info',
  assigned: 'info',
  technician_on_the_way: 'info',
  in_progress: 'info',
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

export default function MyServices() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-services'],
    queryFn: async () => (await api.get('/services/my')).data.data as ServiceBooking[]
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading text-xl text-ink">Service history</h1>
          <p className="text-xs text-slateink mt-0.5">Track your past and scheduled equipment service requests.</p>
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
        <div className="mt-5 flex flex-col gap-3">
          {data.map((b) => {
            const serviceObj = typeof b.service === 'object' && b.service !== null ? (b.service as Service) : null;
            const displayName = serviceObj?.name || typeLabel[b.serviceType] || b.serviceType;
            const technician = typeof (b as any).assignedTechnician === 'object' ? (b as any).assignedTechnician : null;
            const reportUrl = (b as any).serviceReportUrl;

            return (
              <Card key={b._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink bg-paper px-2 py-0.5 rounded border border-line">
                      {b.bookingNumber}
                    </span>
                    <span className="text-sm font-semibold text-ink">{displayName}</span>
                  </div>

                  <p className="text-xs text-slateink">
                    Preferred: {format(new Date(b.preferredDate), 'd MMM yyyy')} {b.preferredTime ? `· ${b.preferredTime}` : ''}
                  </p>

                  {b.address && (
                    <p className="flex items-center gap-1 text-[11px] text-slateink/80 truncate max-w-md">
                      <MapPin className="h-3 w-3 shrink-0" /> {b.address}
                    </p>
                  )}

                  {technician?.name && (
                    <p className="flex items-center gap-1 text-[11px] text-forest font-medium">
                      <User className="h-3 w-3 shrink-0" /> Assigned technician: {technician.name}
                    </p>
                  )}

                  {reportUrl && (
                    <a
                      href={reportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-safety hover:underline"
                    >
                      <Paperclip className="h-3 w-3" /> View service report document ↗
                    </a>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t border-line/60 pt-2 sm:border-0 sm:pt-0">
                  <Badge tone={statusTone[b.status] || 'neutral'}>
                    {b.status.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-[10px] text-slateink/60">
                    Booked {format(new Date(b.createdAt), 'd MMM yyyy')}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
