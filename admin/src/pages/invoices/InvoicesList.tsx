import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Receipt, Download, Loader2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { downloadFile } from '../../lib/downloadFile';
import { Invoice } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatInr, formatDate } from '../../lib/format';

// Read-only: invoices are generated automatically by the order/checkout flow (see
// invoiceService.ts) — this page exists purely so staff can find and open one, not to
// author them by hand.
export default function InvoicesList() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices-admin'],
    queryFn: async () => (await api.get('/invoices')).data.data as Invoice[]
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function downloadInvoice(inv: Invoice) {
    setDownloadingId(inv._id);
    try {
      await downloadFile(`/invoices/${inv._id}/pdf`, `${inv.invoiceNumber}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error && !('isAxiosError' in err) ? err.message : apiErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  const columns: Column<Invoice>[] = [
    { header: 'Invoice #', render: (i) => <span className="font-medium text-ink">{i.invoiceNumber}</span> },
    { header: 'Customer', render: (i) => typeof i.user === 'object' ? <div><p className="text-ink">{i.user.name}</p><p className="text-xs text-slateink">{i.user.email}</p></div> : '—' },
    { header: 'Subtotal', render: (i) => formatInr(i.subtotal, 2) },
    { header: 'GST', render: (i) => formatInr(i.totalGst, 2) },
    { header: 'Total', render: (i) => <span className="font-medium text-ink">{formatInr(i.grandTotal, 2)}</span> },
    { header: 'Date', render: (i) => formatDate(i.createdAt) },
    {
      header: '', className: 'text-right',
      render: (i) => (
        <button
          type="button"
          onClick={() => downloadInvoice(i)}
          disabled={downloadingId === i._id}
          aria-label={`Download invoice ${i.invoiceNumber} as PDF`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand-light disabled:opacity-60"
        >
          {downloadingId === i._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
        </button>
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
