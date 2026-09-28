import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Service, ServiceImage } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';
import { SingleImageUploader, MultiImageUploader } from '../../components/ui/ImageUploader';

const CATEGORY_OPTIONS = [
  { label: 'Installation', value: 'installation' },
  { label: 'Refilling', value: 'refilling' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Fire Safety Audit', value: 'audit' },
  { label: 'AMC Maintenance', value: 'amc' },
  { label: 'Repair & Overhaul', value: 'repair' },
  { label: 'General / Other', value: 'other' }
];

const schema = z.object({
  name: z.string().min(2, 'Name is required (at least 2 characters)'),
  slug: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  shortDescription: z.string().optional(),
  description: z.string().min(5, 'Description is required'),
  startingPrice: z.coerce.number().min(0, 'Must be positive or zero'),
  priceUnit: z.string().min(1, 'Unit is required (e.g. /unit, /visit)'),
  estimatedDuration: z.string().optional(),
  displayOrder: z.coerce.number().int().default(0),
  featuresText: z.string().optional(),
  inclusionsText: z.string().optional(),
  exclusionsText: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isActive: z.boolean().default(true),
  isPublished: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
});

type FormValues = z.infer<typeof schema>;

interface Props {
  service: Service | null;
  onClose: () => void;
}

export default function ServiceFormModal({ service, onClose }: Props) {
  const isEdit = Boolean(service);
  const queryClient = useQueryClient();

  const [imageUrl, setImageUrl] = useState<string>(
    typeof service?.image === 'string'
      ? service.image
      : (service?.image as ServiceImage)?.url || ''
  );

  const [galleryImages, setGalleryImages] = useState<{ url: string; publicId?: string }[]>(
    (service?.gallery || []).map((img) =>
      typeof img === 'string' ? { url: img } : { url: (img as ServiceImage).url, publicId: (img as ServiceImage).publicId }
    )
  );

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: service
      ? {
          name: service.name,
          slug: service.slug,
          category: service.category,
          shortDescription: service.shortDescription || '',
          description: service.description,
          startingPrice: service.startingPrice,
          priceUnit: service.priceUnit || '/unit',
          estimatedDuration: service.estimatedDuration || '',
          displayOrder: service.displayOrder ?? 0,
          featuresText: service.features?.join('\n') || '',
          inclusionsText: service.inclusions?.join('\n') || '',
          exclusionsText: service.exclusions?.join('\n') || '',
          seoTitle: service.seoTitle || '',
          seoDescription: service.seoDescription || '',
          isActive: service.isActive ?? true,
          isPublished: service.isPublished ?? true,
          isFeatured: service.isFeatured ?? false
        }
      : {
          name: '',
          slug: '',
          category: 'installation',
          shortDescription: '',
          description: '',
          startingPrice: 299,
          priceUnit: '/unit',
          estimatedDuration: '1-2 hours',
          displayOrder: 0,
          featuresText: '',
          inclusionsText: '',
          exclusionsText: '',
          seoTitle: '',
          seoDescription: '',
          isActive: true,
          isPublished: true,
          isFeatured: false
        }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const parseLines = (text?: string) =>
        text
          ? text.split('\n').map((l) => l.trim()).filter(Boolean)
          : [];

      const payload = {
        name: values.name,
        slug: values.slug ? values.slug.trim().toLowerCase() : undefined,
        category: values.category,
        shortDescription: values.shortDescription?.trim() || undefined,
        description: values.description.trim(),
        startingPrice: values.startingPrice,
        priceUnit: values.priceUnit.trim(),
        estimatedDuration: values.estimatedDuration?.trim() || undefined,
        displayOrder: values.displayOrder,
        features: parseLines(values.featuresText),
        inclusions: parseLines(values.inclusionsText),
        exclusions: parseLines(values.exclusionsText),
        seoTitle: values.seoTitle?.trim() || undefined,
        seoDescription: values.seoDescription?.trim() || undefined,
        isActive: values.isActive,
        isPublished: values.isPublished,
        isFeatured: values.isFeatured,
        image: imageUrl ? { url: imageUrl } : undefined,
        gallery: galleryImages.map((g) => ({ url: g.url, publicId: g.publicId }))
      };

      if (isEdit && service) {
        return api.put(`/services/catalog/${service._id}`, payload);
      }
      return api.post('/services/catalog', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Service updated successfully' : 'Service created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Service: ${service?.name}` : 'Create New Service'} width="lg">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Service Name" required error={errors.name?.message} {...register('name')} placeholder="e.g. Fire Extinguisher Refilling" />
          <Input label="Slug (URL identifier)" hint="Leave blank to auto-generate from name" error={errors.slug?.message} {...register('slug')} placeholder="e.g. fire-extinguisher-refilling" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Category" required options={CATEGORY_OPTIONS} error={errors.category?.message} {...register('category')} />
          <Input label="Starting Price (₹)" type="number" required error={errors.startingPrice?.message} {...register('startingPrice')} />
          <Input label="Price Unit" required placeholder="/unit, /visit, /yr" error={errors.priceUnit?.message} {...register('priceUnit')} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Short Description (Summary)" placeholder="One-line overview shown on cards" {...register('shortDescription')} />
          <Input label="Estimated Duration" placeholder="e.g. 1-2 hours or 1 day" {...register('estimatedDuration')} />
        </div>

        <Textarea label="Full Description" required error={errors.description?.message} {...register('description')} placeholder="Detailed description of what the service covers..." rows={3} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Textarea label="Features (one per line)" placeholder="Certified Technicians&#10;Digital Service Record&#10;ISI Compliant" {...register('featuresText')} rows={3} />
          <Textarea label="Inclusions (one per line)" placeholder="Complete pressure testing&#10;Discharge nozzle check&#10;Safety seal replacement" {...register('inclusionsText')} rows={3} />
          <Textarea label="Exclusions (one per line)" placeholder="Major spare replacements&#10;Off-site transport charges" {...register('exclusionsText')} rows={3} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slateink">Primary Cover Image</label>
            <SingleImageUploader value={imageUrl} onChange={setImageUrl} folder="services" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slateink">Gallery Images</label>
            <MultiImageUploader value={galleryImages} onChange={setGalleryImages} folder="services" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 border-y border-line py-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
            <span className="text-xs font-medium text-ink">Active (Catalog visible)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isPublished')} className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
            <span className="text-xs font-medium text-ink">Published (Customer bookable)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isFeatured')} className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
            <span className="text-xs font-medium text-ink">Featured on Home</span>
          </label>
          <div className="ml-auto w-32">
            <Input label="Display Order" type="number" {...register('displayOrder')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Update Service' : 'Create Service'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
