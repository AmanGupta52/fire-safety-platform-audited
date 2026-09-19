import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Address } from '../../types';
import { Card, EmptyState, Spinner, Badge } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';

interface FormValues {
  label: string; contactName: string; phone: string; line1: string; line2?: string;
  city: string; state: string; pincode: string; isDefault?: boolean;
}

export default function MyAddresses() {
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data.data as Address[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/addresses/${id}`),
    onSuccess: () => { toast.success('Address removed'); queryClient.invalidateQueries({ queryKey: ['addresses'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="heading text-xl text-ink">Addresses</h1>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add address</Button>
      </div>

      {isLoading ? <Spinner /> : !data || data.length === 0 ? (
        <EmptyState icon={MapPin} title="No saved addresses" description="Add an address to speed up checkout next time." />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((addr) => (
            <Card key={addr._id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{addr.label}</p>
                  {addr.isDefault && <Badge tone="success">Default</Badge>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(addr)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm('Delete this address?')) deleteMutation.mutate(addr._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slateink">
                {addr.contactName} · {addr.phone}<br />
                {addr.line1}, {addr.line2 && `${addr.line2}, `}{addr.city}, {addr.state} {addr.pincode}
              </p>
            </Card>
          ))}
        </div>
      )}

      {editing && <AddressForm address={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddressForm({ address, onClose }: { address: Address | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(address);
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: address ? { ...address } : { label: 'Home' } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (isEdit && address ? api.put(`/addresses/${address._id}`, values) : api.post('/addresses', values)),
    onSuccess: () => { toast.success(isEdit ? 'Address updated' : 'Address added'); queryClient.invalidateQueries({ queryKey: ['addresses'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit address' : 'Add address'} width="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Label" placeholder="Home, Office..." required {...register('label', { required: true })} />
          <Input label="Contact name" required {...register('contactName', { required: true })} />
        </div>
        <Input label="Phone" required {...register('phone', { required: true })} />
        <Input label="Address line 1" required {...register('line1', { required: true })} />
        <Input label="Address line 2" {...register('line2')} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="City" required {...register('city', { required: true })} />
          <Input label="State" required {...register('state', { required: true })} />
          <Input label="Pincode" required {...register('pincode', { required: true })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isDefault')} /> Set as default address
        </label>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Add address'}</Button>
        </div>
      </form>
    </Modal>
  );
}
