import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlameKindling, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { CustomerEquipment, EquipmentStatus } from '../../types';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';

const statusTone: Record<EquipmentStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  healthy: 'success', inspection_due_soon: 'warning', refill_due_soon: 'warning', overdue: 'danger'
};
const statusLabel: Record<EquipmentStatus, string> = {
  healthy: 'Healthy', inspection_due_soon: 'Inspection due soon', refill_due_soon: 'Refill due soon', overdue: 'Overdue'
};

interface FormValues {
  productNameSnapshot: string; serialNumber: string; installationLocation?: string;
  purchaseDate?: string; installationDate?: string; nextInspectionDate?: string; nextRefillDate?: string; notes?: string;
}

export default function MyEquipment() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-equipment'],
    queryFn: async () => (await api.get('/equipment/my')).data.data as CustomerEquipment[]
  });

  const { register, handleSubmit, reset } = useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => api.post('/equipment/my', values),
    onSuccess: () => {
      toast.success('Equipment registered');
      queryClient.invalidateQueries({ queryKey: ['my-equipment'] });
      reset();
      setShowForm(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="heading text-xl text-ink">My equipment</h1>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Register equipment</Button>
      </div>
      <p className="mt-1 text-sm text-slateink">Track inspection and refill dates for your fire safety equipment.</p>

      {!data || data.length === 0 ? (
        <EmptyState icon={FlameKindling} title="No equipment registered yet" description="Register your fire extinguishers and other equipment to get automatic refill and inspection reminders." />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((e) => (
            <Card key={e._id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{e.productNameSnapshot}</p>
                  <p className="text-xs text-slateink">Serial: {e.serialNumber}</p>
                </div>
                <Badge tone={statusTone[e.status]}>{statusLabel[e.status]}</Badge>
              </div>
              {e.installationLocation && <p className="mt-2 text-xs text-slateink">Location: {e.installationLocation}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {e.nextInspectionDate && <div><p className="text-slateink">Next inspection</p><p className="text-ink">{format(new Date(e.nextInspectionDate), 'd MMM yyyy')}</p></div>}
                {e.nextRefillDate && <div><p className="text-slateink">Next refill</p><p className="text-ink">{format(new Date(e.nextRefillDate), 'd MMM yyyy')}</p></div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Register equipment" width="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Product name" required placeholder="e.g. ABC Dry Powder Extinguisher 4kg" {...register('productNameSnapshot', { required: true })} />
            <Input label="Serial number" required {...register('serialNumber', { required: true })} />
          </div>
          <Input label="Installation location" placeholder="e.g. 2nd floor kitchen" {...register('installationLocation')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Purchase date" type="date" {...register('purchaseDate')} />
            <Input label="Installation date" type="date" {...register('installationDate')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Next inspection date" type="date" {...register('nextInspectionDate')} />
            <Input label="Next refill date" type="date" {...register('nextRefillDate')} />
          </div>
          <Textarea label="Notes" {...register('notes')} />
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Register</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
