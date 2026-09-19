import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Category } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SingleImageUploader } from '../../components/ui/ImageUploader';
import { useAuthStore } from '../../store/authStore';

interface FormValues { name: string; description?: string; sortOrder?: number; isActive?: boolean }

export default function CategoriesList() {
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => (await api.get('/categories?includeInactive=true')).data.data as Category[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { toast.success('Category deleted'); queryClient.invalidateQueries({ queryKey: ['categories-all'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<Category>[] = [
    {
      header: '', className: 'w-14',
      render: (c) => c.image
        ? <img src={c.image} alt="" className="h-9 w-9 rounded object-cover" />
        : <div className="flex h-9 w-9 items-center justify-center rounded bg-paper text-slateink"><Layers className="h-4 w-4" /></div>
    },
    { header: 'Name', render: (c) => <span className="font-medium text-ink">{c.name}</span> },
    { header: 'Slug', render: (c) => <span className="text-xs text-slateink">{c.slug}</span> },
    { header: 'Sort order', render: (c) => c.sortOrder },
    { header: 'Status', render: (c) => <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '', className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          {hasPermission('categories.update') && (
            <button onClick={() => setEditing(c)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
          )}
          {hasPermission('categories.delete') && (
            <button
              onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c._id); }}
              className="rounded p-1.5 text-brand hover:bg-brand-light"
            ><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize the product catalog into browsable sections."
        actions={hasPermission('categories.create') && <Button onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add category</Button>}
      />

      <Card>
        <DataTable
          columns={columns} rows={data || []} rowKey={(c) => c._id} isLoading={isLoading}
          emptyIcon={Layers} emptyTitle="No categories yet" emptyDescription="Create your first category, e.g. Fire Extinguishers."
        />
      </Card>

      {editing && <CategoryForm category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(category);
  const [image, setImage] = useState(category?.image || '');
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: category
      ? { name: category.name, description: category.description, sortOrder: category.sortOrder, isActive: category.isActive }
      : { isActive: true, sortOrder: 0 }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, image: image || undefined };
      return isEdit && category ? api.put(`/categories/${category._id}`, payload) : api.post('/categories', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Category updated' : 'Category created');
      queryClient.invalidateQueries({ queryKey: ['categories-all'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit category' : 'Add category'}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Name" required {...register('name')} />
        <Textarea label="Description" {...register('description')} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-slateink">Category image</p>
          <SingleImageUploader value={image} onChange={setImage} folder="categories" />
        </div>
        <Input label="Sort order" type="number" {...register('sortOrder')} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isActive')} /> Active
        </label>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Create category'}</Button>
        </div>
      </form>
    </Modal>
  );
}
