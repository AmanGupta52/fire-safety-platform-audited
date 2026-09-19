import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { StaffMember, Role } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';

const ROLE_OPTIONS: Role[] = ['admin', 'sales', 'technician', 'accountant'];
interface FormValues { name: string; email: string; role: Role }

export default function StaffList() {
  const [showForm, setShowForm] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'super_admin';
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/staff')).data.data as StaffMember[]
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (member: StaffMember) => api.put(`/staff/${member._id}`, { isActive: !member.isActive }),
    onSuccess: () => { toast.success('Staff member updated'); queryClient.invalidateQueries({ queryKey: ['staff'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<StaffMember>[] = [
    { header: 'Name', render: (s) => <span className="font-medium text-ink">{s.name}</span> },
    { header: 'Email', render: (s) => s.email },
    { header: 'Role', render: (s) => <Badge tone="info">{s.role.replace('_', ' ')}</Badge> },
    { header: 'Status', render: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Disabled'}</Badge> },
    {
      header: '', className: 'text-right',
      render: (s) => isSuperAdmin && s.role !== 'super_admin' && (
        <Button variant={s.isActive ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActiveMutation.mutate(s)} loading={toggleActiveMutation.isPending}>
          {s.isActive ? 'Disable' : 'Enable'}
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Staff & roles"
        description="Manage internal accounts and their role-based permissions."
        actions={isSuperAdmin && <Button onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Add staff</Button>}
      />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(s) => s._id} isLoading={isLoading} emptyIcon={UserCog} emptyTitle="No staff accounts yet" />
      </Card>
      {showForm && <StaffForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function StaffForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { role: 'sales' } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => api.post('/staff', values),
    onSuccess: () => {
      toast.success('Staff account created — temporary password emailed');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title="Add staff account">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Name" required {...register('name')} />
        <Input label="Email" type="email" required {...register('email')} />
        <Select label="Role" options={ROLE_OPTIONS.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), value: r }))} {...register('role')} />
        <p className="text-xs text-slateink">A temporary password will be generated and emailed to this address (logged to the server console in development mode).</p>
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create account</Button>
        </div>
      </form>
    </Modal>
  );
}
