import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, FileDown, CheckCircle2, XCircle, ArrowRightCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Quote, QuoteStatus } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

const STATUS_OPTIONS: QuoteStatus[] = ['requested', 'reviewing', 'sent', 'approved', 'rejected', 'converted'];
const statusTone: Record<QuoteStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', reviewing: 'info', sent: 'info', approved: 'success', rejected: 'danger', converted: 'success'
};

export default function QuotesList() {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Quote | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', status],
    queryFn: async () => (await api.get('/quotes', { params: { status: status || undefined, limit: 50 } })).data.data as Quote[]
  });

  const columns: Column<Quote>[] = [
    { header: 'Quote #', render: (q) => <span className="font-medium text-ink">{q.quoteNumber}</span> },
    { header: 'Customer', render: (q) => <div><p className="text-ink">{q.customerName}</p>{q.companyName && <p className="text-xs text-slateink">{q.companyName}</p>}</div> },
    { header: 'Items', render: (q) => `${q.items.length} item${q.items.length !== 1 ? 's' : ''}` },
    { header: 'Status', render: (q) => <Badge tone={statusTone[q.status]}>{q.status}</Badge> },
    { header: 'Requested', render: (q) => format(new Date(q.createdAt), 'd MMM yyyy') }
  ];

  return (
    <div>
      <PageHeader title="Quotations" description="Review B2B quote requests, send priced PDFs, and convert approved quotes to orders." />

      <Card>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <Select className="w-56" placeholder="All statuses" value={status} onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s }))} />
        </div>
        <DataTable
          columns={columns} rows={data || []} rowKey={(q) => q._id} isLoading={isLoading}
          emptyIcon={FileText} emptyTitle="No quotation requests" onRowClick={setSelected}
        />
      </Card>

      {selected && <QuoteDetailModal quote={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function QuoteDetailModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quotes'] });

  const statusMutation = useMutation({
    mutationFn: async (status: QuoteStatus) => api.patch(`/quotes/${quote._id}/status`, { status }),
    onSuccess: () => { toast.success('Quote status updated'); invalidate(); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const pdfMutation = useMutation({
    mutationFn: async () => (await api.post(`/quotes/${quote._id}/pdf`)).data.data as { pdfUrl: string },
    onSuccess: (data) => { toast.success('PDF generated'); window.open(data.pdfUrl, '_blank'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const convertMutation = useMutation({
    mutationFn: async () => api.post(`/quotes/${quote._id}/convert`),
    onSuccess: () => { toast.success('Converted to order'); invalidate(); onClose(); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={`Quote ${quote.quoteNumber}`} width="lg">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slateink">Customer</p>
            <p className="text-ink">{quote.customerName}</p>
            {quote.companyName && <p className="text-xs text-slateink">{quote.companyName}</p>}
            <p className="text-xs text-slateink">{quote.email} · {quote.phone}</p>
            {quote.gstNumber && <p className="text-xs text-slateink">GSTIN {quote.gstNumber}</p>}
          </div>
          <div>
            <p className="text-xs font-medium text-slateink">Delivery address</p>
            <p className="text-ink">{quote.address || 'Not provided'}</p>
          </div>
        </div>

        {quote.requirements && (
          <div>
            <p className="text-xs font-medium text-slateink">Requirements</p>
            <p className="text-sm text-ink">{quote.requirements}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-slateink">Requested items</p>
          <div className="rounded border border-line">
            {quote.items.map((item, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
                <p className="text-ink">{item.name}</p>
                <p className="text-slateink">Qty {item.quantity}</p>
              </div>
            ))}
          </div>
        </div>

        {quote.pdfUrl && (
          <a href={quote.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">
            View generated PDF ↗
          </a>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="secondary" size="sm" onClick={() => pdfMutation.mutate()} loading={pdfMutation.isPending}>
            <FileDown className="h-3.5 w-3.5" /> Generate PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('approved')} loading={statusMutation.isPending}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('rejected')} loading={statusMutation.isPending}>
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
          {quote.status === 'approved' && (
            <Button size="sm" onClick={() => convertMutation.mutate()} loading={convertMutation.isPending}>
              <ArrowRightCircle className="h-3.5 w-3.5" /> Convert to order
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
