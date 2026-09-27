import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/ui/Primitives';
import { Input, Select, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

const SERVICE_TYPES = [
  { label: 'Installation', value: 'installation' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Refilling', value: 'refilling' },
  { label: 'Repair', value: 'repair' },
  { label: 'Fire Safety Audit', value: 'fire_safety_audit' },
  { label: 'AMC Visit', value: 'amc_visit' }
];

interface FormValues {
  serviceType: string; phone: string; address: string; preferredDate: string; preferredTime?: string; problemDescription?: string;
}

export default function BookService() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const presetType = (location.state as { serviceType?: string })?.serviceType;
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { serviceType: presetType || 'installation' }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/services', values)).data.data,
    onSuccess: (data) => { toast.success('Service booked!'); setSubmitted(data.bookingNumber); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (!accessToken) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="heading text-xl text-ink">Sign in to book a service</h1>
        <p className="text-sm text-slateink">We link every booking to your account so you can track its status.</p>
        <Button onClick={() => navigate('/login', { state: { from: '/book-service' } })}>Sign in</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-3 py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-forest" />
        <h1 className="heading text-xl text-ink">Booking confirmed</h1>
        <p className="text-sm text-slateink">Reference: <span className="font-medium text-ink">{submitted}</span></p>
        <Button onClick={() => navigate('/account/services')}>View my bookings</Button>
      </div>
    );
  }

  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="heading text-xl text-ink">Book a service</h1>
      <p className="mt-1 text-sm text-slateink">Tell us what you need and when — we'll confirm a technician slot shortly.</p>

      <Card className="mt-6 p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          <Select label="Service type" required options={SERVICE_TYPES} error={errors.serviceType?.message} {...register('serviceType', { required: true })} />
          <Input label="Phone number" required error={errors.phone?.message} {...register('phone', { required: 'Required' })} />
          <Textarea label="Service address" required error={errors.address?.message} {...register('address', { required: 'Required' })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Preferred date" type="date" required error={errors.preferredDate?.message} {...register('preferredDate', { required: 'Required' })} />
            <Input label="Preferred time" placeholder="e.g. Morning" {...register('preferredTime')} />
          </div>
          <Textarea label="Describe the issue or requirement" {...register('problemDescription')} />
          <Button type="submit" loading={mutation.isPending} fullWidth>Book service</Button>
        </form>
      </Card>
    </div>
  );
}
