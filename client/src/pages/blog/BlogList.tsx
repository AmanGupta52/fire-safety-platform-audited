import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/apiClient';
import { BlogPost } from '../../types';
import { Card, EmptyState, ErrorState, Skeleton, SkeletonGroup } from '../../components/ui/Primitives';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { Pagination } from '../../components/ui/Modal';

function BlogCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-5">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="mt-2.5 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-3/4" />
        <Skeleton className="mt-3 h-3 w-24" />
      </div>
    </div>
  );
}

export default function BlogList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['blog-list', page],
    queryFn: async () => (await api.get('/blog', { params: { page, limit: 9 } })).data as { data: BlogPost[]; meta: { totalPages: number } }
  });

  return (
    <div className="container-page py-10">
      <h1 className="heading text-2xl text-ink">Fire safety resources</h1>
      <p className="mt-1 text-sm text-slateink">Guides, checklists and updates from our fire safety team.</p>

      {isLoading ? (
        <SkeletonGroup label="Loading articles" className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <BlogCardSkeleton key={i} />)}
        </SkeletonGroup>
      ) : isError ? (
        <ErrorState title="Couldn't load articles" description="Something went wrong while fetching resources." onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={Newspaper} title="No articles yet" />
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((post) => (
              <Link key={post._id} to={`/blog/${post.slug}`}>
                <Card className="h-full overflow-hidden hover:shadow-lift">
                  <ImageWithFallback src={post.featuredImage} alt={post.title} ratio="aspect-video" imgClassName="object-cover" fallbackIcon={Newspaper} fallbackLabel="No image" />
                  <div className="p-5">
                    {post.category && <p className="text-xs font-medium text-safety">{post.category}</p>}
                    <p className="heading mt-1.5 text-base text-ink">{post.title}</p>
                    {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slateink">{post.excerpt}</p>}
                    {post.publishedAt && <p className="mt-3 text-xs text-slateink">{format(new Date(post.publishedAt), 'd MMM yyyy')}</p>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
