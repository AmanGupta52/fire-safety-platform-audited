import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Image as ImageIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SingleImageUploader } from '../../components/ui/ImageUploader';

interface Banner { _id: string; title: string; image: string; linkUrl?: string; sortOrder: number; isActive: boolean }
interface FormValues { title: string; linkUrl?: string; sortOrder?: number; isActive?: boolean }

// Homepage hero banners — separate from Gallery's own "add a photo" flow, but every banner
// image mirrors into Gallery automatically (see server/galleryMirrorService) so it's still
// visible from that one place too.
export default function BannersList() {
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ['banners-admin'],
    // The public endpoint only returns active banners sorted for display — admin management
    // needs everything, active or not, so inactive banners aren't invisible here too.
    queryFn: async () => (await api.get('/banners?includeInactive=true')).data.data as Banner[]
  });

  // Lets the Gallery page open straight into a specific banner's edit form via
  // /banners?open=<id> instead of just landing on the list.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || !data) return;
    const match = data.find((b) => b._id === openId);
    if (match) setEditing(match);
    setSearchParams((prev) => { prev.delete('open'); return prev; }, { replace: true });
  }, [data, searchParams, setSearchParams]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/banners/${id}`),
    onSuccess: () => { toast.success('Banner deleted'); queryClient.invalidateQueries({ queryKey: ['banners-admin'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<Banner>[] = [
    { header: '', render: (b) => <img src={b.image} alt={b.title} className="h-10 w-16 rounded object-cover" /> },
    { header: 'Title', render: (b) => <span className="font-medium text-ink">{b.title}</span> },
    { header: 'Link', render: (b) => b.linkUrl || '—' },
    { header: 'Sort order', render: (b) => b.sortOrder },
    { header: 'Status', render: (b) => <Badge tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '', className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(b)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => { if (confirm('Delete this banner?')) deleteMutation.mutate(b._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Banners"
        description="Hero banners shown on the storefront homepage."
        actions={<Button onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add banner</Button>}
      />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(b) => b._id} isLoading={isLoading} emptyIcon={ImageIcon} emptyTitle="No banners yet" />
      </Card>
      {editing && <BannerForm banner={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BannerForm({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(banner);
  const [image, setImage] = useState(banner?.image || '');
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: banner ? { title: banner.title, linkUrl: banner.linkUrl, sortOrder: banner.sortOrder, isActive: banner.isActive } : { isActive: true, sortOrder: 0 }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!image) throw new Error('Please upload a banner image or paste an image URL');
      const payload = { ...values, image };
      return isEdit && banner ? api.put(`/banners/${banner._id}`, payload) : api.post('/banners', payload);
    },
    onSuccess: () => { toast.success(isEdit ? 'Banner updated' : 'Banner added'); queryClient.invalidateQueries({ queryKey: ['banners-admin'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit banner' : 'Add banner'}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Title" required {...register('title')} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-slateink">Banner image</p>
          <SingleImageUploader value={image} onChange={setImage} folder="banners" />
        </div>
        <Input label="Link URL" placeholder="e.g. /products?category=fire-extinguishers" {...register('linkUrl')} />
        <Input label="Sort order" type="number" {...register('sortOrder')} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isActive')} /> Active
        </label>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Add banner'}</Button>
        </div>
      </form>
    </Modal>
  );
}
