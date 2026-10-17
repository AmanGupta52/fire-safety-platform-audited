import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { api, toastApiError } from '../../lib/apiClient';
import { useCart } from '../../hooks/useCart';
import { Address } from '../../types';
import { Card } from '../../components/ui/Primitives';
import { PageLoader } from '../../components/ui/Loader';
import { Input } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { MetaTags } from '../../components/seo/MetaTags';
import { formatInr } from '../../lib/format';
import { MESSAGES, isValidGstin, normalizeGstin, optionalTextRules, phoneRules, pincodeRules, requiredTextRules } from '../../lib/validators';

interface AddressForm {
  contactName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string;
}

const STEPS = ['Address', 'Delivery', 'Payment', 'Review'] as const;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cart, isLoading } = useCart();
  // Set the moment an order succeeds. Placing the order empties the cart, and without this flag the "cart is
  // empty" redirect below would fire in the gap before we reach the success page and bounce the shopper to /cart.
  const orderPlacedRef = useRef(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null);
  // Online payment isn't wired up to a real payment gateway yet, so Cash on Delivery is the
  // only method offered at checkout for now — nothing here should look like a working "pay
  // online" option before one actually exists.
  const paymentMethod = 'cod' as const;
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState<string | undefined>();

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data.data as Address[]
  });

  // Pre-select an address once the list is available (also when it comes straight from the cache on a return
  // visit): the default address, else the first one, else the "new address" form.
  useEffect(() => {
    if (!addresses || selectedAddressId !== null) return;
    setSelectedAddressId(addresses.find((a) => a.isDefault)?._id ?? addresses[0]?._id ?? 'new');
  }, [addresses, selectedAddressId]);

  const { register, getValues, formState: { errors }, trigger } = useForm<AddressForm>({ mode: 'onTouched' });

  function validateGstin(value: string): boolean {
    const ok = isValidGstin(value);
    setGstError(ok ? undefined : MESSAGES.gstin);
    return ok;
  }

  // Steps are informational (this is a single-page checkout) — "Address" is active until an
  // address is chosen/entered, then Delivery + Payment read as complete since both have a
  // selection on this same page, and Review represents the final "Place order" action.
  const currentStepIndex = selectedAddressId ? 3 : 0;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!validateGstin(gstNumber)) throw new Error('__validation__');
      let shippingAddress: AddressForm;
      if (selectedAddressId === 'new') {
        const valid = await trigger(undefined, { shouldFocus: true });
        if (!valid) throw new Error('__validation__');
        shippingAddress = getValues();
      } else {
        const addr = addresses?.find((a) => a._id === selectedAddressId);
        if (!addr) throw new Error('Select a delivery address');
        shippingAddress = addr;
      }
      return (await api.post('/orders/checkout', {
        billingAddress: shippingAddress, shippingAddress, companyName: companyName.trim() || undefined,
        gstNumber: normalizeGstin(gstNumber) || undefined, paymentMethod
      })).data.data;
    },
    onSuccess: (order) => {
      orderPlacedRef.current = true;
      toast.success('Order placed!');
      // The order just emptied the server-side cart: refresh everything that shows it, or the header badge and
      // the cart page keep showing the old items.
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders-summary'] });
      queryClient.invalidateQueries({ queryKey: ['my-notifications-full'] });
      navigate(`/order-success?orderNumber=${encodeURIComponent(order.orderNumber)}`, { replace: true });
    },
    onError: (err) => { if (!(err instanceof Error && err.message === '__validation__')) toastApiError(err); }
  });

  if (isLoading) return <PageLoader label="Loading checkout" />;
  if (!cart || cart.items.length === 0) {
    // After a successful order the cart is empty on purpose and we are already on our way to the success page.
    if (orderPlacedRef.current) return null;
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="container-page py-8">
      <MetaTags title="Checkout" noindex />
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
                    isCurrent ? 'bg-ink text-on-ink' : isComplete ? 'bg-forest text-white' : 'bg-slate-100 text-slate-400'
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
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-line pt-4">
                <Input label="Full name" required autoComplete="name" error={errors.contactName?.message} {...register('contactName', requiredTextRules)} />
                <Input label="Phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" error={errors.phone?.message} {...register('phone', phoneRules)} />
                <Input label="Address line 1" required className="col-span-2" autoComplete="address-line1" error={errors.line1?.message} {...register('line1', requiredTextRules)} />
                <Input label="Address line 2" className="col-span-2" autoComplete="address-line2" error={errors.line2?.message} {...register('line2', optionalTextRules)} />
                <Input label="City" required autoComplete="address-level2" error={errors.city?.message} {...register('city', requiredTextRules)} />
                <Input label="State" required autoComplete="address-level1" error={errors.state?.message} {...register('state', requiredTextRules)} />
                <Input label="Pincode" required inputMode="numeric" maxLength={6} autoComplete="postal-code" error={errors.pincode?.message} {...register('pincode', pincodeRules)} />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="heading text-sm text-ink">Business details (optional)</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Company name" maxLength={100} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Input
                label="GSTIN"
                maxLength={15}
                placeholder="22AAAAA0000A1Z5"
                value={gstNumber}
                error={gstError}
                onChange={(e) => { setGstNumber(e.target.value.toUpperCase()); if (gstError) setGstError(undefined); }}
                onBlur={() => validateGstin(gstNumber)}
              />
            </div>
          </Card>

          <Card className="p-5">
            <p className="heading text-sm text-ink">Payment method</p>
            <div className="mt-4 flex items-center gap-3 rounded-card border border-ink bg-paper p-3">
              <Check className="h-4 w-4 shrink-0 text-ink" />
              <span className="text-sm text-ink">Cash on delivery</span>
            </div>
            <p className="mt-2 text-xs text-slateink">Online payment isn't available yet — pay the delivery agent when your order arrives.</p>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24">
          <Card variant="glass" className="p-5">
            <p className="heading text-sm text-ink">Order summary</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {cart.items.map((item) => (
                <div key={item.product._id} className="flex justify-between text-slateink">
                  <span className="line-clamp-1 pr-2">{item.product.name} × {item.quantity}</span>
                  <span className="shrink-0 text-ink">{formatInr((item.product.discountPrice ?? item.product.price) * item.quantity)}</span>
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
