import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Trash2, Tag } from 'lucide-react';
import clsx from 'clsx';
import { useCart } from '../../hooks/useCart';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormControls';
import { Card, EmptyState, Spinner } from '../../components/ui/Primitives';
import { useAuthStore } from '../../store/authStore';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function CartPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { cart, isLoading, updateQuantity, removeItem, applyCoupon, isApplyingCoupon } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const navigate = useNavigate();

  if (!accessToken) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={ShoppingCart} title="Sign in to view your cart"
          description="Your cart is saved to your account so you can pick up where you left off."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </div>
    );
  }

  if (isLoading) return <Spinner />;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Browse our catalog to find fire safety equipment for your home or business." action={<Link to="/products"><Button>Shop products</Button></Link>} />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="heading text-2xl text-ink">Your cart</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col">
          {cart.items.map((item, i) => (
            <div key={item.product._id} className={clsx('flex items-center gap-4 py-4', i !== cart.items.length - 1 && 'border-b border-line')}>
              <Link to={`/product/${item.product.slug}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-card bg-paper">
                {item.product.images?.[0]?.url && <img src={item.product.images[0].url} alt="" className="h-full w-full object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${item.product.slug}`} className="line-clamp-1 text-sm font-medium text-ink hover:underline">{item.product.name}</Link>
                <p className="mt-0.5 text-xs text-slateink">₹{(item.product.discountPrice ?? item.product.price).toLocaleString('en-IN')} each</p>
              </div>
              <div className="flex items-center rounded-btn border border-line">
                <button onClick={() => updateQuantity({ productId: item.product._id, quantity: Math.max(item.product.minimumOrderQuantity, item.quantity - 1) })} className="p-2 text-slateink hover:bg-paper"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <button onClick={() => updateQuantity({ productId: item.product._id, quantity: item.quantity + 1 })} className="p-2 text-slateink hover:bg-paper"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <p className="w-20 shrink-0 text-right text-sm font-medium text-ink">{formatInr((item.product.discountPrice ?? item.product.price) * item.quantity)}</p>
              <button onClick={() => removeItem(item.product._id)} className="rounded-btn p-2 text-slateink transition-colors hover:text-safety" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-24">
          <Card className="p-5">
            <p className="heading text-sm text-ink">Order summary</p>

            <div className="mt-4 flex gap-2">
              <Input placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="flex-1" />
              <Button variant="secondary" size="sm" loading={isApplyingCoupon} onClick={() => couponInput && applyCoupon(couponInput)}><Tag className="h-3.5 w-3.5" /> Apply</Button>
            </div>

            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Row label="Subtotal" value={formatInr(cart.subtotal)} />
              {cart.discount > 0 && <Row label={`Discount ${cart.couponCode ? `(${cart.couponCode})` : ''}`} value={`-${formatInr(cart.discount)}`} valueClass="text-forest" />}
              <Row label="GST" value={formatInr(cart.gstAmount)} />
              <Row label="Shipping" value={cart.shippingFee === 0 ? 'Free' : formatInr(cart.shippingFee)} />
              <div className="my-1 border-t border-line" />
              <Row label="Total" value={formatInr(cart.total)} bold />
            </div>

            <Button fullWidth size="lg" className="mt-5" onClick={() => navigate('/checkout')}>Proceed to checkout</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className={clsx('flex justify-between', bold ? 'font-medium text-ink' : 'text-slateink')}>
      <span>{label}</span><span className={valueClass}>{value}</span>
    </div>
  );
}
