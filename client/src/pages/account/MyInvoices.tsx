import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileBadge, Download, Loader2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { downloadFile } from '../../lib/downloadFile';
import { Invoice } from '../../types';
import { Card, EmptyState, ErrorState } from '../../components/ui/Primitives';
import { SkeletonList } from '../../components/ui/Skeleton';
import { formatInr, formatDate } from '../../lib/format';

export default function MyInvoices() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: async () => (await api.get('/invoices/my')).data.data as Invoice[]
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

  return (
    <div>
      <h1 className="heading text-xl text-ink">Invoices</h1>

      {isLoading ? (
        <div className="mt-5"><SkeletonList count={4} /></div>
      ) : isError ? (
        <ErrorState title="Couldn't load your invoices" onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={FileBadge} title="No invoices yet" description="GST invoices are generated automatically once your order payment is confirmed." />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {data.map((inv) => (
            <Card key={inv._id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-ink">{inv.invoiceNumber}</p>
                <p className="text-xs text-slateink">{formatDate(inv.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm font-medium text-ink">{formatInr(inv.grandTotal)}</p>
                <button
                  type="button"
                  onClick={() => downloadInvoice(inv)}
                  disabled={downloadingId === inv._id}
                  aria-label={`Download invoice ${inv.invoiceNumber} as PDF`}
                  className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-safety hover:bg-safety-light disabled:opacity-60"
                >
                  {downloadingId === inv._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
