import { useParams, Link, Navigate } from 'react-router-dom';
import { Wrench, RefreshCw, ClipboardCheck, ShieldCheck, ClipboardList, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Primitives';

const content: Record<string, {
  icon: typeof Wrench; title: string; tagline: string; description: string; bullets: string[]; bookServiceType?: string; ctaTo: string; ctaLabel: string;
}> = {
  installation: {
    icon: Wrench, title: 'Installation', tagline: 'Get equipment fitted correctly the first time.',
    description: 'Our technicians install fire extinguishers, hydrant systems, alarm panels and suppression systems to spec, and register each unit against your account for tracking.',
    bullets: ['Certified installation technicians', 'Equipment auto-registered to My Equipment', 'Installation photos attached to your record'],
    bookServiceType: 'installation', ctaTo: '/book-service', ctaLabel: 'Book installation'
  },
  refilling: {
    icon: RefreshCw, title: 'Refilling', tagline: 'Never run out of charge on a live extinguisher.',
    description: 'Scheduled refilling for extinguishers and gas cylinders. Once registered, we track due dates and send reminders 30, 15, 7 and 1 day before — and on the due date itself.',
    bullets: ['Automatic refill reminders', 'On-site or pickup refilling', 'Refill history logged per unit'],
    bookServiceType: 'refilling', ctaTo: '/book-service', ctaLabel: 'Book a refill'
  },
  inspection: {
    icon: ClipboardCheck, title: 'Inspection', tagline: 'Routine checks, logged and traceable.',
    description: 'Periodic inspections confirm your equipment is charged, accessible and compliant — with every visit recorded against the specific unit inspected.',
    bullets: ['Inspection reminders before due dates', 'Digital inspection report', 'Full inspection history per asset'],
    bookServiceType: 'inspection', ctaTo: '/book-service', ctaLabel: 'Book an inspection'
  },
  'fire-safety-audit': {
    icon: ClipboardList, title: 'Fire Safety Audit', tagline: 'A full-site review of your fire safety readiness.',
    description: 'A comprehensive audit of your building — extinguisher coverage, exits, signage, alarm systems and general compliance gaps — with a written report and recommendations.',
    bullets: ['Covers offices, factories, warehouses, schools and hospitals', 'Detailed written report', 'Recommendations prioritized by risk'],
    bookServiceType: 'fire_safety_audit', ctaTo: '/book-service', ctaLabel: 'Request an audit'
  },
  amc: {
    icon: ShieldCheck, title: 'AMC Plans', tagline: 'Annual maintenance, without the manual tracking.',
    description: 'An Annual Maintenance Contract covers scheduled visits for your registered equipment across the year, with renewal reminders so cover never lapses unnoticed.',
    bullets: ['Scheduled visits across the year', 'Renewal reminders before expiry', 'Full visit and service history'],
    ctaTo: '/account/quotes', ctaLabel: 'Request an AMC plan'
  }
};

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const data = slug ? content[slug] : undefined;
  if (!data) return <Navigate to="/services" replace />;

  return (
    <div>
      <section className="bg-ink py-16 text-white">
        <div className="container-page">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-brand"><data.icon className="h-5 w-5 text-white" /></div>
          <h1 className="heading mt-4 text-3xl">{data.title}</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">{data.tagline}</p>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <p className="text-sm leading-relaxed text-slateink">{data.description}</p>
            <ul className="mt-6 flex flex-col gap-3">
              {data.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-ink"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" /> {b}</li>
              ))}
            </ul>
          </div>
          <Card className="h-fit p-6">
            <p className="heading text-sm text-ink">Ready to get started?</p>
            <p className="mt-1.5 text-xs text-slateink">Book online and our team will confirm a slot within one business day.</p>
            <Link to={data.ctaTo} state={data.bookServiceType ? { serviceType: data.bookServiceType } : undefined}>
              <Button fullWidth className="mt-4">{data.ctaLabel}</Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
