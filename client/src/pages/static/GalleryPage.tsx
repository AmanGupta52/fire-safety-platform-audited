import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image as ImageIcon } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { GalleryItem } from '../../types';
import { Card, EmptyState, Spinner } from '../../components/ui/Primitives';

export default function GalleryPage() {
  const [category, setCategory] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['gallery-public', category],
    queryFn: async () => (await api.get('/gallery', { params: { category: category || undefined } })).data.data as GalleryItem[]
  });

  const categories = Array.from(new Set((data || []).map((g) => g.category)));

  return (
    <div className="container-page py-10">
      <h1 className="heading text-2xl text-ink">Project gallery</h1>
      <p className="mt-1 text-sm text-slateink">A look at our installations and completed projects.</p>

      {categories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => setCategory('')} className={`rounded-full border px-3 py-1 text-xs font-medium ${!category ? 'border-ink bg-ink text-white' : 'border-line text-slateink'}`}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs font-medium ${category === c ? 'border-ink bg-ink text-white' : 'border-line text-slateink'}`}>{c}</button>
          ))}
        </div>
      )}

      {isLoading ? <Spinner /> : !data?.length ? (
        <EmptyState icon={ImageIcon} title="No photos yet" />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((item) => (
            <Card key={item._id} className="overflow-hidden">
              <img src={item.image} alt={item.title} className="aspect-square w-full object-cover" />
              <div className="p-3">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                <p className="text-xs text-slateink">{item.category}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
