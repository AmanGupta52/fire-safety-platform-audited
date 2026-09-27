import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Image, Plus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, EmptyState, Badge } from '../../components/ui/Primitives';
import { Modal } from '../../components/ui/Modal';
import { SingleImageUploader } from '../../components/ui/ImageUploader';

type GallerySourceType = 'manual' | 'product' | 'category' | 'blog' | 'banner';

interface GalleryItem {
  _id: string;
  title: string;
  category: string;
  image: string;
  description?: string;
  sourceType: GallerySourceType;
  sourceId?: string;
  sourceLabel?: string;
}
interface FormValues { title: string; category: string; description?: string }

// Where "open source" for a mirrored photo should take the admin — that page reads the
// `open` query param on load and opens the matching record's edit form directly.
const SOURCE_PATH: Record<Exclude<GallerySourceType, 'manual'>, string> = {
  product: '/products',
  category: '/categories',
  blog: '/blog',
  banner: '/banners'
};
const SOURCE_LABEL: Record<GallerySourceType, string> = {
  manual: 'Added here',
  product: 'Product',
  category: 'Category',
  blog: 'Blog post',
  banner: 'Banner'
};
const SOURCE_TONE: Record<GallerySourceType, 'neutral' | 'info' | 'success' | 'warning'> = {
  manual: 'neutral',
  product: 'info',
  category: 'success',
  blog: 'warning',
  banner: 'info'
};

const TABS: { key: GallerySourceType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'product', label: 'Products' },
  { key: 'category', label: 'Categories' },
  { key: 'blog', label: 'Blog' },
  { key: 'banner', label: 'Banners' },
  { key: 'manual', label: 'Added here' }
];

export default function GalleryList() {
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<GallerySourceType | 'all'>('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetched once and filtered client-side — the dataset is small and this keeps tab
  // switches instant without a round trip, and keeps the "N photos" counts on the tabs
  // themselves in sync with what's actually loaded.
  const { data, isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: async () => (await api.get('/gallery')).data.data as GalleryItem[]
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return tab === 'all' ? data : data.filter((item) => item.sourceType === tab);
  }, [data, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length || 0 };
    for (const item of data || []) c[item.sourceType] = (c[item.sourceType] || 0) + 1;
    return c;
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/gallery/${id}`),
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['gallery'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  function openSource(item: GalleryItem) {
    if (item.sourceType === 'manual' || !item.sourceId) return;
    navigate(`${SOURCE_PATH[item.sourceType]}?open=${item.sourceId}`);
  }

  return (
    <div>
      <PageHeader
        title="Gallery"
        description="Every image in use across the site — products, categories and blog posts mirror here automatically, alongside photos added directly."
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Add photo</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              tab === t.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-slateink hover:bg-paper'
            )}
          >
            {t.label} ({counts[t.key] || 0})
          </button>
        ))}
      </div>

      {isLoading ? null : !filtered || filtered.length === 0 ? (
        <Card><EmptyState icon={Image} title="No photos here yet" description={tab === 'all' ? undefined : 'Try a different tab, or add a photo directly.'} /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <Card key={item._id} className="overflow-hidden">
              <div className="relative">
                <img src={item.image} alt={item.title} className="h-36 w-full object-cover" />
                {item.sourceType !== 'manual' && item.sourceId && (
                  <button
                    onClick={() => openSource(item)}
                    title={`Open ${SOURCE_LABEL[item.sourceType].toLowerCase()}`}
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-ink shadow hover:bg-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-ink">{item.sourceLabel || item.title}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Badge tone={SOURCE_TONE[item.sourceType]}>{SOURCE_LABEL[item.sourceType]}</Badge>
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
