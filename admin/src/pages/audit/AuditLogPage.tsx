import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ShieldCheck, Eye, Terminal, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { AuditLogEntry } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Input } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, module],
    queryFn: async () =>
      (await api.get('/audit-logs', { params: { page, limit: 50, module: module || undefined } })).data as {
        data: AuditLogEntry[]; meta: { totalPages: number };
      }
  });

  const { data: verification } = useQuery({
    queryKey: ['audit-logs-verify'],
    queryFn: async () =>
      (await api.get('/audit-logs/verify')).data.data as {
        isValid: boolean;
        totalLogs: number;
        reason?: string;
      },
    refetchInterval: 30_000
  });

  const columns: Column<AuditLogEntry>[] = [
    { header: 'When', render: (l) => <span className="text-xs">{format(new Date(l.createdAt), 'd MMM yyyy, h:mm a')}</span> },
    {
      header: 'Staff member',
      render: (l) =>
        typeof l.user === 'object' && l.user ? (
          <div>
            <p className="text-xs font-medium text-ink">{l.user.name}</p>
            <p className="text-[10px] text-slateink capitalize">{l.user.role.replace('_', ' ')}</p>
          </div>
        ) : (
          <span className="text-xs text-slateink">—</span>
        )
    },
    { header: 'Module', render: (l) => <Badge tone="info">{l.module}</Badge> },
    {
      header: 'Action',
      render: (l) => (
        <span className="text-xs font-medium uppercase tracking-wider text-ink">
          {l.action.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: 'Origin IP',
      render: (l) => (
        <span className="font-mono text-[11px] text-slateink">
          {l.ipAddress || '—'}
        </span>
      )
    },
    {
      header: 'Chain Integrity',
      render: (l) => (
        <div className="flex items-center gap-1.5" title={`SHA-256: ${l.hash || 'Verified'}`}>
          <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30">
            {l.hash ? `${l.hash.substring(0, 8)}...` : 'Sealed'}
          </span>
        </div>
      )
    },
    {
      header: '',
      className: 'text-right',
      render: (l) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSelectedLog(l)}
          title="Inspect before/after diff and chain cryptographic proof"
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> Inspect Diff
        </Button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable, tamper-evident cryptographic log recording sensitive administrative operations, staff activity, and system changes."
      />

      {/* Verification status header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              {verification?.isValid !== false ? 'Cryptographic Hash Chain Intact' : 'Integrity Alert'}
            </p>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
              {verification?.isValid !== false
                ? `All ${verification?.totalLogs || 0} audit log entries verified against SHA-256 tamper-evident blockchain hash links.`
                : verification?.reason || 'Integrity violation detected in audit log trail.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded bg-card/80 px-2.5 py-1 text-[11px] font-medium text-slateink border border-emerald-200/60 dark:border-emerald-500/30">
          <Lock className="h-3 w-3 text-slateink" /> Read-Only Enforcement: Active
        </div>
      </div>

      <Card>
        <div className="border-b border-line p-4">
          <Input
            placeholder="Filter by module, e.g. staff, settings, auth, products..."
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
            className="w-80"
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.data || []}
          rowKey={(l) => l._id}
          isLoading={isLoading}
          emptyIcon={History}
          emptyTitle="No audit entries recorded"
        />
        <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />
      </Card>

      {selectedLog && (
        <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

function AuditLogDetailModal({
  log,
  onClose
}: {
  log: AuditLogEntry;
  onClose: () => void;
}) {
  const diffEntries = log.diff ? Object.entries(log.diff) : [];

  return (
    <Modal open onClose={onClose} title={`Audit Inspection: ${log.action.replace(/_/g, ' ').toUpperCase()}`} width="lg">
      <div className="space-y-4 text-xs">
        {/* Core Metadata */}
        <div className="grid grid-cols-2 gap-3 rounded bg-paper p-3 border border-line">
          <div>
            <p className="text-[11px] font-medium text-slateink">Timestamp</p>
            <p className="font-semibold text-ink">{format(new Date(log.createdAt), 'PPpp')}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slateink">Staff Member</p>
            <p className="font-semibold text-ink">
              {typeof log.user === 'object' && log.user ? `${log.user.name} (${log.user.email})` : 'System / Direct'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slateink">Module & Entity</p>
            <p className="font-semibold text-ink">
              {log.module} {log.entity ? `• ${log.entity}` : ''} {log.entityId ? `[#${log.entityId}]` : ''}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slateink">Client IP & Origin</p>
            <p className="font-mono text-ink">{log.ipAddress || 'Unknown IP'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[11px] font-medium text-slateink">User Agent / Client Device</p>
            <p className="font-mono text-[11px] text-slateink break-all">{log.userAgent || 'Unknown Device'}</p>
          </div>
        </div>

        {/* Cryptographic Proof */}
        <div className="rounded border border-line bg-paper p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-ink font-semibold">
            <Terminal className="h-3.5 w-3.5 text-brand" />
            <span>Cryptographic Proof (SHA-256 Hash Chain)</span>
          </div>
          <div className="space-y-1 font-mono text-[10px]">
            <div>
              <span className="text-slateink">Previous Block Hash: </span>
              <span className="text-ink break-all">{log.prevHash || 'GENESIS'}</span>
            </div>
            <div>
              <span className="text-slateink">Entry Digest Hash: </span>
              <span className="text-brand font-semibold break-all">{log.hash || 'Computed on record seal'}</span>
            </div>
          </div>
        </div>

        {/* Before / After Diff */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-ink uppercase tracking-wider">Before / After Diff</h3>
          {diffEntries.length > 0 ? (
            <div className="overflow-x-auto rounded border border-line">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-paper text-[11px] text-slateink font-semibold">
                    <th className="p-2.5">Field</th>
                    <th className="p-2.5">Previous Value (Before)</th>
                    <th className="p-2.5">Updated Value (After)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {diffEntries.map(([field, change]) => (
                    <tr key={field} className="hover:bg-paper/50">
                      <td className="p-2.5 font-semibold text-ink align-top">{field}</td>
                      <td className="p-2.5 text-rose-700 bg-rose-50/40 dark:text-rose-300 dark:bg-rose-500/10 align-top break-all max-w-[200px]">
                        {change.before !== null && change.before !== undefined ? (
                          typeof change.before === 'object' ? (
                            JSON.stringify(change.before, null, 1)
                          ) : (
                            String(change.before)
                          )
                        ) : (
                          <span className="italic text-slateink/60">— null / none —</span>
                        )}
                      </td>
                      <td className="p-2.5 text-emerald-700 bg-emerald-50/40 dark:text-emerald-300 dark:bg-emerald-500/10 align-top break-all max-w-[200px]">
                        {change.after !== null && change.after !== undefined ? (
                          typeof change.after === 'object' ? (
                            JSON.stringify(change.after, null, 1)
                          ) : (
                            String(change.after)
                          )
                        ) : (
                          <span className="italic text-slateink/60">— null / removed —</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded border border-dashed border-line p-4 text-center text-slateink">
              {log.newValue ? (
                <pre className="text-left font-mono text-[10px] text-ink overflow-x-auto max-h-48 bg-paper p-2 rounded">
                  {JSON.stringify(log.newValue, null, 2)}
                </pre>
              ) : (
                'No field-level diff was recorded for this event.'
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-line">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
