import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, ShieldCheck, Wrench, RefreshCw, ClipboardCheck, ClipboardList, FlameKindling,
  BadgeCheck, Clock, Users, Award, Search, Phone, Mail, MapPin, CheckCircle2
} from 'lucide-react';
import { api } from '../lib/apiClient';
import { Product, Category, BlogPost } from '../types';
import { ProductCard } from '../components/product/ProductCard';
import { Button } from '../components/ui/Button';
import { Card, Skeleton } from '../components/ui/Primitives';

export default function Home() {
  const navigate = useNavigate();
  const [heroSearch, setHeroSearch] = useState('');

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['home-categories'],
    queryFn: async () => (await api.get('/categories')).data.data as Category[]
  });
  const { data: bestSellers } = useQuery({
    queryKey: ['home-bestsellers'],
    queryFn: async () => (await api.get('/products', { params: { bestSeller: true, limit: 4 } })).data.data as Product[]
  });
  const { data: posts } = useQuery({
    queryKey: ['home-blog'],
    queryFn: async () => (await api.get('/blog', { params: { limit: 3 } })).data.data as BlogPost[]
  });

  function handleHeroSearch(e: React.FormEvent) {
    e.preventDefault();
    if (heroSearch.trim()) navigate(`/products?q=${encodeURIComponent(heroSearch.trim())}`);
  }

  return (
    <div>
      {/* HERO + SEARCH */}
      <section className="relative overflow-hidden bg-ink">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-safety/20 blur-3xl" />
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-amber" /> Trusted by homes, offices and factories across India
            </span>
            <h1 className="heading max-w-2xl text-4xl leading-[1.1] text-paper lg:text-6xl">
              Fire safety equipment and services, handled end to end.
            </h1>
            <p className="max-w-xl text-lg text-slate-400">
              Shop extinguishers, alarms and suppression systems, book installation and inspection, and keep
              every AMC contract and refill date on track — all from one place.
            </p>

            <form onSubmit={handleHeroSearch} className="flex w-full max-w-lg items-center gap-1 rounded-btn bg-white p-1.5 shadow-raised">
              <Search className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                type="text"
                placeholder="Search extinguishers, alarms, AMC plans…"
                className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
              />
              <Button type="submit" size="md">Search</Button>
            </form>

            <div className="flex flex-wrap gap-3">
              <Link to="/products"><Button size="lg">Explore products <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/request-quote"><Button size="lg" variant="secondary" className="border-paper bg-transparent text-paper hover:bg-white/10">Request a quote</Button></Link>
            </div>

            <div className="mt-1 flex flex-wrap gap-2.5">
              {['Certified products', '24/7 support', 'Pan-India service', 'GST invoicing'].map((chip) => (
                <span key={chip} className="rounded-btn border border-paper/20 bg-paper/10 px-4 py-2 text-sm text-paper backdrop-blur">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TagStat icon={Users} value="500+" label="Sites served" />
            <TagStat icon={Award} value="10+ yrs" label="In fire safety" />
            <TagStat icon={Clock} value="24-48h" label="Typical response time" />
            <TagStat icon={BadgeCheck} value="100%" label="Technician-logged visits" />
          </div>
        </div>
      </section>
      <div className="hazard-divider h-2.5" aria-hidden="true" />

      {/* CATEGORIES */}
      <section className="container-page py-16 lg:py-20">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="heading text-2xl text-ink">Shop by category</h2>
          <Link to="/products" className="text-sm font-medium text-safety hover:underline">View all products →</Link>
        </div>
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
          {categoriesLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square w-[168px] shrink-0 sm:w-auto" />)
            : (categories || []).map((cat) => (
                <div key={cat._id} className="snap-start sm:contents">
                  <CategoryCard category={cat} />
                </div>
              ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {bestSellers && bestSellers.length > 0 && (
        <section className="border-y border-line bg-white py-16 lg:py-20">
          <div className="container-page">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="heading text-2xl text-ink">Featured products</h2>
              <Link to="/products?bestSeller=true" className="text-sm font-medium text-safety hover:underline">View all →</Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {bestSellers.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* FULL CATALOG, grouped by category */}
      <section className="container-page py-6">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="heading text-2xl text-ink">Full catalog</h2>
          <Link to="/products" className="text-sm font-medium text-safety hover:underline">View all →</Link>
        </div>
        {categoriesLoading ? (
          <div className="grid grid-cols-2 gap-4 py-8 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
          </div>
        ) : (
          (categories || []).map((cat) => <CategoryProductRow key={cat._id} category={cat} />)
        )}
      </section>

      {/* SERVICES */}
      <section className="border-t border-line bg-white py-16 lg:py-24">
        <div className="container-page">
          <h2 className="heading text-center text-2xl text-ink">Services that keep you compliant</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-slateink">
            Our technicians handle installation, refilling, inspection and audits — with every visit logged
            against your equipment record.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ServiceCard icon={Wrench} title="Installation" description="Professional fitting for extinguishers, hydrants and alarm systems." to="/services/installation" />
            <ServiceCard icon={RefreshCw} title="Refilling" description="Scheduled refills with reminders before your extinguisher runs out." to="/services/refilling" />
            <ServiceCard icon={ClipboardCheck} title="Inspection" description="Routine inspections logged against every registered asset." to="/services/inspection" />
            <ServiceCard icon={ClipboardList} title="Fire safety audit" description="A full-site audit covering equipment, exits, signage and compliance gaps." to="/services/fire-safety-audit" />
          </div>
        </div>
      </section>

      {/* AMC */}
      <section className="bg-ink py-16 text-paper lg:py-24">
        <div className="container-page mx-auto max-w-2xl text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber" />
          <h2 className="heading mt-3 text-2xl lg:text-3xl">Never miss a refill or a renewal again</h2>
          <p className="mt-3 text-slate-400">
            Register your extinguishers and equipment once — our AMC plans track every refill, inspection
            and renewal date automatically, with reminders sent before anything lapses.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/services/amc"><Button size="lg">Explore AMC plans</Button></Link>
            <Link to="/request-quote"><Button size="lg" variant="secondary" className="border-paper bg-transparent text-paper hover:bg-white/10">Request a bulk quote</Button></Link>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="container-page py-16 lg:py-20">
        <h2 className="heading text-2xl text-ink">Why sites choose us</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <WhyCard icon={Users} value="500+" label="Sites served" />
          <WhyCard icon={Award} value="10+ yrs" label="In fire safety" />
          <WhyCard icon={Clock} value="24-48h" label="Typical response time" />
          <WhyCard icon={BadgeCheck} value="100%" label="Technician-logged visits" />
        </div>
      </section>

      {/* ABOUT */}
      <section className="border-y border-line bg-paper py-16 lg:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="heading text-2xl text-ink">A fire safety partner for the long haul</h2>
            <p className="mt-3 max-w-lg text-sm text-slateink">
              We supply certified fire safety equipment and carry out the installation, maintenance and
              inspection work that keeps it compliant — with one account covering every product, service
              visit and AMC contract on your site.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {[
                'Equipment sourced to recognised safety specifications',
                'Technicians trained and certified for every service type',
                'Every visit and renewal logged against your equipment record',
                'GST-compliant invoicing for offices, factories and institutions'
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-safety" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <Card className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden">
            {[
              { icon: FlameKindling, label: 'Extinguishers' },
              { icon: ShieldCheck, label: 'Alarm systems' },
              { icon: Wrench, label: 'Hydrant systems' },
              { icon: ClipboardCheck, label: 'Sprinkler systems' }
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-start gap-2 p-6">
                <Icon className="h-5 w-5 text-safety" />
                <p className="heading text-sm text-ink">{label}</p>
              </div>
            ))}
          </Card>
        </div>
      </section>

      {/* Blog preview */}
      {posts && posts.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="heading text-2xl text-ink">Fire safety resources</h2>
            <Link to="/blog" className="text-sm font-medium text-safety hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {posts.map((post) => (
              <Link key={post._id} to={`/blog/${post.slug}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-card-hover">
                  {post.category && <p className="text-xs font-medium text-safety">{post.category}</p>}
                  <p className="heading mt-1.5 text-sm text-ink">{post.title}</p>
                  {post.excerpt && <p className="mt-1.5 line-clamp-2 text-xs text-slateink">{post.excerpt}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT / FINAL CTA */}
      <section className="container-page pb-16 lg:pb-24">
        <Card className="flex flex-col items-center gap-5 bg-safety-light p-10 text-center">
          <h2 className="heading text-2xl text-ink">Need a bulk quotation for your building?</h2>
          <p className="max-w-md text-sm text-slateink">
            Tell us about your site — offices, factories, warehouses, schools or hospitals — and we'll send a
            priced quotation within one business day.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink">
            <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-safety" /> +91-00000-00000</span>
            <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-safety" /> support@firesafety.example</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-safety" /> Pan-India service</span>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/request-quote"><Button size="lg">Request a quote</Button></Link>
            <Link to="/contact"><Button size="lg" variant="secondary">Contact us</Button></Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

function TagStat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="relative rounded-lg border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm">
      <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white/20" />
      <Icon className="h-4 w-4 text-amber" />
      <p className="heading mt-2 text-2xl text-paper">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function WhyCard({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="rounded-card border border-line border-l-[3px] border-l-safety bg-white p-5 shadow-card">
      <Icon className="h-5 w-5 text-safety" />
      <p className="heading mt-3 text-2xl text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-slateink">{label}</p>
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      to={`/products?category=${category.slug}`}
      className="group flex w-[168px] shrink-0 flex-col overflow-hidden rounded-card border border-line bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover sm:w-auto"
    >
      <div className="aspect-square overflow-hidden bg-paper">
        {category.image ? (
          <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FlameKindling className="h-8 w-8 text-safety" />
          </div>
        )}
      </div>
      <div className="border-l-2 border-safety px-3.5 py-3">
        <p className="heading text-sm text-ink">{category.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slateink">{category.description || 'Certified equipment, ready to ship'}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-safety">
          View products <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function ServiceCard({ icon: Icon, title, description, to }: { icon: typeof Wrench; title: string; description: string; to: string }) {
  return (
    <Link to={to} className="group h-full">
      <div className="h-full rounded-card border border-line border-l-[3px] border-l-ink bg-white p-6 shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-l-safety group-hover:shadow-card-hover">
        <Icon className="h-6 w-6 text-safety" />
        <p className="heading mt-4 text-base text-ink">{title}</p>
        <p className="mt-1.5 text-sm text-slateink">{description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink">
          Learn more <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

// Renders one category's row of products, like the per-category listing rows on a typical
// B2B catalog homepage. Each row fetches its own products so the page can show every
// category without one giant combined query, and skips itself entirely if that category
// has nothing to show yet.
function CategoryProductRow({ category }: { category: Category }) {
  const { data, isLoading } = useQuery({
    queryKey: ['home-category-row', category._id],
    queryFn: async () => (await api.get('/products', { params: { category: category._id, limit: 5, sort: 'featured' } })).data.data as Product[]
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <div className="border-b border-line py-8 last:border-b-0">
      <div className="mb-4 flex items-end justify-between">
        <h3 className="heading text-lg text-ink">{category.name}</h3>
        <Link to={`/products?category=${category.slug}`} className="text-sm font-medium text-safety hover:underline">View all →</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)
          : (data || []).map((p) => <ProductCard key={p._id} product={p} />)}
      </div>
    </div>
  );
}
