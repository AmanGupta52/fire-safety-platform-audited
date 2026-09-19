import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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
      const payload = { ...values, discountPrice: values.discountPrice === '' ? undefined : values.discountPrice, images, datasheetUrl: datasheetUrl || undefined };
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

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit product' : 'Add product'} width="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product name" required error={errors.name?.message} {...register('name')} />
          <Input label="SKU" required error={errors.sku?.message} {...register('sku')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category" required placeholder="Select a category" error={errors.category?.message}
            options={categories.map((c) => ({ label: c.name, value: c._id }))}
            {...register('category')}
          />
          <Input label="Brand" {...register('brand')} />
        </div>

        <Textarea label="Short description" {...register('shortDescription')} />

        <div>
          <p className="mb-1.5 text-xs font-medium text-slateink">Product photos</p>
          <MultiImageUploader value={images} onChange={setImages} folder="products" />
        </div>

        <Input label="Datasheet URL (PDF)" placeholder="https://..." value={datasheetUrl} onChange={(e) => setDatasheetUrl(e.target.value)} />

        <div className="grid grid-cols-4 gap-4">
          <Input label="Price (₹)" type="number" step="0.01" required error={errors.price?.message} {...register('price')} />
          <Input label="Discount price (₹)" type="number" step="0.01" {...register('discountPrice')} />
          <Input label="GST %" type="number" required error={errors.gstPercentage?.message} {...register('gstPercentage')} />
          <Input label="Stock" type="number" required error={errors.stock?.message} {...register('stock')} />
        </div>

        <div className="grid grid-cols-3 gap-4">
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
