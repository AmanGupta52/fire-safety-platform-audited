import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { Quote } from '../../types';
import { Card, Badge, EmptyState, Spinner } from '../../components/ui/Primitives';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  requested: 'warning', reviewing: 'info', sent: 'info', approved: 'success', rejected: 'danger', converted: 'success'
};

export default function MyQuotes() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-quotes'],
    queryFn: async () => (await api.get('/quotes/my')).data.data as Quote[]
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="heading text-xl text-ink">My quotes</h1>
        <Link to="/request-quote"><Button size="sm">Request new quote</Button></Link>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState icon={FileText} title="No quote requests yet" description="Request a bulk quotation for your office, factory or society." />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {data.map((q) => (
            <Card key={q._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{q.quoteNumber}</p>
                <p className="text-xs text-slateink">{format(new Date(q.createdAt), 'd MMM yyyy')} · {q.items.length} item{q.items.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone[q.status]}>{q.status}</Badge>
                {q.pdfUrl && <a href={q.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">View PDF</a>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
