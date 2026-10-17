import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, toastApiError } from '../../lib/apiClient';
import { Address } from '../../types';
import { Card, EmptyState, ErrorState, Badge, Skeleton, SkeletonGroup } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { optionalTextRules, phoneRules, pincodeRules, requiredTextRules } from '../../lib/validators';

interface FormValues {
  label: string; contactName: string; phone: string; line1: string; line2?: string;
  city: string; state: string; pincode: string; isDefault?: boolean;
}

export default function MyAddresses() {
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get('/addresses')).data.data as Address[]
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/addresses/${id}`),
    onSuccess: () => { toast.success('Address removed'); queryClient.invalidateQueries({ queryKey: ['addresses'] }); },
    onError: toastApiError
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="heading text-xl text-ink">Addresses</h1>
        <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add address</Button>
      </div>

      {isLoading ? (
        <SkeletonGroup label="Loading addresses" className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeuo-card rounded-card p-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-14 rounded-pill" />
              </div>
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-3/4" />
            </div>
          ))}
        </SkeletonGroup>
      ) : isError ? (
        <ErrorState title="Couldn't load your addresses" onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
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
                  <button aria-label="Edit address" onClick={() => setEditing(addr)} className="rounded p-1.5 text-slateink hover:bg-paper"><Pencil className="h-3.5 w-3.5" /></button>
                  <button aria-label="Delete address" disabled={deleteMutation.isPending} onClick={() => { if (confirm('Delete this address?')) deleteMutation.mutate(addr._id); }} className="rounded p-1.5 text-safety hover:bg-safety-light"><Trash2 className="h-3.5 w-3.5" /></button>
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
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ defaultValues: address ? { ...address } : { label: 'Home' } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => (isEdit && address ? api.put(`/addresses/${address._id}`, values) : api.post('/addresses', values)),
    onSuccess: () => { toast.success(isEdit ? 'Address updated' : 'Address added'); queryClient.invalidateQueries({ queryKey: ['addresses'] }); onClose(); },
    onError: toastApiError
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit address' : 'Add address'} width="lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Label" placeholder="Home, Office..." required error={errors.label?.message} {...register('label', requiredTextRules)} />
          <Input label="Contact name" required autoComplete="name" error={errors.contactName?.message} {...register('contactName', requiredTextRules)} />
        </div>
        <Input label="Phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" error={errors.phone?.message} {...register('phone', phoneRules)} />
        <Input label="Address line 1" required autoComplete="address-line1" error={errors.line1?.message} {...register('line1', requiredTextRules)} />
        <Input label="Address line 2" autoComplete="address-line2" error={errors.line2?.message} {...register('line2', optionalTextRules)} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="City" required autoComplete="address-level2" error={errors.city?.message} {...register('city', requiredTextRules)} />
          <Input label="State" required autoComplete="address-level1" error={errors.state?.message} {...register('state', requiredTextRules)} />
          <Input label="Pincode" required inputMode="numeric" maxLength={6} autoComplete="postal-code" error={errors.pincode?.message} {...register('pincode', pincodeRules)} />
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
