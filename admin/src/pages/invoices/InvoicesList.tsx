import { useQuery } from '@tanstack/react-query';
import { Receipt, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { Invoice } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';

// Read-only: invoices are generated automatically by the order/checkout flow (see
// invoiceService.ts) — this page exists purely so staff can find and open one, not to
// author them by hand.
export default function InvoicesList() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices-admin'],
    queryFn: async () => (await api.get('/invoices')).data.data as Invoice[]
  });

  const columns: Column<Invoice>[] = [
    { header: 'Invoice #', render: (i) => <span className="font-medium text-ink">{i.invoiceNumber}</span> },
    { header: 'Customer', render: (i) => typeof i.user === 'object' ? <div><p className="text-ink">{i.user.name}</p><p className="text-xs text-slateink">{i.user.email}</p></div> : '—' },
    { header: 'Subtotal', render: (i) => `₹${i.subtotal.toLocaleString('en-IN')}` },
    { header: 'GST', render: (i) => `₹${i.totalGst.toLocaleString('en-IN')}` },
    { header: 'Total', render: (i) => <span className="font-medium text-ink">₹{i.grandTotal.toLocaleString('en-IN')}</span> },
    { header: 'Date', render: (i) => format(new Date(i.createdAt), 'd MMM yyyy') },
    {
      header: '', className: 'text-right',
      render: (i) => i.pdfUrl && (
        <a href={i.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          <ExternalLink className="h-3 w-3" /> PDF
        </a>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Invoices" description="GST invoices generated for every order, most recent first." />
      <Card>
        <DataTable columns={columns} rows={data || []} rowKey={(i) => i._id} isLoading={isLoading} emptyIcon={Receipt} emptyTitle="No invoices yet" />
      </Card>
    </div>
  );
}
