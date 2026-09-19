import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { AMCContract, AMCStatus } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormControls';

const STATUS_OPTIONS: AMCStatus[] = ['requested', 'active', 'expiring_soon', 'expired', 'renewed', 'cancelled'];

export default function AmcList() {
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['amc', status],
    queryFn: async () => (await api.get('/amc', { params: { status: status || undefined } })).data.data as AMCContract[]
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AMCStatus }) => api.patch(`/amc/${id}/status`, { status }),
    onSuccess: () => { toast.success('AMC status updated'); queryClient.invalidateQueries({ queryKey: ['amc'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<AMCContract>[] = [
    { header: 'Contract #', render: (c) => <span className="font-medium text-ink">{c.contractNumber}</span> },
    { header: 'Customer', render: (c) => typeof c.user === 'object' ? c.user.name : '—' },
    { header: 'Plan', render: (c) => c.planName },
    { header: 'Start', render: (c) => format(new Date(c.startDate), 'd MMM yyyy') },
    { header: 'End', render: (c) => format(new Date(c.endDate), 'd MMM yyyy') },
    { header: 'Amount', render: (c) => `₹${c.amount.toLocaleString('en-IN')}` },
    {
      header: 'Status',
      render: (c) => (
        <Select
          value={c.status}
          onChange={(e) => statusMutation.mutate({ id: c._id, status: e.target.value as AMCStatus })}
          options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))}
          className="w-40"
        />
      )
    }
  ];

  return (
    <div>
      <PageHeader title="AMC contracts" description="Track annual maintenance contracts and renewals." />
      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Select className="w-56" placeholder="All statuses" value={status} onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, ' '), value: s }))} />
        </div>
        <DataTable
          columns={columns} rows={data || []} rowKey={(c) => c._id} isLoading={isLoading}
          emptyIcon={ShieldCheck} emptyTitle="No AMC contracts yet"
          rowAccentColor={(c) => (c.status === 'expired' ? '#C1272D' : c.status === 'expiring_soon' ? '#E1890F' : undefined)}
        />
      </Card>
    </div>
  );
}
