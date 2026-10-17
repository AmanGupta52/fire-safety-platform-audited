import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Minus, Plus, Trash2 } from 'lucide-react';
import { api, toastApiError } from '../../lib/apiClient';
import { ProductSearchHit } from '../../types';
import { formatInr } from '../../lib/format';
import { ProductSearchBox } from '../../components/search/ProductSearchBox';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { Card } from '../../components/ui/Primitives';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { MetaTags } from '../../components/seo/MetaTags';
import { gstinRules, phoneRules } from '../../lib/validators';

interface FormValues {
  customerName: string; companyName?: string; phone: string; email: string; gstNumber?: string; address?: string;
  items: { productId: string; quantity: number }[];
  requirements?: string; preferredDate?: string; additionalNotes?: string;
}

export default function RequestQuote() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { register, control, handleSubmit, setValue, getValues, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { items: [{ productId: '', quantity: 1 }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // The product chosen for each row, kept by the row's stable id so removing a middle row never shifts another's.
  const [picked, setPicked] = useState<Record<string, ProductSearchHit>>({});
  const items = watch('items');
  const chosenIds = Object.values(picked).map((p) => p._id);
  const totalUnits = (items || []).reduce((sum, i) => sum + (i.productId ? Number(i.quantity) || 0 : 0), 0);

  function setQuantity(index: number, next: number) {
    setValue(`items.${index}.quantity`, Math.min(100000, Math.max(1, Math.floor(next) || 1)), { shouldValidate: true });
  }

  function pickProduct(index: number, rowId: string, product: ProductSearchHit) {
    // Choosing something that is already on the list adds to that line instead of creating a duplicate.
    const existing = getValues('items').findIndex((row, i) => i !== index && row.productId === product._id);
    if (existing !== -1) {
      setQuantity(existing, (Number(getValues(`items.${existing}.quantity`)) || 1) + 1);
      toast.success(`${product.name} is already on your list: quantity increased`);
      return;
    }
    setPicked((prev) => ({ ...prev, [rowId]: product }));
    setValue(`items.${index}.productId`, product._id, { shouldValidate: true, shouldDirty: true });
  }

  function clearProduct(index: number, rowId: string) {
    setPicked((prev) => { const { [rowId]: _removed, ...rest } = prev; return rest; });
    setValue(`items.${index}.productId`, '', { shouldDirty: true });
  }

  function removeRow(index: number, rowId: string) {
    setPicked((prev) => { const { [rowId]: _removed, ...rest } = prev; return rest; });
    remove(index);
  }

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/quotes', values)).data.data,
    onSuccess: (data) => {
      toast.success('Quote request submitted!');
      queryClient.invalidateQueries({ queryKey: ['my-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['my-quotes-summary'] });
      setSubmitted(data.quoteNumber);
    },
    onError: toastApiError
  });

  if (submitted) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-3 py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-forest" />
        <h1 className="heading text-xl text-ink">Quote request received</h1>
        <p className="text-sm text-slateink">Reference: <span className="font-medium text-ink">{submitted}</span></p>
        <p className="max-w-sm text-sm text-slateink">Our team will review your requirements and send a priced quotation within one business day.</p>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <MetaTags title="Request a quote" description="Tell us what you need and get a quote for fire safety equipment or services." />
      <h1 className="heading text-xl text-ink">Request a bulk quotation</h1>
      <p className="mt-1 text-sm text-slateink">For offices, factories, warehouses, schools, hospitals and societies — tell us what you need.</p>

      <Card className="mt-6 p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate({ ...v, items: v.items.filter((i) => i.productId) }))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Your name" required error={errors.customerName?.message} {...register('customerName', { required: 'Required' })} />
            <Input label="Company name" {...register('companyName')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" required type="tel" inputMode="tel" error={errors.phone?.message} {...register('phone', phoneRules)} />
            <Input label="Email" type="email" required error={errors.email?.message} {...register('email', { required: 'Required' })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="GSTIN" maxLength={15} error={errors.gstNumber?.message} {...register('gstNumber', gstinRules)} />
            <Input label="Preferred date" type="date" {...register('preferredDate')} />
          </div>
          <Textarea label="Delivery / site address" {...register('address')} />

          <div>
            <p className="mb-1 text-xs font-medium text-slateink">Products needed <span className="text-safety" aria-hidden="true">*</span></p>
            <p className="mb-3 text-xs text-slateink">Search by name, model number (SKU) or brand, then set the quantity.</p>
            <div className="flex flex-col gap-3">
              {fields.map((field, index) => {
                const product = picked[field.id];
                const unitPrice = product ? (product.discountPrice ?? product.price) : 0;
                const quantity = Number(items?.[index]?.quantity) || 1;
                return (
                  <div key={field.id} className="skeuo-card rounded-card p-3">
                    {/* The id is the real form value; it is set by choosing a product from the search. */}
                    <input type="hidden" {...register(`items.${index}.productId` as const, { required: 'Choose a product from the search results, or remove this row' })} />

                    {product ? (
                      <div className="flex items-center gap-3">
                        <ImageWithFallback src={product.image} alt={product.name} className="h-14 w-14 shrink-0 overflow-hidden rounded border border-line bg-white" imgClassName="object-contain p-0.5" fallbackLabel="" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
                          <p className="truncate text-xs text-slateink">{product.sku}{product.brand ? ` · ${product.brand}` : ''} · {formatInr(unitPrice)} each</p>
                        </div>
                        <button type="button" onClick={() => clearProduct(index, field.id)} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-safety hover:bg-safety-light">Change</button>
                      </div>
                    ) : (
                      <ProductSearchBox
                        variant="field"
                        ariaLabel={`Search for product ${index + 1}`}
                        placeholder="Search by name, SKU or brand…"
                        selectedIds={chosenIds}
                        onSelect={(p) => pickProduct(index, field.id, p)}
                      />
                    )}
                    {errors.items?.[index]?.quantity && (
                      <p role="alert" className="mt-1.5 text-xs text-safety">{errors.items[index]?.quantity?.message}</p>
                    )}
                    {errors.items?.[index]?.productId && (
                      <p role="alert" className="mt-1.5 text-xs text-safety">{errors.items[index]?.productId?.message}</p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slateink">Qty</span>
                        <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(index, quantity - 1)} disabled={quantity <= 1} className="skeuo-btn skeuo-plate flex h-9 w-9 items-center justify-center rounded disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                        <input
                          type="number" inputMode="numeric" min={1} max={100000} aria-label={`Quantity for product ${index + 1}`}
                          className="skeuo-inset h-9 w-16 rounded text-center text-sm text-ink outline-none"
                          {...register(`items.${index}.quantity` as const, { valueAsNumber: true, validate: (v) => (Number.isInteger(v) && v >= 1) || 'Enter a whole number, 1 or more' })}
                        />
                        <button type="button" aria-label="Increase quantity" onClick={() => setQuantity(index, quantity + 1)} className="skeuo-btn skeuo-plate flex h-9 w-9 items-center justify-center rounded"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex items-center gap-3">
                        {product && <span className="text-sm font-semibold text-ink">{formatInr(unitPrice * quantity)}</span>}
                        {fields.length > 1 && (
                          <button aria-label="Remove item" type="button" onClick={() => removeRow(index, field.id)} className="rounded p-2 text-safety hover:bg-safety-light"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => append({ productId: '', quantity: 1 })} className="flex items-center gap-1.5 text-sm font-medium text-safety hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add another product
              </button>
              {totalUnits > 0 && <p className="text-xs text-slateink">{chosenIds.length} product{chosenIds.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'} · prices are indicative, you will get a formal quotation</p>}
            </div>
          </div>

          <Textarea label="Requirements" placeholder="Any specific requirements, quantities, timelines..." {...register('requirements')} />
          <Textarea label="Additional notes" {...register('additionalNotes')} />

          <Button type="submit" loading={mutation.isPending} fullWidth>Submit quote request</Button>
        </form>
      </Card>
    </div>
  );
}
