import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, ShieldCheck, Wrench, RefreshCw, ClipboardCheck, ClipboardList, FlameKindling,
  BadgeCheck, Clock, Users, Award, Phone, Mail, MapPin, CheckCircle2
} from 'lucide-react';
import { api } from '../lib/apiClient';
import { Product, Category, BlogPost } from '../types';
import { useServices } from '../hooks/useServices';
import { usePublicSettings } from '../hooks/usePublicSettings';
import { getServiceIcon, formatServicePrice } from '../utils/serviceUtils';
import { ProductCard } from '../components/product/ProductCard';
import { Button } from '../components/ui/Button';
import { Card, Skeleton, ErrorState, SkeletonGroup } from '../components/ui/Primitives';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Reveal } from '../components/ui/Reveal';
import { CategoryShowcase } from '../components/home/CategoryShowcase';
import { CategoryCircles } from '../components/home/CategoryCircles';

export default function Home() {
  const { data: services, isLoading: servicesLoading } = useServices();
  const { company } = usePublicSettings();
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useQuery({
    queryKey: ['home-categories'],
    queryFn: async () => (await api.get('/categories')).data.data as Category[]
  });
  const { data: bestSellers, isLoading: bestSellersLoading } = useQuery({
    queryKey: ['home-bestsellers'],
    queryFn: async () => (await api.get('/products', { params: { bestSeller: true, limit: 4 } })).data.data as Product[]
  });
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['home-blog'],
    queryFn: async () => (await api.get('/blog', { params: { limit: 3 } })).data.data as BlogPost[]
  });

  return (
    <div>
      {/* SHOP BY CATEGORY — a single rotating photo banner. Cross-fades to the next
          category every 3s; clicking it opens that category's product listing. This is
          the homepage's only "browse by category" entry point (search itself lives in the
          header on desktop, and in its mobile drawer, so it doesn't need repeating here). */}
      <section className="container-page py-10 lg:py-14">
        <div className="mb-4 flex items-end justify-between">
          <h1 className="heading text-2xl text-ink">Shop by category</h1>
          <Link to="/products" className="text-sm font-medium text-safety hover:underline">View all products →</Link>
        </div>
        {categoriesLoading ? (
          <SkeletonGroup label="Loading categories">
            <Skeleton className="h-64 w-full sm:h-80 lg:h-96" />
          </SkeletonGroup>
        ) : categoriesError ? (
          <ErrorState title="Couldn't load categories" description="Something went wrong loading the category showcase." onRetry={() => refetchCategories()} />
        ) : (
          <Reveal>
            <CategoryShowcase categories={categories} intervalMs={3000} />
          </Reveal>
        )}

        {/* All categories, at a glance — a horizontally-scrollable row of circular category
            avatars beneath the rotating banner above, so every category is one tap away
            without waiting for the banner to cycle round to it. */}
        {!categoriesLoading && !categoriesError && categories && categories.length > 0 && (
          <div className="mt-6">
            <CategoryCircles categories={categories} />
          </div>
        )}
      </section>

      {/* FEATURED PRODUCTS */}
      {bestSellersLoading ? (
        <section className="border-y border-line bg-white py-16 lg:py-20">
          <div className="container-page">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="heading text-2xl text-ink">Featured products</h2>
            </div>
            <SkeletonGroup label="Loading featured products" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </SkeletonGroup>
          </div>
        </section>
      ) : bestSellers && bestSellers.length > 0 && (
        <section className="border-y border-line bg-white py-16 lg:py-20">
          <div className="container-page">
            <Reveal className="mb-6 flex items-end justify-between">
              <h2 className="heading text-2xl text-ink">Featured products</h2>
              <Link to="/products?bestSeller=true" className="text-sm font-medium text-safety hover:underline">View all →</Link>
            </Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {bestSellers.map((p, i) => (
                <Reveal key={p._id} delay={Math.min(i * 0.06, 0.3)}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="border-t border-line bg-white py-16 lg:py-24">
        <div className="container-page">
          <Reveal className="mx-auto max-w-lg text-center">
            <h2 className="heading text-2xl text-ink">Services that keep you compliant</h2>
            <p className="mt-2 text-sm text-slateink">
              Our technicians handle installation, refilling, inspection and audits — with every visit logged
              against your equipment record.
            </p>
          </Reveal>
          {servicesLoading ? (
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 rounded-card border border-line bg-slate-50 p-6 animate-pulse" />
              ))}
            </div>
          ) : services && services.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.slice(0, 4).map((srv, idx) => {
                const Icon = getServiceIcon(srv.slug, srv.category);
                return (
                  <Reveal key={srv._id} delay={Math.min(idx * 0.06, 0.3)}>
                    <ServiceCard
                      icon={Icon}
                      title={srv.name}
                      description={srv.shortDescription || srv.description}
                      to={`/services/${srv.slug}`}
                      price={srv.startingPrice ? formatServicePrice(srv.startingPrice, srv.priceUnit) : 'Contact'}
                    />
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <div className="mt-10 text-center text-sm text-slateink">
              No services currently available.
            </div>
          )}
        </div>
      </section>

      {/* AMC */}
      <section className="bg-ink py-16 text-paper lg:py-24">
        <Reveal className="container-page mx-auto max-w-2xl text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber" />
          <h2 className="heading mt-3 text-2xl lg:text-3xl">Never miss a refill or a renewal again</h2>
          <p className="mt-3 text-slate-400">
            Register your extinguishers and equipment once — our AMC plans track every refill, inspection
            and renewal date automatically, with reminders sent before anything lapses.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/services/amc"><Button size="lg">Explore AMC plans</Button></Link>
            <Link to="/request-quote"><Button size="lg" variant="outlineLight">Request a bulk quote</Button></Link>
          </div>
        </Reveal>
      </section>

      {/* WHY CHOOSE US */}
      <section className="container-page py-16 lg:py-20">
        <Reveal><h2 className="heading text-2xl text-ink">Why sites choose us</h2></Reveal>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Reveal delay={0}><WhyCard icon={Users} value="500+" label="Sites served" /></Reveal>
          <Reveal delay={0.06}><WhyCard icon={Award} value="10+ yrs" label="In fire safety" /></Reveal>
          <Reveal delay={0.12}><WhyCard icon={Clock} value="24-48h" label="Typical response time" /></Reveal>
          <Reveal delay={0.18}><WhyCard icon={BadgeCheck} value="100%" label="Technician-logged visits" /></Reveal>
        </div>
      </section>

      {/* ABOUT */}
      <section className="border-y border-line bg-paper py-16 lg:py-24">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal y={24}>
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
          </Reveal>
          <Reveal y={24} delay={0.1}>
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
          </Reveal>
        </div>
      </section>

      {/* Blog preview */}
      {postsLoading ? (
        <section className="container-page py-16 lg:py-24">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="heading text-2xl text-ink">Fire safety resources</h2>
          </div>
          <SkeletonGroup label="Loading articles" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-card border border-line bg-card p-5 shadow-card">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-2.5 h-4 w-full" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </div>
            ))}
          </SkeletonGroup>
        </section>
      ) : posts && posts.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <Reveal className="mb-6 flex items-end justify-between">
            <h2 className="heading text-2xl text-ink">Fire safety resources</h2>
            <Link to="/blog" className="text-sm font-medium text-safety hover:underline">View all →</Link>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal key={post._id} delay={Math.min(i * 0.08, 0.3)}>
                <Link to={`/blog/${post.slug}`}>
                  <Card className="h-full p-5 hover:-translate-y-0.5 hover:shadow-card-hover">
                    {post.category && <p className="text-xs font-medium text-safety">{post.category}</p>}
                    <p className="heading mt-1.5 text-sm text-ink">{post.title}</p>
                    {post.excerpt && <p className="mt-1.5 line-clamp-2 text-xs text-slateink">{post.excerpt}</p>}
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT / FINAL CTA */}
      <section className="container-page pb-16 lg:pb-24">
        <Reveal>
          <Card className="flex flex-col items-center gap-5 bg-safety-light p-10 text-center">
            <h2 className="heading text-2xl text-ink">Need a bulk quotation for your building?</h2>
            <p className="max-w-md text-sm text-slateink">
              Tell us about your site — offices, factories, warehouses, schools or hospitals — and we'll send a
              priced quotation within one business day.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink">
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-safety" /> {company.phone}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-safety" /> {company.email}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-safety" /> {company.address || 'Pan-India service'}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/request-quote"><Button size="lg">Request a quote</Button></Link>
              <Link to="/contact"><Button size="lg" variant="secondary">Contact us</Button></Link>
            </div>
          </Card>
        </Reveal>
      </section>
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

function ServiceCard({ icon: Icon, title, description, to, price }: { icon: typeof Wrench; title: string; description: string; to: string; price: string }) {
  return (
    <Link to={to} className="group h-full">
      <div className="h-full rounded-card border border-line border-l-[3px] border-l-ink bg-white p-6 shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-l-safety group-hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-2">
          <Icon className="h-6 w-6 text-safety" />
          <span className="heading whitespace-nowrap text-xs text-safety">From {price}</span>
        </div>
        <p className="heading mt-4 text-base text-ink">{title}</p>
        <p className="mt-1.5 text-sm text-slateink">{description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink">
          Learn more <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

