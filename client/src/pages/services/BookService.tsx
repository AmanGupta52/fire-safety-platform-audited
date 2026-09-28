import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Wrench, Loader2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/ui/Primitives';
import { Input, Select, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { useServices } from '../../hooks/useServices';
import { formatServicePrice } from '../../utils/serviceUtils';

interface FormValues {
  serviceId: string;
  phone: string;
  address: string;
  preferredDate: string;
  preferredTime?: string;
  problemDescription?: string;
}

export default function BookService() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const statePayload = location.state as {
    serviceId?: string;
    serviceType?: string;
    serviceName?: string;
  } | undefined;

  const [submitted, setSubmitted] = useState<string | null>(null);

  const { data: services, isLoading: servicesLoading } = useServices();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      serviceId: statePayload?.serviceId || '',
      phone: user?.phone || '',
      preferredTime: 'Morning (9:00 AM - 1:00 PM)'
    }
  });

  const selectedServiceId = watch('serviceId');
  const selectedService = services?.find(
    (s) => s._id === selectedServiceId || s.slug === selectedServiceId
  );

  useEffect(() => {
    if (services && services.length > 0) {
      if (statePayload?.serviceId) {
        const match = services.find((s) => s._id === statePayload.serviceId || s.slug === statePayload.serviceId);
        if (match) setValue('serviceId', match._id);
      } else if (statePayload?.serviceType) {
        const match = services.find((s) => s.slug === statePayload.serviceType);
        if (match) setValue('serviceId', match._id);
      } else if (!selectedServiceId) {
        setValue('serviceId', services[0]._id);
      }
    }
  }, [services, statePayload, setValue, selectedServiceId]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const activeService = services?.find((s) => s._id === values.serviceId);
      const payload = {
        serviceId: activeService?._id || values.serviceId,
        serviceType: activeService?.slug || 'installation',
        phone: values.phone,
        address: values.address,
        preferredDate: values.preferredDate,
        preferredTime: values.preferredTime,
        problemDescription: values.problemDescription
      };
      return (await api.post('/services', payload)).data.data;
    },
    onSuccess: (data) => {
      toast.success('Service booking confirmed!');
      setSubmitted(data.bookingNumber);
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (!accessToken) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-safety-light text-safety">
          <Wrench className="h-6 w-6" />
        </div>
        <h1 className="heading text-xl text-ink">Sign in to book a service</h1>
        <p className="max-w-md text-sm text-slateink">
          We link every booking to your account so you can track technician dispatch, inspection reports, and maintenance history.
        </p>
        <Button onClick={() => navigate('/login', { state: { from: '/book-service' } })}>
          Sign in to continue
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-forest" />
        <h1 className="heading text-2xl text-ink">Booking Confirmed!</h1>
        <p className="text-sm text-slateink">
          Your service request has been logged under reference number:
        </p>
        <span className="rounded bg-paper px-3 py-1 font-mono text-base font-semibold text-ink border border-line">
          {submitted}
        </span>
        <p className="max-w-md text-xs text-slateink mt-1">
          Our dispatch team will review your requirements and reach out to confirm your assigned technician.
        </p>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => navigate('/account/services')}>View my bookings</Button>
          <Button variant="secondary" onClick={() => setSubmitted(null)}>Book another service</Button>
        </div>
      </div>
    );
  }

  const serviceOptions = (services || []).map((s) => ({
    label: `${s.name} (from ${formatServicePrice(s.startingPrice, s.priceUnit, s.currency === 'INR' ? '₹' : s.currency)})`,
    value: s._id
  }));

  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="heading text-2xl text-ink">Book a service</h1>
      <p className="mt-1 text-sm text-slateink">
        Select a service and preferred date. Our operations team will assign a verified technician to your site.
      </p>

      <Card className="mt-6 p-6 shadow-sm">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          {servicesLoading ? (
            <div className="flex items-center gap-2 text-xs text-slateink">
              <Loader2 className="h-4 w-4 animate-spin text-safety" />
              Loading available services...
            </div>
          ) : (
            <Select
              label="Select service"
              required
              options={serviceOptions}
              error={errors.serviceId?.message}
              {...register('serviceId', { required: 'Please select a service' })}
            />
          )}

          {selectedService && (
            <div className="rounded border border-line bg-paper/60 p-3 text-xs text-slateink">
              <span className="font-medium text-ink">{selectedService.name}</span>
              {selectedService.shortDescription && <p className="mt-0.5">{selectedService.shortDescription}</p>}
              <p className="mt-1 text-safety font-medium">
                Starting from {formatServicePrice(selectedService.startingPrice, selectedService.priceUnit, selectedService.currency === 'INR' ? '₹' : selectedService.currency)}
              </p>
            </div>
          )}

          <Input
            label="Phone number"
            type="tel"
            required
            placeholder="+91-00000-00000"
            error={errors.phone?.message}
            {...register('phone', {
              required: 'Phone number is required',
              minLength: { value: 10, message: 'Please enter a valid phone number' }
            })}
          />

          <Textarea
            label="Service site address"
            required
            placeholder="Complete address including flat/unit number, building, landmark, and pincode"
            error={errors.address?.message}
            {...register('address', { required: 'Service address is required' })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Preferred date"
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              error={errors.preferredDate?.message}
              {...register('preferredDate', { required: 'Please select a date' })}
            />
            <Select
              label="Preferred time slot"
              options={[
                { label: 'Morning (9:00 AM - 1:00 PM)', value: 'Morning (9:00 AM - 1:00 PM)' },
                { label: 'Afternoon (1:00 PM - 5:00 PM)', value: 'Afternoon (1:00 PM - 5:00 PM)' },
                { label: 'Evening (5:00 PM - 8:00 PM)', value: 'Evening (5:00 PM - 8:00 PM)' },
                { label: 'Anytime during working hours', value: 'Anytime' }
              ]}
              {...register('preferredTime')}
            />
          </div>

          <Textarea
            label="Problem description or specific instructions (optional)"
            placeholder="e.g. 5 extinguishers need refill; alarm panel showing trouble indicator on Zone 2..."
            {...register('problemDescription')}
          />

          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={servicesLoading}
            fullWidth
            className="mt-2"
          >
            Confirm service booking
          </Button>
        </form>
      </Card>
    </div>
  );
}
