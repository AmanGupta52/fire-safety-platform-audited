import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Product } from '../../types';
import { Card } from '../../components/ui/Primitives';
import { Input, Select, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

interface FormValues {
  customerName: string; companyName?: string; phone: string; email: string; gstNumber?: string; address?: string;
  items: { productId: string; quantity: number }[];
  requirements?: string; preferredDate?: string; additionalNotes?: string;
}

export default function RequestQuote() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ['products-for-quote'],
    queryFn: async () => (await api.get('/products', { params: { limit: 100 } })).data.data as Product[]
  });

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { items: [{ productId: '', quantity: 1 }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (await api.post('/quotes', values)).data.data,
    onSuccess: (data) => { toast.success('Quote request submitted!'); setSubmitted(data.quoteNumber); },
    onError: (err) => toast.error(apiErrorMessage(err))
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
      <h1 className="heading text-xl text-ink">Request a bulk quotation</h1>
      <p className="mt-1 text-sm text-slateink">For offices, factories, warehouses, schools, hospitals and societies — tell us what you need.</p>

      <Card className="mt-6 p-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate({ ...v, items: v.items.filter((i) => i.productId) }))}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Your name" required error={errors.customerName?.message} {...register('customerName', { required: 'Required' })} />
            <Input label="Company name" {...register('companyName')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" required error={errors.phone?.message} {...register('phone', { required: 'Required' })} />
            <Input label="Email" type="email" required error={errors.email?.message} {...register('email', { required: 'Required' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="GSTIN" {...register('gstNumber')} />
            <Input label="Preferred date" type="date" {...register('preferredDate')} />
          </div>
          <Textarea label="Delivery / site address" {...register('address')} />

          <div>
            <p className="mb-2 text-xs font-medium text-slateink">Products needed</p>
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <Select
                    className="flex-1" placeholder="Select a product"
                    options={(products || []).map((p) => ({ label: p.name, value: p._id }))}
                    {...register(`items.${index}.productId` as const, { required: true })}
                  />
                  <Input type="number" className="w-24" min={1} defaultValue={1} {...register(`items.${index}.quantity` as const, { valueAsNumber: true, min: 1 })} />
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="rounded p-2.5 text-brand hover:bg-brand-light"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => append({ productId: '', quantity: 1 })} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add another product
            </button>
          </div>

          <Textarea label="Requirements" placeholder="Any specific requirements, quantities, timelines..." {...register('requirements')} />
          <Textarea label="Additional notes" {...register('additionalNotes')} />

          <Button type="submit" loading={mutation.isPending} fullWidth>Submit quote request</Button>
        </form>
      </Card>
    </div>
  );
}
