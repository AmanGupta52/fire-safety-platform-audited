import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, EmptyState } from '../../components/ui/Primitives';
import { Modal } from '../../components/ui/Modal';
import { SingleImageUploader } from '../../components/ui/ImageUploader';

interface GalleryItem { _id: string; title: string; category: string; image: string; description?: string }
interface FormValues { title: string; category: string; description?: string }

export default function GalleryList() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: async () => (await api.get('/gallery')).data.data as GalleryItem[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/gallery/${id}`),
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['gallery'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <div>
      <PageHeader title="Gallery" description="Installation and project photos shown on the storefront." actions={<Button onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Add photo</Button>} />

      {isLoading ? null : !data || data.length === 0 ? (
        <Card><EmptyState icon={Image} title="No gallery photos yet" /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((item) => (
            <Card key={item._id} className="overflow-hidden">
              <img src={item.image} alt={item.title} className="h-36 w-full object-cover" />
              <div className="p-3">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slateink">{item.category}</span>
                  <button onClick={() => { if (confirm('Remove this photo?')) deleteMutation.mutate(item._id); }} className="rounded p-1 text-brand hover:bg-brand-light">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <GalleryForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function GalleryForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [image, setImage] = useState('');
  const { register, handleSubmit } = useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!image) throw new Error('Please upload a photo or paste an image URL');
      return api.post('/gallery', { ...values, image });
    },
    onSuccess: () => { toast.success('Photo added'); queryClient.invalidateQueries({ queryKey: ['gallery'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title="Add gallery photo">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Title" required {...register('title')} />
        <Input label="Category" required placeholder="e.g. Installations" {...register('category')} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-slateink">Photo</p>
          <SingleImageUploader value={image} onChange={setImage} folder="gallery" />
        </div>
        <Input label="Description" {...register('description')} />
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Add photo</Button>
        </div>
      </form>
    </Modal>
  );
}
