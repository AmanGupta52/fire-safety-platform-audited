import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Wrench } from 'lucide-react';
import { Card, EmptyState, ErrorState } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useServices } from '../../hooks/useServices';
import { getServiceIcon, formatServicePrice } from '../../utils/serviceUtils';

export default function ServicesOverview() {
  const { data: services, isLoading, isError, refetch } = useServices();

  return (
    <div>
      <section className="bg-ink py-16 text-white">
        <div className="container-page">
          <h1 className="heading text-3xl">Fire safety services</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            Installation, refilling, inspection, audits and AMC — booked online, carried out by trained technicians, and logged against your equipment.
          </p>
          <Link to="/book-service">
            <Button size="lg" className="mt-6">
              Book a service <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="container-page py-14">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonList count={6} />
          </div>
        ) : isError ? (
          <ErrorState
            title="Could not load services"
            description="We were unable to fetch the available services from the server. Please try again."
            onRetry={() => refetch()}
          />
        ) : !services || services.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No services currently listed"
            description="Our service catalog is currently being updated. Please check back shortly or contact our team directly."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = getServiceIcon(s.slug, s.category);
              const imageUrl = typeof s.image === 'object' && s.image ? s.image.url : typeof s.image === 'string' ? s.image : undefined;

              return (
                <Link key={s._id || s.slug} to={`/services/${s.slug}`}>
                  <Card className="flex h-full flex-col justify-between p-6 transition-shadow hover:shadow-card-hover">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={s.name}
                            className="h-10 w-10 rounded object-cover border border-line"
                            onError={(e) => {
                              // Fallback gracefully to icon if image fails to load
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-safety-light">
                            <Icon className="h-5 w-5 text-safety" />
                          </div>
                        )}
                        <div className="flex flex-col items-end gap-1">
                          <span className="heading whitespace-nowrap text-xs text-safety">
                            From {formatServicePrice(s.startingPrice, s.priceUnit, s.currency === 'INR' ? '₹' : s.currency)}
                          </span>
                          {s.isFeatured && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Sparkles className="h-2.5 w-2.5" /> Popular
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="heading mt-4 text-base text-ink">{s.name}</p>
                      <p className="mt-1.5 text-sm text-slateink line-clamp-3">
                        {s.shortDescription || s.description}
                      </p>
                    </div>

                    <span className="mt-4 inline-block text-sm font-medium text-safety">
                      Learn more →
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
