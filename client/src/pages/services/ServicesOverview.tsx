import { Link } from 'react-router-dom';
import { Wrench, RefreshCw, ClipboardCheck, ShieldCheck, ClipboardList, ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';

const services = [
  { icon: Wrench, title: 'Installation', description: 'Professional fitting of extinguishers, hydrant systems, alarm panels and suppression systems.', to: '/services/installation' },
  { icon: RefreshCw, title: 'Refilling', description: 'Scheduled refills for extinguishers and gas cylinders, with reminders before they run out.', to: '/services/refilling' },
  { icon: ClipboardCheck, title: 'Inspection', description: 'Routine inspections logged against your registered equipment, on a schedule you can rely on.', to: '/services/inspection' },
  { icon: ClipboardList, title: 'Fire Safety Audit', description: 'A full-site audit covering equipment, exits, signage and compliance gaps.', to: '/services/fire-safety-audit' },
  { icon: ShieldCheck, title: 'AMC Plans', description: 'Annual maintenance contracts with scheduled visits, renewal reminders and full visit history.', to: '/services/amc' }
];

export default function ServicesOverview() {
  return (
    <div>
      <section className="bg-ink py-16 text-white">
        <div className="container-page">
          <h1 className="heading text-3xl">Fire safety services</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">Installation, refilling, inspection, audits and AMC — booked online, carried out by trained technicians, and logged against your equipment.</p>
          <Link to="/book-service"><Button size="lg" className="mt-6">Book a service <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="h-full p-6 hover:shadow-lift">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-light"><s.icon className="h-5 w-5 text-brand" /></div>
                <p className="heading mt-4 text-base text-ink">{s.title}</p>
                <p className="mt-1.5 text-sm text-slateink">{s.description}</p>
                <span className="mt-3 inline-block text-sm font-medium text-brand">Learn more →</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
