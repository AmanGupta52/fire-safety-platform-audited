import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, ErrorState } from '../../components/ui/Primitives';
import { useService } from '../../hooks/useServices';
import { getServiceIcon, formatServicePrice } from '../../utils/serviceUtils';
import { NotFound404 } from '../errors/StatusPages';

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: service, isLoading, isError, error, refetch } = useService(slug);

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-5 w-80 animate-pulse rounded bg-slate-200" />
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <div className="h-64 animate-pulse rounded bg-slate-100" />
          <div className="h-64 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  // A service that doesn't exist (bad slug, deactivated, unpublished) is a 404, not a
  // transient failure — "Retry" would just 404 again. Any other failure (network, 500, etc.)
  // keeps the retry affordance, since trying again might actually work.
  if (isError && axios.isAxiosError(error) && error.response?.status === 404) {
    return <NotFound404 />;
  }

  if (isError || !service) {
    return (
      <div className="container-page py-16">
        <Link to="/services" className="inline-flex items-center gap-1.5 text-xs font-medium text-slateink hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to all services
        </Link>
        <div className="mt-6">
          <ErrorState
            title="Couldn't load this service"
            description="Something went wrong while fetching this service's details."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  const Icon = getServiceIcon(service.slug, service.category);
  const mainImage = typeof service.image === 'object' && service.image ? service.image.url : typeof service.image === 'string' ? service.image : undefined;
  const gallery = Array.isArray(service.gallery) ? service.gallery.map((g) => (typeof g === 'object' && g ? g.url : g)).filter(Boolean) : [];

  const ctaLabel = service.slug === 'amc'
    ? 'Request an AMC plan'
    : service.slug === 'fire-safety-audit'
      ? 'Request an audit'
      : `Book ${service.name.toLowerCase()}`;

  return (
    <div>
      {/* Header Banner */}
      <section className="bg-inverse py-16 text-white">
        <div className="container-page">
          <Link to="/services" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white mb-4">
            <ArrowLeft className="h-3 w-3" /> Back to services
          </Link>
          <div className="flex items-center gap-4">
            {mainImage ? (
              <img
                src={mainImage}
                alt={service.name}
                className="h-14 w-14 rounded-lg object-cover border border-white/20"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-safety">
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="heading text-3xl">{service.name}</h1>
              {service.shortDescription && (
                <p className="mt-1 max-w-lg text-sm text-white/70">{service.shortDescription}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container-page py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            {/* Description */}
            <div className="prose max-w-none text-sm leading-relaxed text-slateink whitespace-pre-line">
              {service.description}
            </div>

            {/* Estimated Duration */}
            {service.estimatedDuration && (
              <div className="mt-6 flex items-center gap-2 rounded-md bg-paper p-3 text-xs text-slateink">
                <Clock className="h-4 w-4 text-safety shrink-0" />
                <span>Typical service duration: <strong className="text-ink">{service.estimatedDuration}</strong></span>
              </div>
            )}

            {/* Features */}
            {service.features && service.features.length > 0 && (
              <div className="mt-8">
                <h2 className="heading text-base text-ink mb-3">Key Features</h2>
                <ul className="flex flex-col gap-2.5">
                  {service.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-ink">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Inclusions & Exclusions */}
            {((service.inclusions && service.inclusions.length > 0) || (service.exclusions && service.exclusions.length > 0)) && (
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {service.inclusions && service.inclusions.length > 0 && (
                  <div className="rounded border border-line bg-paper/50 p-4">
                    <p className="heading text-xs font-semibold uppercase tracking-wider text-forest mb-3">
                      What's Included
                    </p>
                    <ul className="flex flex-col gap-2 text-xs text-ink">
                      {service.inclusions.map((inc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {service.exclusions && service.exclusions.length > 0 && (
                  <div className="rounded border border-line bg-paper/50 p-4">
                    <p className="heading text-xs font-semibold uppercase tracking-wider text-brand mb-3">
                      Not Included
                    </p>
                    <ul className="flex flex-col gap-2 text-xs text-slateink">
                      {service.exclusions.map((exc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                          <span>{exc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Gallery Images */}
            {gallery && gallery.length > 0 && (
              <div className="mt-10">
                <h2 className="heading text-base text-ink mb-3">Service Gallery</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((imgUrl, i) => (
                    <img
                      key={i}
                      src={imgUrl}
                      alt={`${service.name} gallery ${i + 1}`}
                      className="h-28 w-full rounded border border-line object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Pricing Card & Booking CTA */}
          <div>
            <Card className="sticky top-24 p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slateink">Starting from</p>
              <p className="heading mt-1 text-3xl text-ink">
                {formatServicePrice(service.startingPrice, service.priceUnit, service.currency === 'INR' ? '₹' : service.currency)}
              </p>
              <p className="mt-1 text-xs text-slateink">
                Final pricing confirmed upon site review and asset specifications.
              </p>

              <div className="my-5 border-t border-line" />

              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 text-xs text-slateink">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-forest" />
                  <span>Licensed technicians with certified equipment</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slateink">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-forest" />
                  <span>Digital inspection report logged to your account</span>
                </div>
              </div>

              <div className="my-5 border-t border-line" />

              <p className="heading text-sm text-ink">Ready to schedule?</p>
              <p className="mt-1 text-xs text-slateink">
                Book online now and our operations team will confirm your slot within one business day.
              </p>

              <Link
                to="/book-service"
                state={{
                  serviceId: service._id,
                  serviceType: service.slug,
                  serviceName: service.name
                }}
              >
                <Button fullWidth className="mt-4">
                  {ctaLabel}
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
