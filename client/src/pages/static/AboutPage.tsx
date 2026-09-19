import { ShieldCheck, Users, Award, Clock } from 'lucide-react';
import { Card } from '../../components/ui/Primitives';

export default function AboutPage() {
  return (
    <div>
      <section className="bg-ink py-16 text-white">
        <div className="container-page max-w-2xl">
          <h1 className="heading text-3xl">About Fire Safety Platform</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            We supply, install and maintain fire safety equipment for homes, offices, factories and public
            buildings across India — combining a straightforward online store with a service team that
            actually shows up and logs the work.
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Users} value="500+" label="Sites served" />
          <Stat icon={Award} value="10+ yrs" label="In fire safety" />
          <Stat icon={Clock} value="24-48h" label="Typical response time" />
          <Stat icon={ShieldCheck} value="100%" label="Technician-logged visits" />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="heading text-lg text-ink">What we do</h2>
            <p className="mt-2 text-sm leading-relaxed text-slateink">
              From a single extinguisher for a shop to a full alarm and suppression system for a factory, we
              handle sourcing, installation and ongoing maintenance — with every visit and every piece of
              equipment tracked against your account.
            </p>
          </div>
          <div>
            <h2 className="heading text-lg text-ink">Why it matters</h2>
            <p className="mt-2 text-sm leading-relaxed text-slateink">
              Fire safety equipment only works if it's maintained. Our reminder system flags refills and
              inspections before they're overdue, and our AMC plans keep annual maintenance on a predictable
              schedule instead of a forgotten spreadsheet.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <Icon className="h-5 w-5 text-brand" />
      <p className="heading text-xl text-ink">{value}</p>
      <p className="text-xs text-slateink">{label}</p>
    </Card>
  );
}
