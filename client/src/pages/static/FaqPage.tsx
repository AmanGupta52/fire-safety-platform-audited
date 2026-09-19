import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { FAQ } from '../../types';
import { EmptyState, Spinner } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/FormControls';

export default function FaqPage() {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['faqs-public', q],
    queryFn: async () => (await api.get('/faqs', { params: { q: q || undefined } })).data.data as FAQ[]
  });

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="heading text-2xl text-ink">Frequently asked questions</h1>

      <div className="relative mt-5">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateink" />
        <Input placeholder="Search FAQs..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? <Spinner /> : !data?.length ? (
        <EmptyState icon={HelpCircle} title="No matching FAQs" />
      ) : (
        <div className="mt-6 divide-y divide-line rounded-lg border border-line bg-white">
          {data.map((faq) => (
            <div key={faq._id}>
              <button onClick={() => setOpenId(openId === faq._id ? null : faq._id)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="text-sm font-medium text-ink">{faq.question}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slateink transition-transform ${openId === faq._id ? 'rotate-180' : ''}`} />
              </button>
              {openId === faq._id && <p className="px-5 pb-4 text-sm text-slateink">{faq.answer}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
