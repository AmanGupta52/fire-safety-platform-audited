import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { BlogPost } from '../../types';
import { Badge, EmptyState, ErrorState } from '../../components/ui/Primitives';
import { SkeletonText } from '../../components/ui/Skeleton';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';

// Mirrors the article layout (back link, category/title/date, featured image, body text)
// so the page doesn't reflow once the post loads.
function BlogDetailSkeleton() {
  return (
    <div className="container-page max-w-3xl py-10" role="status" aria-label="Loading article">
      <div className="skeleton-shimmer h-4 w-36 rounded" />
      <div className="skeleton-shimmer mt-6 h-5 w-20 rounded-pill" />
      <div className="skeleton-shimmer mt-4 h-8 w-3/4 rounded" />
      <div className="skeleton-shimmer mt-3 h-3 w-28 rounded" />
      <div className="skeleton-shimmer mt-6 aspect-video w-full rounded-lg" />
      <SkeletonText lines={6} className="mt-8" />
      <span className="sr-only">Loading article</span>
    </div>
  );
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['blog-detail', slug],
    queryFn: async () => (await api.get(`/blog/${slug}`)).data.data as { post: BlogPost; related: BlogPost[] },
    enabled: Boolean(slug)
  });

  if (isLoading) return <BlogDetailSkeleton />;
  if (isError) return <div className="container-page py-10"><ErrorState title="Couldn't load this article" onRetry={() => refetch()} /></div>;
  if (!data) return <div className="container-page py-10"><EmptyState icon={ArrowLeft} title="Article not found" /></div>;

  const { post, related } = data;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-slateink hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to resources</Link>

      {post.category && <div className="mt-5"><Badge tone="info">{post.category}</Badge></div>}
      <h1 className="heading mt-3 text-3xl text-ink">{post.title}</h1>
      {post.publishedAt && <p className="mt-2 text-sm text-slateink">{format(new Date(post.publishedAt), 'd MMM yyyy')}</p>}

      {post.featuredImage && (
        <ImageWithFallback src={post.featuredImage} alt={post.title} ratio="aspect-video" className="mt-6 rounded-lg" imgClassName="object-cover" />
      )}

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
              <Link key={r._id} to={`/blog/${r.slug}`} className="text-sm font-medium text-safety hover:underline">{r.title}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
