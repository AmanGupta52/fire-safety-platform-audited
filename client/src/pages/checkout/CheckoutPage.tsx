import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useCart } from '../../hooks/useCart';
import { Address } from '../../types';
import { Card, Spinner } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

function formatInr(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }

interface AddressForm {
  contactName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string;
}

const STEPS = ['Address', 'Delivery', 'Payment', 'Review'] as const;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, isLoading } = useCart();
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mock' | 'cod'>('mock');
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const list = (await api.get('/addresses')).data.data as Address[];
      if (!selectedAddressId) {
        if (list.length > 0) setSelectedAddressId(list.find((a) => a.isDefault)?._id || list[0]._id);
        else setSelectedAddressId('new');
      }
      return list;
    }
  });

  const { register, getValues, formState: { errors }, trigger } = useForm<AddressForm>();

  // Steps are informational (this is a single-page checkout) — "Address" is active until an
  // address is chosen/entered, then Delivery + Payment read as complete since both have a
  // selection on this same page, and Review represents the final "Place order" action.
  const currentStepIndex = selectedAddressId ? 3 : 0;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      let shippingAddress: AddressForm;
      if (selectedAddressId === 'new') {
        const valid = await trigger();
        if (!valid) throw new Error('__validation__');
        shippingAddress = getValues();
      } else {
        const addr = addresses?.find((a) => a._id === selectedAddressId);
        if (!addr) throw new Error('Select a delivery address');
        shippingAddress = addr;
      }
      return (await api.post('/orders/checkout', {
        billingAddress: shippingAddress, shippingAddress, companyName: companyName || undefined,
        gstNumber: gstNumber || undefined, paymentMethod
      })).data.data;
    },
    onSuccess: (order) => { toast.success('Order placed!'); navigate(`/order-success?orderNumber=${order.orderNumber}`); },
    onError: (err: any) => { if (err.message !== '__validation__') toast.error(apiErrorMessage(err)); }
  });

  if (isLoading) return <Spinner />;
  if (!cart || cart.items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="container-page py-8">
      <h1 className="heading text-2xl text-ink">Checkout</h1>

      {/* Stepper */}
      <div className="mt-6 flex items-center">
        {STEPS.map((step, i) => {
          const isComplete = i < currentStepIndex;
          const isCurrent = i === currentStepIndex;
          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isCurrent ? 'bg-ink text-white' : isComplete ? 'bg-forest text-white' : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={clsx('hidden text-sm font-medium sm:inline', isCurrent ? 'text-ink' : isComplete ? 'text-ink' : 'text-slate-400')}>{step}</span>
              </div>
              {i < STEPS.length - 1 && <div className={clsx('mx-3 h-px flex-1', isComplete ? 'bg-forest' : 'bg-line')} />}
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <p className="heading text-sm text-ink">Delivery address</p>
            <div className="mt-4 flex flex-col gap-3">
              {(addresses || []).map((addr) => (
                <label key={addr._id} className={clsx('flex cursor-pointer items-start gap-3 rounded-card border p-3', selectedAddressId === addr._id ? 'border-ink bg-paper' : 'border-line')}>
                  <input type="radio" checked={selectedAddressId === addr._id} onChange={() => setSelectedAddressId(addr._id)} className="mt-1 accent-ink" />
                  <div className="text-sm">
                    <p className="font-medium text-ink">{addr.contactName} · {addr.phone}</p>
                    <p className="text-slateink">{addr.line1}, {addr.line2 && `${addr.line2}, `}{addr.city}, {addr.state} {addr.pincode}</p>
                  </div>
                </label>
              ))}
              <label className={clsx('flex cursor-pointer items-start gap-3 rounded-card border p-3', selectedAddressId === 'new' ? 'border-ink bg-paper' : 'border-line')}>
                <input type="radio" checked={selectedAddressId === 'new'} onChange={() => setSelectedAddressId('new')} className="mt-1 accent-ink" />
                <span className="text-sm font-medium text-ink">Use a new address</span>
              </label>
            </div>

            {selectedAddressId === 'new' && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
                <Input label="Full name" required error={errors.contactName?.message} {...register('contactName', { required: 'Required' })} />
                <Input label="Phone" required error={errors.phone?.message} {...register('phone', { required: 'Required' })} />
                <Input label="Address line 1" required className="col-span-2" error={errors.line1?.message} {...register('line1', { required: 'Required' })} />
                <Input label="Address line 2" className="col-span-2" {...register('line2')} />
                <Input label="City" required error={errors.city?.message} {...register('city', { required: 'Required' })} />
                <Input label="State" required error={errors.state?.message} {...register('state', { required: 'Required' })} />
                <Input label="Pincode" required error={errors.pincode?.message} {...register('pincode', { required: 'Required' })} />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="heading text-sm text-ink">Business details (optional)</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Input label="GSTIN" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
            </div>
          </Card>

          <Card className="p-5">
            <p className="heading text-sm text-ink">Payment method</p>
            <div className="mt-4 flex flex-col gap-2">
              <label className={clsx('flex cursor-pointer items-center gap-3 rounded-card border p-3', paymentMethod === 'mock' ? 'border-ink bg-paper' : 'border-line')}>
                <input type="radio" checked={paymentMethod === 'mock'} onChange={() => setPaymentMethod('mock')} className="accent-ink" />
                <span className="text-sm text-ink">Pay now (test payment)</span>
              </label>
              <label className={clsx('flex cursor-pointer items-center gap-3 rounded-card border p-3', paymentMethod === 'cod' ? 'border-ink bg-paper' : 'border-line')}>
                <input type="radio" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="accent-ink" />
                <span className="text-sm text-ink">Cash on delivery</span>
              </label>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          <Card className="p-5">
            <p className="heading text-sm text-ink">Order summary</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {cart.items.map((item) => (
                <div key={item.product._id} className="flex justify-between text-slateink">
                  <span className="line-clamp-1 pr-2">{item.product.name} × {item.quantity}</span>
                  <span className="shrink-0 text-ink">₹{((item.product.discountPrice ?? item.product.price) * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="my-1 border-t border-line" />
              <div className="flex justify-between text-slateink"><span>Subtotal</span><span>{formatInr(cart.subtotal)}</span></div>
              {cart.discount > 0 && <div className="flex justify-between text-forest"><span>Discount</span><span>-{formatInr(cart.discount)}</span></div>}
              <div className="flex justify-between text-slateink"><span>GST</span><span>{formatInr(cart.gstAmount)}</span></div>
              <div className="flex justify-between text-slateink"><span>Shipping</span><span>{cart.shippingFee === 0 ? 'Free' : formatInr(cart.shippingFee)}</span></div>
              <div className="my-1 border-t border-line" />
              <div className="flex justify-between font-medium text-ink"><span>Total</span><span>{formatInr(cart.total)}</span></div>
            </div>
            <Button fullWidth size="lg" className="mt-5" loading={checkoutMutation.isPending} disabled={!selectedAddressId} onClick={() => checkoutMutation.mutate()}>
              Place order
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
