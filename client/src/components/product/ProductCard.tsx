import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, FlameKindling, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Product } from '../../types';
import { StarRating, Badge } from '../ui/Primitives';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, isAdding } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);

  const price = product.discountPrice ?? product.price;
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.price);
  const discountPercent = hasDiscount ? Math.round((1 - price / product.price) * 100) : 0;
  const categoryName = typeof product.category === 'object' && product.category ? product.category.name : null;
  const outOfStock = product.stock === 0;
  const lowStock = !outOfStock && product.stock <= 3;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (outOfStock || isAdding) return;
    addToCart({ productId: product._id, quantity: product.minimumOrderQuantity });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.15 }}
      className="group relative rounded-card border border-line bg-card shadow-card transition-shadow duration-200 hover:shadow-card-hover"
    >
      <button
        onClick={(e) => { e.preventDefault(); toggleWishlist(product._id); }}
        aria-label="Toggle wishlist"
        className={clsx(
          'absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 shadow-card transition-opacity hover:bg-white',
          'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
        )}
      >
        <Heart className={clsx('h-4 w-4', isWishlisted(product._id) ? 'fill-safety text-safety' : 'text-slateink')} />
      </button>

      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-card bg-paper p-6">
          {hasDiscount && (
            <span className="absolute left-3 top-3 z-10 rounded bg-safety px-2 py-1 text-xs font-semibold text-white">
              -{discountPercent}%
            </span>
          )}
          {product.images?.[0]?.url ? (
            <img
              src={product.images[0].url}
              alt={product.name}
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <FlameKindling className="h-10 w-10 text-line" />
          )}
        </div>

        <div className="p-4">
          {categoryName && <p className="text-xs uppercase tracking-wide text-slate-400">{categoryName}</p>}
          {product.isBestSeller && <Badge tone="warning">Best seller</Badge>}
          <p className="heading mt-1.5 line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
          {product.ratingCount > 0 && (
            <div className="mt-1.5"><StarRating rating={product.ratingAverage} count={product.ratingCount} /></div>
          )}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="heading text-base font-semibold text-ink">₹{price.toLocaleString('en-IN')}</span>
            {hasDiscount && <span className="text-sm text-slate-400 line-through">₹{product.price.toLocaleString('en-IN')}</span>}
          </div>
          <p className={clsx('mt-0.5 text-xs', outOfStock ? 'text-safety' : lowStock ? 'text-safety' : 'text-forest')}>
            {outOfStock ? 'Out of stock' : lowStock ? `Only ${product.stock} left` : 'In stock'}
          </p>
        </div>
      </Link>

      <div className="px-4 pb-4 sm:h-0 sm:overflow-hidden sm:pb-0 sm:opacity-0 sm:transition-all sm:duration-200 sm:group-hover:h-[46px] sm:group-hover:overflow-visible sm:group-hover:pb-4 sm:group-hover:opacity-100">
        <button
          onClick={handleAddToCart}
          disabled={outOfStock || isAdding}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-btn py-2 text-xs font-medium text-white transition-colors disabled:opacity-40',
            justAdded ? 'bg-forest' : 'bg-ink hover:bg-ink-soft'
          )}
        >
          {justAdded ? (<><Check className="h-3.5 w-3.5" /> Added</>) : (<><ShoppingCart className="h-3.5 w-3.5" /> Add to cart</>)}
        </button>
      </div>
    </motion.div>
  );
}
