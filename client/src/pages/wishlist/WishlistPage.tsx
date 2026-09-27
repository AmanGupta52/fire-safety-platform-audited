import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../../hooks/useWishlist';
import { ProductCard } from '../../components/product/ProductCard';
import { EmptyState } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';

export default function WishlistPage() {
  const { wishlist } = useWishlist();

  return (
    <div className="container-page py-8">
      <h1 className="heading text-xl text-ink">Your wishlist</h1>

      {wishlist.length === 0 ? (
        <EmptyState icon={Heart} title="Your wishlist is empty" description="Save products you're considering so you can find them easily later." action={<Link to="/products"><Button>Browse products</Button></Link>} />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {wishlist.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}
