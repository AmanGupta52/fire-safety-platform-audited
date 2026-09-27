import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Plus, Ban, Pencil, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Technician, StaffMember } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';

interface FormValues {
  name: string; phone: string; email?: string; employeeId: string;
  skills?: string; serviceArea?: string; user?: string;
}

export default function TechniciansList() {
  const [editing, setEditing] = useState<Technician | 'new' | null>(null);
  const [workloadFor, setWorkloadFor] = useState<Technician | null>(null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/technicians')).data.data as Technician[]
  });

  const disableMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/technicians/${id}/disable`),
    onSuccess: () => { toast.success('Technician disabled'); queryClient.invalidateQueries({ queryKey: ['technicians'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<Technician>[] = [
    { header: 'Name', render: (t) => <span className="font-medium text-ink">{t.name}</span> },
    { header: 'Employee ID', render: (t) => t.employeeId },
    { header: 'Phone', render: (t) => t.phone },
    { header: 'Skills', render: (t) => t.skills.join(', ') || '—' },
    { header: 'Service area', render: (t) => t.serviceArea.join(', ') || '—' },
    {
      header: 'Login linked',
      render: (t) => <Badge tone={t.user ? 'success' : 'neutral'}>{t.user ? 'Linked' : 'Not linked'}</Badge>
    },
    { header: 'Status', render: (t) => <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge> },
    {
      header: '', className: 'text-right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setWorkloadFor(t)} title="View workload" className="rounded p-1.5 text-slateink hover:bg-paper">
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          {hasPermission('technicians.update') && (
            <button onClick={() => setEditing(t)} title="Edit" className="rounded p-1.5 text-slateink hover:bg-paper">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {t.status === 'active' && hasPermission('technicians.update') && (
            <button onClick={() => { if (confirm(`Disable ${t.name}?`)) disableMutation.mutate(t._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light">
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Technicians"
        description="Manage the field team who fulfil service bookings and AMC visits."
        actions={hasPermission('technicians.create') && <Button onClick={() => setEditing('new')}><Plus className="h-3.5 w-3.5" /> Add technician</Button>}
      />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(t) => t._id} isLoading={isLoading}
          emptyIcon={UserCog} emptyTitle="No technicians yet" />
      </Card>

      {editing && <TechnicianForm technician={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {workloadFor && <WorkloadModal technician={workloadFor} onClose={() => setWorkloadFor(null)} />}
    </div>
  );
}

function WorkloadModal({ technician, onClose }: { technician: Technician; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['technician-workload', technician._id],
    queryFn: async () => (await api.get(`/technicians/${technician._id}/workload`)).data.data as { pendingJobs: number; completedJobs: number }
  });

  return (
    <Modal open onClose={onClose} title={`${technician.name} — workload`}>
      {isLoading ? (
        <p className="text-sm text-slateink">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded border border-line p-4 text-center">
            <p className="text-2xl font-semibold text-ink">{data?.pendingJobs ?? 0}</p>
            <p className="text-xs text-slateink">Pending jobs</p>
          </div>
          <div className="rounded border border-line p-4 text-center">
            <p className="text-2xl font-semibold text-ink">{data?.completedJobs ?? 0}</p>
            <p className="text-xs text-slateink">Completed jobs</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function TechnicianForm({ technician, onClose }: { technician: Technician | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(technician);
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: technician
      ? {
          name: technician.name, phone: technician.phone, email: technician.email, employeeId: technician.employeeId,
          skills: technician.skills.join(', '), serviceArea: technician.serviceArea.join(', '), user: technician.user || ''
        }
      : undefined
  });

  // Only staff accounts with the 'technician' role make sense to link — this is what lets
  // that person's own "my jobs" login actually find their Technician record (previously
  // there was no way, through either admin screen, to end up with that link populated).
  const { data: staff } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/staff')).data.data as StaffMember[]
  });
  const technicianAccounts = (staff || []).filter((s) => s.role === 'technician');

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        user: values.user || null,
        skills: values.skills ? values.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        serviceArea: values.serviceArea ? values.serviceArea.split(',').map((s) => s.trim()).filter(Boolean) : []
      };
      return isEdit && technician ? api.put(`/technicians/${technician._id}`, payload) : api.post('/technicians', payload);
    },
    onSuccess: () => { toast.success(isEdit ? 'Technician updated' : 'Technician added'); queryClient.invalidateQueries({ queryKey: ['technicians'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${technician?.name}` : 'Add technician'}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Name" required {...register('name')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" required {...register('phone')} />
          <Input label="Email" type="email" {...register('email')} />
        </div>
        <Input label="Employee ID" required {...register('employeeId')} />
        <Input label="Skills" hint="Comma-separated, e.g. Installation, AMC" {...register('skills')} />
        <Input label="Service area" hint="Comma-separated, e.g. Andheri, Bandra" {...register('serviceArea')} />
        <Select
          label="Linked staff login" hint="Lets this person's account see their own jobs under 'My jobs'"
          placeholder="Not linked" options={technicianAccounts.map((s) => ({ label: `${s.name} (${s.email})`, value: s._id }))}
          {...register('user')}
        />
        {technicianAccounts.length === 0 && (
          <p className="-mt-2 text-xs text-slateink">
            No staff accounts with the "technician" role exist yet — create one under Staff & Roles first, then link them here.
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Add technician'}</Button>
        </div>
      </form>
    </Modal>
  );
}
