import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { ServiceBooking } from '../../types';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui/Primitives';

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', confirmed: 'info', assigned: 'info', technician_on_the_way: 'info',
  in_progress: 'info', completed: 'success', cancelled: 'danger'
};
const typeLabel: Record<string, string> = {
  installation: 'Installation', inspection: 'Inspection', refilling: 'Refilling',
  repair: 'Repair', fire_safety_audit: 'Fire Safety Audit', amc_visit: 'AMC Visit'
};

export default function MyServices() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-services'],
    queryFn: async () => (await api.get('/services/my')).data.data as ServiceBooking[]
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1 className="heading text-xl text-ink">Service history</h1>

      {!data || data.length === 0 ? (
        <EmptyState icon={Wrench} title="No service bookings yet" description="Book an installation, inspection, refill or audit to see it here." />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {data.map((b) => (
            <Card key={b._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{b.bookingNumber} · {typeLabel[b.serviceType]}</p>
                <p className="text-xs text-slateink">{format(new Date(b.preferredDate), 'd MMM yyyy')} {b.preferredTime}</p>
              </div>
              <Badge tone={statusTone[b.status]}>{b.status.replace(/_/g, ' ')}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
