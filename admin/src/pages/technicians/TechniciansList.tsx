import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Plus, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Technician } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';

interface FormValues { name: string; phone: string; email?: string; employeeId: string; skills?: string; serviceArea?: string }

export default function TechniciansList() {
  const [showForm, setShowForm] = useState(false);
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
    { header: 'Status', render: (t) => <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge> },
    {
      header: '', className: 'text-right',
      render: (t) => t.status === 'active' && hasPermission('technicians.update') && (
        <button onClick={() => { if (confirm(`Disable ${t.name}?`)) disableMutation.mutate(t._id); }} className="rounded p-1.5 text-brand hover:bg-brand-light">
          <Ban className="h-3.5 w-3.5" />
        </button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Technicians"
        description="Manage the field team who fulfil service bookings and AMC visits."
        actions={hasPermission('technicians.create') && <Button onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Add technician</Button>}
      />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(t) => t._id} isLoading={isLoading}
          emptyIcon={UserCog} emptyTitle="No technicians yet" />
      </Card>

      {showForm && <TechnicianForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function TechnicianForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm<FormValues>();

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post('/technicians', {
        ...values,
        skills: values.skills ? values.skills.split(',').map((s) => s.trim()) : [],
        serviceArea: values.serviceArea ? values.serviceArea.split(',').map((s) => s.trim()) : []
      }),
    onSuccess: () => { toast.success('Technician added'); queryClient.invalidateQueries({ queryKey: ['technicians'] }); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title="Add technician">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <Input label="Name" required {...register('name')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" required {...register('phone')} />
          <Input label="Email" type="email" {...register('email')} />
        </div>
        <Input label="Employee ID" required {...register('employeeId')} />
        <Input label="Skills" hint="Comma-separated, e.g. Installation, AMC" {...register('skills')} />
        <Input label="Service area" hint="Comma-separated, e.g. Andheri, Bandra" {...register('serviceArea')} />
        <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Add technician</Button>
        </div>
      </form>
    </Modal>
  );
}
