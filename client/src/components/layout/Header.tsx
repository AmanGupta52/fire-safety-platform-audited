import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { FlameKindling, Search, Heart, ShoppingCart, User, Menu, X, ChevronDown, Phone, Mail, PackageCheck } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { Category } from '../../types';

const NAV_LINKS = [
  { to: '/services', label: 'Services' },
  { to: '/services/amc', label: 'AMC' },
  { to: '/blog', label: 'Resources' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' }
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['header-categories'],
    queryFn: async () => (await api.get('/categories')).data.data as Category[],
    enabled: productsOpen,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 80); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setMobileOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* Utility strip */}
      <div className="hidden bg-ink text-white/80 lg:block">
        <div className="container-page flex items-center justify-between py-1.5 text-xs">
          <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> Emergency support: +91-00000-00000</span>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> support@firesafety.example</span>
            <Link to="/account/orders" className="flex items-center gap-1.5 hover:text-white"><PackageCheck className="h-3 w-3" /> Track order</Link>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          'border-b border-line transition-all duration-200',
          scrolled ? 'bg-white/95 shadow-card backdrop-blur' : 'bg-white'
        )}
      >
        <div className={clsx('container-page flex items-center gap-6 transition-all duration-200', scrolled ? 'py-2.5' : 'py-4')}>
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className={clsx('flex items-center justify-center rounded bg-safety transition-all duration-200', scrolled ? 'h-8 w-8' : 'h-9 w-9')}>
              <FlameKindling className="h-4 w-4 text-white" />
            </div>
            <span className="heading text-base text-ink">Fire Safety</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <div className="relative" onMouseEnter={() => setProductsOpen(true)} onMouseLeave={() => setProductsOpen(false)}>
              <Link to="/products" className="flex items-center gap-1 text-sm font-medium text-slateink hover:text-ink">
                Products <ChevronDown className="h-3.5 w-3.5" />
              </Link>
              <AnimatePresence>
                {productsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.12 }}
                    className="absolute left-1/2 top-full z-20 mt-2 w-[560px] -translate-x-1/2 rounded-card border border-line bg-white p-5 shadow-raised"
                  >
                    {categoriesLoading ? (
                      <div className="grid grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                        {(categories || []).map((cat) => (
                          <Link
                            key={cat._id} to={`/products?category=${cat.slug}`}
                            className="flex items-center gap-2.5 rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-safety-light">
                              <FlameKindling className="h-3.5 w-3.5 text-safety" />
                            </span>
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 border-t border-line pt-3">
                      <Link to="/products" className="text-sm font-medium text-safety hover:underline">Shop all products →</Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {NAV_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="text-sm font-medium text-slateink hover:text-ink">{link.label}</Link>
            ))}
            <Link to="/request-quote" className="text-sm font-medium text-safety hover:text-safety-dark">Book a service →</Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setSearchOpen((v) => !v)} className="rounded-full p-2.5 text-ink hover:bg-paper" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <Link to="/wishlist" className="relative rounded-full p-2.5 text-ink hover:bg-paper" aria-label="Wishlist">
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-pill bg-safety text-[9px] font-semibold text-white">{wishlistCount}</span>}
            </Link>
            <Link to="/cart" className="relative rounded-full p-2.5 text-ink hover:bg-paper" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence>
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-pill bg-safety text-[9px] font-semibold text-white"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            <div className="relative hidden lg:block">
              <button onClick={() => setAccountOpen((v) => !v)} className="flex items-center gap-1.5 rounded-full p-2.5 text-ink hover:bg-paper">
                <User className="h-5 w-5" />
                {user && <ChevronDown className="h-3 w-3" />}
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-card border border-line bg-white py-1.5 shadow-raised">
                  {user ? (
                    <>
                      <div className="border-b border-line px-3.5 py-2"><p className="text-sm font-medium text-ink">{user.name}</p><p className="text-xs text-slateink">{user.email}</p></div>
                      <MenuLink to="/account/orders" onClick={() => setAccountOpen(false)}>My orders</MenuLink>
                      <MenuLink to="/account/quotes" onClick={() => setAccountOpen(false)}>My quotes</MenuLink>
                      <MenuLink to="/account/equipment" onClick={() => setAccountOpen(false)}>My equipment</MenuLink>
                      <MenuLink to="/account/profile" onClick={() => setAccountOpen(false)}>Account settings</MenuLink>
                      <button onClick={() => { logout(); setAccountOpen(false); navigate('/'); }} className="block w-full px-3.5 py-2 text-left text-sm text-safety hover:bg-safety-light">Sign out</button>
                    </>
                  ) : (
                    <>
                      <MenuLink to="/login" onClick={() => setAccountOpen(false)}>Sign in</MenuLink>
                      <MenuLink to="/register" onClick={() => setAccountOpen(false)}>Create account</MenuLink>
                    </>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setMobileOpen(true)} className="rounded-full p-2.5 text-ink hover:bg-paper lg:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search slide-down overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-line bg-white shadow-card"
          >
            <div className="container-page py-5">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateink" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search extinguishers, alarms, AMC plans..."
                  className="w-full rounded-btn border border-line bg-paper py-3 pl-10 pr-10 text-sm focus:border-ink focus:outline-none"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slateink hover:text-ink" aria-label="Close search">
                  <X className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }}
              className="ml-auto flex h-full w-72 flex-col bg-white p-5" onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="heading text-sm">Menu</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateink" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full rounded-btn border border-line bg-paper py-2 pl-9 pr-3 text-sm focus:outline-none" />
              </form>
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                <Link to="/products" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm font-medium text-ink hover:bg-paper">Products</Link>
                {NAV_LINKS.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm font-medium text-ink hover:bg-paper">{link.label}</Link>
                ))}
                <div className="my-2 border-t border-line" />
                {user ? (
                  <>
                    <Link to="/account/orders" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper">My orders</Link>
                    <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper">Wishlist</Link>
                    <Link to="/cart" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper">Cart</Link>
                    <Link to="/account/equipment" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper">My equipment</Link>
                    <button onClick={() => { logout(); setMobileOpen(false); navigate('/'); }} className="rounded-btn px-2 py-2 text-left text-sm text-safety hover:bg-safety-light">Sign out</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper">Sign in</Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="rounded-btn px-2 py-2 text-sm text-ink hover:bg-paper">Create account</Link>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function MenuLink({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) {
  return <Link to={to} onClick={onClick} className="block px-3.5 py-2 text-sm text-ink hover:bg-paper">{children}</Link>;
}
