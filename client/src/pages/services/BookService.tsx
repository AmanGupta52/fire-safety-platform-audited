import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Wrench, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Card, Spinner } from '../../components/ui/Primitives';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { useServices } from '../../hooks/useServices';
import { formatServicePrice } from '../../utils/serviceUtils';
import { CustomerEquipment } from '../../types';

interface BookingSlot {
  slot: string;
  label: string;
  period: string;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isAvailable: boolean;
}

interface FormValues {
  serviceId: string;
  equipmentId?: string;
  phone: string;
  address: string;
  preferredDate: string;
  timeSlot: string;
  problemDescription?: string;
}

const STEPS = [
  { id: 1, name: 'Service', description: 'Pick service type' },
  { id: 2, name: 'Equipment & Site', description: 'Extinguisher & location' },
  { id: 3, name: 'Date & Slot', description: 'Select certified slot' },
  { id: 4, name: 'Confirm', description: 'Review & schedule' }
];

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

  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const defaultDateStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      serviceId: statePayload?.serviceId || '',
      equipmentId: '',
      phone: user?.phone || '',
      address: '',
      preferredDate: defaultDateStr,
      timeSlot: '09:00 - 11:00',
      problemDescription: ''
    }
  });

  const selectedServiceId = watch('serviceId');
  const selectedEquipmentId = watch('equipmentId');
  const selectedDate = watch('preferredDate');
  const selectedTimeSlot = watch('timeSlot');
  const enteredAddress = watch('address');
  const enteredPhone = watch('phone');

  const { data: services, isLoading: servicesLoading } = useServices();

  // Load customer's registered equipment
  const { data: equipmentList } = useQuery({
    queryKey: ['my-equipment-for-booking'],
    queryFn: async () => (await api.get('/equipment/my')).data.data as CustomerEquipment[],
    enabled: Boolean(accessToken)
  });

  // Load live slot availability for chosen date
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['service-slots', selectedDate],
    queryFn: async () =>
      (await api.get(`/bookings/slots?date=${selectedDate}`)).data.data as {
        date: string;
        totalTechnicians: number;
        slots: BookingSlot[];
      },
    enabled: Boolean(selectedDate)
  });

  // Pre-select service from route navigation state
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

  const selectedService = services?.find(
    (s) => s._id === selectedServiceId || s.slug === selectedServiceId
  );

  const selectedEquipment = equipmentList?.find((e) => e._id === selectedEquipmentId);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const activeService = services?.find((s) => s._id === values.serviceId);
      const payload = {
        // The server resolves the service from the live catalog, so only real catalog ids/slugs are sent.
        // (It used to fall back to 'installation' here, which could silently book the wrong service.)
        serviceId: activeService?._id || values.serviceId,
        ...(activeService?.slug ? { serviceType: activeService.slug } : {}),
        equipmentId: values.equipmentId || undefined,
        phone: values.phone,
        address: values.address,
        preferredDate: values.preferredDate,
        timeSlot: values.timeSlot,
        preferredTime: values.timeSlot,
        problemDescription: values.problemDescription
      };
      return (await api.post('/bookings', payload)).data.data;
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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 text-forest">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="heading text-2xl text-ink">Service Scheduled Successfully!</h1>
        <p className="text-sm text-slateink">
          Your service booking reference number is:
        </p>
        <span className="rounded bg-paper px-4 py-1.5 font-mono text-lg font-bold text-ink border border-line">
          {submitted}
        </span>
        <p className="max-w-md text-xs text-slateink mt-1">
          A certified field technician will arrive at your site within the selected slot. You can track assignment and service updates from your account.
        </p>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => navigate('/account/services')}>View My Service History</Button>
          <Button variant="ghost" onClick={() => { setSubmitted(null); setCurrentStep(1); }}>
            Book Another Service
          </Button>
        </div>
      </div>
    );
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedServiceId) {
        toast.error('Please select a service');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!enteredPhone || enteredPhone.trim().length < 10) {
        toast.error('Please enter a valid 10-digit contact phone number');
        return;
      }
      if (!enteredAddress || enteredAddress.trim().length < 5) {
        toast.error('Please enter the service location address');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!selectedDate) {
        toast.error('Please select a preferred date');
        return;
      }
      if (!selectedTimeSlot) {
        toast.error('Please select an available time slot');
        return;
      }
      setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 text-center sm:text-left">
        <h1 className="heading text-2xl sm:text-3xl text-ink">Schedule Fire Safety Service</h1>
        <p className="mt-1 text-sm text-slateink">
          Certified on-site refill, inspection, installation, or audit with digital inspection certificates.
        </p>
      </div>

      {/* Progress Bar & Stepper */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <div key={s.id} className="flex flex-col">
                <div
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    isCompleted ? 'bg-forest' : isCurrent ? 'bg-safety' : 'bg-line'
                  }`}
                />
                <div className="mt-2 hidden sm:block">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    isCurrent ? 'text-safety' : isCompleted ? 'text-forest' : 'text-slateink/60'
                  }`}>
                    Step {s.id}
                  </span>
                  <p className={`text-xs font-semibold ${isCurrent ? 'text-ink' : 'text-slateink'}`}>
                    {s.name}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Form Container */}
      <div className="max-w-3xl mx-auto">
        <Card className="p-6 sm:p-8">
          {/* STEP 1: SERVICE SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="heading text-lg text-ink">Step 1: Select Service Type</h2>
                <p className="text-xs text-slateink">Choose the certified service required for your facility</p>
              </div>

              {servicesLoading ? (
                <div className="py-12 flex justify-center"><Spinner /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {(services || []).map((service) => {
                    const isSelected = selectedServiceId === service._id || selectedServiceId === service.slug;
                    return (
                      <div
                        key={service._id}
                        onClick={() => setValue('serviceId', service._id)}
                        className={`cursor-pointer rounded-lg border p-4 transition-all ${
                          isSelected
                            ? 'border-safety bg-safety-light/30 shadow-card'
                            : 'border-line hover:border-slateink/40 bg-card'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-ink">{service.name}</p>
                            <p className="mt-1 text-xs text-slateink line-clamp-2">
                              {service.shortDescription || service.description}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-safety text-white text-xs">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                          <span className="text-[11px] text-slateink">Starting at</span>
                          <span className="text-sm font-bold text-safety">
                            {formatServicePrice(service.startingPrice, service.priceUnit ? ` / ${service.priceUnit}` : '')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: EQUIPMENT & SITE LOCATION */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="heading text-lg text-ink">Step 2: Equipment & Location Details</h2>
                <p className="text-xs text-slateink">Specify the equipment to inspect/refill and technician dispatch address</p>
              </div>

              {/* Equipment Selection */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slateink">
                  Select Equipment (Optional)
                </label>
                {equipmentList && equipmentList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                    <div
                      onClick={() => setValue('equipmentId', '')}
                      className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                        !selectedEquipmentId ? 'border-safety bg-safety-light/30 font-semibold' : 'border-line bg-paper'
                      }`}
                    >
                      <p className="text-ink">New / Unlisted Equipment</p>
                      <p className="text-[11px] text-slateink">Technician will register serial on site</p>
                    </div>

                    {equipmentList.map((eq) => (
                      <div
                        key={eq._id}
                        onClick={() => setValue('equipmentId', eq._id)}
                        className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                          selectedEquipmentId === eq._id ? 'border-safety bg-safety-light/30' : 'border-line bg-paper'
                        }`}
                      >
                        <p className="font-semibold text-ink truncate">{eq.productNameSnapshot}</p>
                        <p className="text-[11px] text-slateink">Serial: {eq.serialNumber}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slateink mb-2">
                    No equipment registered yet. Our technician will create a digital equipment passport during the visit.
                  </p>
                )}
              </div>

              {/* Location & Contact Inputs */}
              <div className="space-y-4">
                <Input
                  label="Contact Phone Number *"
                  placeholder="e.g. 9876543210"
                  {...register('phone', { required: true, minLength: 10 })}
                />

                <Input
                  label="Service Location Address *"
                  placeholder="e.g. Unit 402, Building 3, Tech Park, Andheri East, Mumbai"
                  {...register('address', { required: true, minLength: 5 })}
                />
              </div>
            </div>
          )}

          {/* STEP 3: DATE & CAPACITY-AWARE BOOKING SLOTS */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="heading text-lg text-ink">Step 3: Choose Date & Booking Slot</h2>
                <p className="text-xs text-slateink">
                  Technician availability is tracked live to prevent overbooking and guarantee timely arrival.
                </p>
              </div>

              {/* Date Input */}
              <div className="max-w-xs">
                <label className="mb-1 block text-xs font-semibold text-slateink">Preferred Service Date</label>
                <input
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={selectedDate}
                  onChange={(e) => setValue('preferredDate', e.target.value)}
                  className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink focus:border-safety focus:outline-none"
                />
              </div>

              {/* Capacity Slots */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slateink">
                  Available Slots for {format(new Date(selectedDate), 'EEEE, d MMMM yyyy')}
                </label>

                {slotsLoading ? (
                  <div className="py-8 flex justify-center"><Spinner /></div>
                ) : !slotsData || slotsData.slots.length === 0 ? (
                  <p className="py-4 text-xs text-slateink">No slots configured for this date.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {slotsData.slots.map((s) => {
                      const isSelected = selectedTimeSlot === s.slot;
                      return (
                        <div
                          key={s.slot}
                          onClick={() => {
                            if (s.isAvailable) setValue('timeSlot', s.slot);
                          }}
                          className={`rounded-lg border p-4 transition-all ${
                            !s.isAvailable
                              ? 'opacity-50 cursor-not-allowed border-line bg-paper/50'
                              : isSelected
                              ? 'cursor-pointer border-safety bg-safety-light/30 shadow-card'
                              : 'cursor-pointer border-line hover:border-slateink/40 bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-ink">{s.label}</p>
                              <span className="mt-1 text-[11px] text-slateink capitalize">{s.period} window</span>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                !s.isAvailable
                                  ? 'bg-rose-100 text-rose-700'
                                  : isSelected
                                  ? 'bg-safety text-white'
                                  : 'bg-forest/10 text-forest'
                              }`}
                            >
                              {s.isAvailable ? `${s.remainingCapacity} slots left` : 'Fully Booked'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="heading text-lg text-ink">Step 4: Review & Confirm Booking</h2>
                <p className="text-xs text-slateink">Double check your service details before dispatching technician</p>
              </div>

              {/* Summary Card */}
              <div className="divide-y divide-line rounded-lg border border-line bg-paper/40 p-4 text-xs">
                <div className="flex items-center justify-between pb-3">
                  <span className="text-slateink">Service:</span>
                  <span className="font-bold text-ink">{selectedService?.name || 'Fire Safety Service'}</span>
                </div>
                {selectedEquipment && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-slateink">Target Equipment:</span>
                    <span className="font-medium text-ink">{selectedEquipment.productNameSnapshot} ({selectedEquipment.serialNumber})</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slateink">Date & Slot:</span>
                  <span className="font-semibold text-forest">
                    {format(new Date(selectedDate), 'd MMM yyyy')} · {selectedTimeSlot}
                  </span>
                </div>
                <div className="flex items-start justify-between py-2.5">
                  <span className="text-slateink">Site Location:</span>
                  <span className="font-medium text-ink text-right max-w-xs">{enteredAddress}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slateink">Customer Phone:</span>
                  <span className="font-medium text-ink">{enteredPhone}</span>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <span className="text-slateink">Estimated Starting Rate:</span>
                  <span className="font-bold text-safety text-sm">
                    {selectedService ? formatServicePrice(selectedService.startingPrice, selectedService.priceUnit ? ` / ${selectedService.priceUnit}` : '') : 'Rate card on arrival'}
                  </span>
                </div>
              </div>

              {/* Special instructions / Problem Description */}
              <Textarea
                label="Problem Description or Access Instructions (Optional)"
                placeholder="e.g. Pressure gauge is showing red zone; please contact security guard at Gate 2 for entry."
                rows={3}
                {...register('problemDescription')}
              />
            </div>
          )}

          {/* Wizard Action Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-line pt-4">
            {currentStep > 1 ? (
              <Button type="button" variant="ghost" onClick={handlePrevStep}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : <div />}

            {currentStep < 4 ? (
              <Button type="button" onClick={handleNextStep}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit((data) => mutation.mutate(data))}
                loading={mutation.isPending}
              >
                <ShieldCheck className="h-4 w-4" /> Confirm & Book Service
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
