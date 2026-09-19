import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { BlogPost } from '../../types';
import { Spinner, Badge } from '../../components/ui/Primitives';

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['blog-detail', slug],
    queryFn: async () => (await api.get(`/blog/${slug}`)).data.data as { post: BlogPost; related: BlogPost[] },
    enabled: Boolean(slug)
  });

  if (isLoading || !data) return <Spinner />;
  const { post, related } = data;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-slateink hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to resources</Link>

      {post.category && <div className="mt-5"><Badge tone="info">{post.category}</Badge></div>}
      <h1 className="heading mt-3 text-3xl text-ink">{post.title}</h1>
      {post.publishedAt && <p className="mt-2 text-sm text-slateink">{format(new Date(post.publishedAt), 'd MMM yyyy')}</p>}

      {post.featuredImage && <img src={post.featuredImage} alt={post.title} className="mt-6 w-full rounded-lg" />}

      <div className="prose prose-sm mt-8 max-w-none whitespace-pre-line text-sm leading-relaxed text-ink">
        {post.content}
      </div>

      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-14 border-t border-line pt-8">
          <p className="heading text-base text-ink">Related articles</p>
          <div className="mt-4 flex flex-col gap-2">
            {related.map((r) => (
              <Link key={r._id} to={`/blog/${r.slug}`} className="text-sm font-medium text-brand hover:underline">{r.title}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
