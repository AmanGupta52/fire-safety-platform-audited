import { useQuery } from '@tanstack/react-query';
import { FileBadge, Download } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { Invoice } from '../../types';
import { Card, EmptyState, Spinner } from '../../components/ui/Primitives';

export default function MyInvoices() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: async () => (await api.get('/invoices/my')).data.data as Invoice[]
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1 className="heading text-xl text-ink">Invoices</h1>

      {!data || data.length === 0 ? (
        <EmptyState icon={FileBadge} title="No invoices yet" description="GST invoices are generated automatically once your order payment is confirmed." />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {data.map((inv) => (
            <Card key={inv._id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-ink">{inv.invoiceNumber}</p>
                <p className="text-xs text-slateink">{format(new Date(inv.createdAt), 'd MMM yyyy')}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm font-medium text-ink">₹{inv.grandTotal.toLocaleString('en-IN')}</p>
                {inv.pdfUrl && (
                  <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
