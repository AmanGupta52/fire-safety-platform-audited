import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Newspaper, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { BlogPost } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SingleImageUploader } from '../../components/ui/ImageUploader';

interface FormValues { title: string; excerpt?: string; content: string; category?: string; tags?: string; isPublished?: boolean }

export default function BlogList() {
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['blog-admin'],
    queryFn: async () => (await api.get('/blog/admin/all')).data.data as BlogPost[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/blog/admin/${id}`),
    onSuccess: () => { toast.success('Post deleted'); queryClient.invalidateQueries({ queryKey: ['blog-admin'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<BlogPost>[] = [
    { header: 'Title', render: (p) => <span className="font-medium text-ink">{p.title}</span> },
    { header: 'Category', render: (p) => p.category || '—' },
    { header: 'Status', render: (p) => <Badge tone={p.isPublished ? 'success' : 'neutral'}>{p.isPublished ? 'Published' : 'Draft'}</Badge> },
    { header: 'Updated', render: (p) => format(new Date(p.createdAt), 'd MMM yyyy') },
    {
      header: '', className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(p)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => { if (confirm(`Delete "${p.title}"?`)) deleteMutation.mutate(p._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Blog" description="Publish fire-safety guides and articles to the storefront." actions={<Button onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> New post</Button>} />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(p) => p._id} isLoading={isLoading} emptyIcon={Newspaper} emptyTitle="No posts yet" />
      </Card>
      {editing && <BlogForm post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BlogForm({ post, onClose }: { post: BlogPost | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(post);
  const [featuredImage, setFeaturedImage] = useState(post?.featuredImage || '');
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: post
      ? { title: post.title, excerpt: post.excerpt, content: post.content, category: post.category, tags: post.tags.join(', '), isPublished: post.isPublished }
      : { isPublished: false }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, tags: values.tags ? values.tags.split(',').map((t) => t.trim()) : [], featuredImage: featuredImage || undefined };
      return isEdit && post ? api.put(`/blog/admin/${post._id}`, payload) : api.post('/blog/admin', payload);
    },
    onSuccess: () => { toast.success(isEdit ? 'Post updated' : 'Post created'); queryClient.invalidateQueries({ queryKey: ['blog-admin'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit post' : 'New post'} width="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Title" required {...register('title')} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-slateink">Cover image</p>
          <SingleImageUploader value={featuredImage} onChange={setFeaturedImage} folder="blog" />
        </div>
        <Textarea label="Excerpt" {...register('excerpt')} />
        <Textarea label="Content" required className="min-h-[200px]" {...register('content')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Category" placeholder="e.g. Fire Safety Tips" {...register('category')} />
          <Input label="Tags" hint="Comma-separated" {...register('tags')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isPublished')} /> Published (visible on the storefront)
        </label>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Publish post'}</Button>
        </div>
      </form>
    </Modal>
  );
}
