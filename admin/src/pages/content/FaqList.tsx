import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Card } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';

interface FAQ { _id: string; question: string; answer: string; category?: string; sortOrder: number; isActive: boolean }
interface FormValues { question: string; answer: string; category?: string; sortOrder?: number; isActive?: boolean }

export default function FaqList() {
  const [editing, setEditing] = useState<FAQ | 'new' | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['faqs-admin'],
    queryFn: async () => (await api.get('/faqs')).data.data as FAQ[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/faqs/${id}`),
    onSuccess: () => { toast.success('FAQ deleted'); queryClient.invalidateQueries({ queryKey: ['faqs-admin'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<FAQ>[] = [
    { header: 'Question', render: (f) => <span className="font-medium text-ink">{f.question}</span> },
    { header: 'Category', render: (f) => f.category || '—' },
    { header: 'Sort order', render: (f) => f.sortOrder },
    {
      header: '', className: 'text-right',
      render: (f) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setEditing(f)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => { if (confirm('Delete this FAQ?')) deleteMutation.mutate(f._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="FAQs" description="Frequently asked questions shown on the storefront." actions={<Button onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add FAQ</Button>} />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(f) => f._id} isLoading={isLoading} emptyIcon={HelpCircle} emptyTitle="No FAQs yet" />
      </Card>
      {editing && <FaqForm faq={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FaqForm({ faq, onClose }: { faq: FAQ | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(faq);
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: faq ? { ...faq } : { isActive: true, sortOrder: 0 }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (isEdit && faq ? api.put(`/faqs/${faq._id}`, values) : api.post('/faqs', values)),
    onSuccess: () => { toast.success(isEdit ? 'FAQ updated' : 'FAQ added'); queryClient.invalidateQueries({ queryKey: ['faqs-admin'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit FAQ' : 'Add FAQ'}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Question" required {...register('question')} />
        <Textarea label="Answer" required {...register('answer')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Category" {...register('category')} />
          <Input label="Sort order" type="number" {...register('sortOrder')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isActive')} /> Active
        </label>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Add FAQ'}</Button>
        </div>
      </form>
    </Modal>
  );
}
