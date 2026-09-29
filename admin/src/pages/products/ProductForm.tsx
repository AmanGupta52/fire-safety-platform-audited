import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Product, Category } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { MultiImageUploader } from '../../components/ui/ImageUploader';

const schema = z.object({
  name: z.string().min(2, 'Required'),
  sku: z.string().min(2, 'Required'),
  category: z.string().min(1, 'Required'),
  brand: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  discountPrice: z.coerce.number().nonnegative().optional().or(z.literal('')),
  gstPercentage: z.coerce.number().min(0).max(100),
  stock: z.coerce.number().int().nonnegative(),
  minimumOrderQuantity: z.coerce.number().int().positive(),
  unit: z.string().min(1),
  capacity: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional()
});
type FormValues = z.infer<typeof schema>;

export default function ProductForm({
  product, categories, onClose
}: { product: Product | null; categories: Category[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(product);
  const [images, setImages] = useState<{ url: string; publicId?: string }[]>(product?.images || []);
  const [datasheetUrl, setDatasheetUrl] = useState(product?.datasheetUrl || '');
  // Content shown on the storefront product page tabs (Description / Specifications / Features).
  const [description, setDescription] = useState(product?.description || '');
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>(
    (product?.specifications || []).map((sp) => ({ key: sp.key, value: sp.value }))
  );
  const [features, setFeatures] = useState<string[]>(product?.features || []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name, sku: product.sku, category: typeof product.category === 'string' ? product.category : product.category._id,
          brand: product.brand, shortDescription: product.shortDescription, price: product.price,
          discountPrice: product.discountPrice, gstPercentage: product.gstPercentage, stock: product.stock,
          minimumOrderQuantity: product.minimumOrderQuantity, unit: product.unit, capacity: product.capacity,
          isFeatured: product.isFeatured, isBestSeller: product.isBestSeller, isActive: product.isActive
        }
      : { gstPercentage: 18, minimumOrderQuantity: 1, unit: 'pcs', isActive: true }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        discountPrice: values.discountPrice === '' ? undefined : values.discountPrice,
        images,
        datasheetUrl: datasheetUrl || undefined,
        // Always sent (even when empty) so clearing a field in the form actually clears it.
        description: description.trim(),
        specifications: specs.map((sp) => ({ key: sp.key.trim(), value: sp.value.trim() })).filter((sp) => sp.key && sp.value),
        features: features.map((f) => f.trim()).filter(Boolean)
      };
      if (isEdit && product) return api.put(`/products/${product._id}`, payload);
      return api.post('/products', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Product updated' : 'Product created');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const submit = (values: FormValues) => {
    const halfFilled = specs.some((sp) => Boolean(sp.key.trim()) !== Boolean(sp.value.trim()));
    if (halfFilled) {
      toast.error('Fill both the name and the value for every specification row, or remove the row.');
      return;
    }
    mutation.mutate(values);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit product' : 'Add product'} width="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Product name" required error={errors.name?.message} {...register('name')} />
          <Input label="SKU" required error={errors.sku?.message} {...register('sku')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category" required placeholder="Select a category" error={errors.category?.message}
            options={categories.map((c) => ({ label: c.name, value: c._id }))}
            {...register('category')}
          />
          <Input label="Brand" {...register('brand')} />
        </div>

        <Textarea label="Short description" {...register('shortDescription')} />

        <Textarea
          label="Description"
          hint="Shown in the Description tab on the product page."
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-slateink">Specifications</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setSpecs([...specs, { key: '', value: '' }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add specification
            </Button>
          </div>
          {specs.length === 0 ? (
            <p className="rounded border border-dashed border-line px-3 py-3 text-xs text-slateink">
              No specifications yet. Add rows like “Capacity — 6 kg” or “Discharge time — 15 sec”.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {specs.map((sp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    aria-label={`Specification ${i + 1} name`}
                    placeholder="Name (e.g. Capacity)"
                    value={sp.key}
                    onChange={(e) => setSpecs(specs.map((row, idx) => (idx === i ? { ...row, key: e.target.value } : row)))}
                    className="min-w-0 flex-1 rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none"
                  />
                  <input
                    aria-label={`Specification ${i + 1} value`}
                    placeholder="Value (e.g. 6 kg)"
                    value={sp.value}
                    onChange={(e) => setSpecs(specs.map((row, idx) => (idx === i ? { ...row, value: e.target.value } : row)))}
                    className="min-w-0 flex-1 rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-2 text-slateink hover:bg-paper hover:text-brand"
                    aria-label={`Remove specification ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-slateink">Features</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setFeatures([...features, ''])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add feature
            </Button>
          </div>
          {features.length === 0 ? (
            <p className="rounded border border-dashed border-line px-3 py-3 text-xs text-slateink">
              No features yet. Add short highlights like “ISI marked” or “5 year warranty”.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    aria-label={`Feature ${i + 1}`}
                    placeholder="e.g. ISI marked"
                    value={f}
                    onChange={(e) => setFeatures(features.map((row, idx) => (idx === i ? e.target.value : row)))}
                    className="min-w-0 flex-1 rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-2 text-slateink hover:bg-paper hover:text-brand"
                    aria-label={`Remove feature ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slateink">Product photos</p>
          <MultiImageUploader value={images} onChange={setImages} folder="products" />
        </div>

        <Input label="Datasheet URL (PDF)" placeholder="https://..." value={datasheetUrl} onChange={(e) => setDatasheetUrl(e.target.value)} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input label="Price (₹)" type="number" step="0.01" required error={errors.price?.message} {...register('price')} />
          <Input label="Discount price (₹)" type="number" step="0.01" {...register('discountPrice')} />
          <Input label="GST %" type="number" required error={errors.gstPercentage?.message} {...register('gstPercentage')} />
          <Input label="Stock" type="number" required error={errors.stock?.message} {...register('stock')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Min order qty" type="number" required error={errors.minimumOrderQuantity?.message} {...register('minimumOrderQuantity')} />
          <Input label="Unit" required error={errors.unit?.message} {...register('unit')} />
          <Input label="Capacity" placeholder="e.g. 4kg" {...register('capacity')} />
        </div>

        <div className="flex gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register('isFeatured')} /> Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register('isBestSeller')} /> Best seller
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register('isActive')} /> Active (visible on storefront)
          </label>
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create product'}</Button>
        </div>
      </form>
    </Modal>
  );
}
