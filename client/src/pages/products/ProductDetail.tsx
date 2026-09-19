import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Heart, ShoppingCart, FileDown, FlameKindling, Minus, Plus, MessageSquarePlus } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { Product, Review } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Badge, StarRating, Spinner, EmptyState, Card } from '../../components/ui/Primitives';
import { Textarea } from '../../components/ui/FormControls';
import { ProductCard } from '../../components/product/ProductCard';

type Tab = 'description' | 'specifications' | 'features' | 'reviews';

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>('description');
  const { addToCart, isAdding } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['product-detail', slug],
    queryFn: async () => (await api.get(`/products/${slug}`)).data.data as { product: Product; related: Product[] },
    enabled: Boolean(slug)
  });

  const { data: reviews } = useQuery({
    queryKey: ['product-reviews', data?.product._id],
    queryFn: async () => (await api.get(`/reviews/product/${data!.product._id}`)).data.data as Review[],
    enabled: Boolean(data?.product._id)
  });

  if (isLoading || !data) return <Spinner />;
  const { product, related } = data;
  const price = product.discountPrice ?? product.price;
  const min = product.minimumOrderQuantity;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'description', label: 'Description' },
    { key: 'specifications', label: 'Specifications' },
    { key: 'features', label: 'Features' },
    { key: 'reviews', label: 'Reviews', count: reviews?.length || 0 }
  ];

  return (
    <div className="container-page py-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="group flex aspect-square items-center justify-center overflow-hidden rounded-card border border-line bg-slate-50 cursor-zoom-in">
            {product.images?.[activeImage]?.url ? (
              <img src={product.images[activeImage].url} alt={product.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-150" />
            ) : (
              <FlameKindling className="h-16 w-16 text-line" />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={clsx('h-16 w-16 overflow-hidden rounded-btn border-2', i === activeImage ? 'border-ink' : 'border-line')}>
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.brand && <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{product.brand}</p>}
          <h1 className="heading mt-1 text-2xl text-ink">{product.name}</h1>
          <p className="mt-1 text-xs text-slateink">SKU: {product.sku} {product.modelNumber && `· Model ${product.modelNumber}`}</p>

          {product.ratingCount > 0 && (
            <button onClick={() => setActiveTab('reviews')} className="mt-3 block">
              <StarRating rating={product.ratingAverage} count={product.ratingCount} size="md" />
            </button>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="heading text-3xl font-semibold text-ink">₹{price.toLocaleString('en-IN')}</span>
            {product.discountPrice && <span className="text-base text-slate-400 line-through">₹{product.price.toLocaleString('en-IN')}</span>}
          </div>
          <p className="mt-0.5 text-xs text-slateink">Inclusive of {product.gstPercentage}% GST</p>

          <p className="mt-3 text-sm">
            {product.stock > 0 ? <Badge tone="success">In stock</Badge> : <Badge tone="danger">Out of stock</Badge>}
          </p>

          {product.shortDescription && <p className="mt-4 text-sm leading-relaxed text-slateink">{product.shortDescription}</p>}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-btn border border-line">
              <button onClick={() => setQuantity((q) => Math.max(min, q - 1))} className="p-2.5 text-slateink hover:bg-paper"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center text-sm font-medium">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="p-2.5 text-slateink hover:bg-paper"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            {min > 1 && <span className="text-xs text-slateink">Min. order: {min}</span>}
          </div>

          <div className="mt-4 flex gap-3">
            <Button size="lg" className="flex-1" disabled={product.stock === 0 || isAdding} onClick={() => addToCart({ productId: product._id, quantity })}>
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </Button>
            <Button
              size="lg" variant="secondary" className="flex-1" disabled={product.stock === 0}
              onClick={() => { addToCart({ productId: product._id, quantity }); navigate('/cart'); }}
            >
              Buy now
            </Button>
            <button
              onClick={() => toggleWishlist(product._id)}
              className="flex items-center justify-center rounded-btn border border-line px-4 hover:bg-white"
              aria-label="Toggle wishlist"
            >
              <Heart className={clsx('h-4 w-4', isWishlisted(product._id) ? 'fill-safety text-safety' : 'text-slateink')} />
            </button>
          </div>

          {product.datasheetUrl && (
            <a href={product.datasheetUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-sm text-ink hover:underline">
              <FileDown className="h-4 w-4" /> Download datasheet
            </a>
          )}

          {(product.certifications.length > 0 || product.fireClass?.length) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.fireClass?.map((fc) => <Badge key={fc} tone="info">Class {fc}</Badge>)}
              {product.certifications.map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}
            </div>
          )}

          <div className="mt-6 rounded-card border border-line p-4">
            <p className="text-sm font-medium text-ink">Buying in bulk for a site or building?</p>
            <p className="mt-1 text-sm text-slateink">Get a priced quotation with GST invoicing for orders across multiple locations.</p>
            <Link to="/request-quote" className="mt-2 inline-block text-sm font-medium text-safety hover:underline">
              Request a bulk quote →
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-14">
        <div className="flex gap-6 border-b border-line">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.key ? 'border-safety text-ink' : 'border-transparent text-slateink hover:text-ink'
              )}
            >
              {tab.label}{typeof tab.count === 'number' && ` (${tab.count})`}
            </button>
          ))}
        </div>

        <div className="py-8">
          {activeTab === 'description' && (
            product.description
              ? <p className="max-w-3xl text-sm leading-relaxed text-slateink">{product.description}</p>
              : <p className="text-sm text-slateink">No description available for this product.</p>
          )}

          {activeTab === 'specifications' && (
            product.specifications.length > 0 ? (
              <div className="max-w-2xl overflow-hidden rounded-card border border-line">
                {product.specifications.map((spec, i) => (
                  <div key={i} className={clsx('flex justify-between px-4 py-3 text-sm', i % 2 === 1 && 'bg-slate-50')}>
                    <span className="text-slateink">{spec.key}</span><span className="font-medium text-ink">{spec.value}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slateink">No specifications listed.</p>
          )}

          {activeTab === 'features' && (
            product.features.length > 0 ? (
              <ul className="flex max-w-2xl flex-col gap-3">
                {product.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slateink"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-safety" /> {f}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-slateink">No features listed.</p>
          )}

          {activeTab === 'reviews' && <ReviewsSection productId={product._id} reviews={reviews || []} />}
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-8">
          <h2 className="heading text-2xl text-ink">You might also need</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsSection({ productId, reviews }: { productId: string; reviews: Review[] }) {
  const user = useAuthStore((s) => s.user);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<{ rating: number; title?: string; comment: string }>({ defaultValues: { rating: 5 } });

  const mutation = useMutation({
    mutationFn: async (values: { rating: number; title?: string; comment: string }) => api.post('/reviews', { ...values, productId }),
    onSuccess: () => {
      toast.success('Review submitted — it will appear once approved.');
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slateink">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
        {user && <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}><MessageSquarePlus className="h-3.5 w-3.5" /> Write a review</Button>}
      </div>

      {showForm && (
        <Card className="mt-4 p-5">
          <form className="flex flex-col gap-3" onSubmit={handleSubmit((v) => mutation.mutate({ ...v, rating: Number(v.rating) }))}>
            <select {...register('rating')} className="w-32 rounded-btn border border-line px-3 py-2 text-sm">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
            </select>
            <Textarea placeholder="Share your experience with this product..." required {...register('comment')} />
            <Button type="submit" loading={mutation.isPending} className="self-start">Submit review</Button>
          </form>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {reviews.length === 0 ? (
          <EmptyState icon={MessageSquarePlus} title="No reviews yet" description="Be the first to share your experience with this product." />
        ) : (
          reviews.map((r) => (
            <Card key={r._id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{typeof r.user === 'object' ? r.user.name : 'Customer'}</p>
                <StarRating rating={r.rating} />
              </div>
              {r.title && <p className="mt-1.5 text-sm font-medium text-ink">{r.title}</p>}
              <p className="mt-1 text-sm text-slateink">{r.comment}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
