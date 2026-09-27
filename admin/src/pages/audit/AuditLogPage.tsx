import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { AuditLogEntry } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Input } from '../../components/ui/FormControls';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, module],
    queryFn: async () =>
      (await api.get('/audit-logs', { params: { page, limit: 50, module: module || undefined } })).data as {
        data: AuditLogEntry[]; meta: { totalPages: number };
      }
  });

  const columns: Column<AuditLogEntry>[] = [
    { header: 'When', render: (l) => format(new Date(l.createdAt), 'd MMM yyyy, h:mm a') },
    { header: 'Staff member', render: (l) => typeof l.user === 'object' ? `${l.user.name} (${l.user.role.replace('_', ' ')})` : '—' },
    { header: 'Module', render: (l) => <Badge tone="info">{l.module}</Badge> },
    { header: 'Action', render: (l) => l.action.replace(/_/g, ' ') },
    { header: 'Entity', render: (l) => l.entity || '—' }
  ];

  return (
    <div>
      <PageHeader title="Audit log" description="A record of every meaningful change made by staff accounts." />
      <Card>
        <div className="border-b border-line p-4">
          <Input placeholder="Filter by module, e.g. products, orders, staff..." value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} className="w-72" />
        </div>
        <DataTable columns={columns} rows={data?.data || []} rowKey={(l) => l._id} isLoading={isLoading} emptyIcon={History} emptyTitle="No audit entries yet" />
        <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />
      </Card>
    </div>
  );
}
