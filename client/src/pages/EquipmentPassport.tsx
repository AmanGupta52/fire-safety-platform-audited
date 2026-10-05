import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Flame, ShieldCheck, AlertTriangle, AlertOctagon, Calendar, MapPin,
  Clock, Printer, CheckCircle2, History, Wrench, ArrowRight
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { api, apiErrorMessage } from '../lib/apiClient';
import { Card, Badge, Spinner } from '../components/ui/Primitives';
import { Button } from '../components/ui/Button';

interface EquipmentHistory {
  _id?: string;
  date: string;
  type: string;
  technicianName?: string;
  pressureReading?: string;
  physicalCondition?: string;
  sealIntact?: boolean;
  notes?: string;
  reportUrl?: string;
}

interface EquipmentPassportData {
  _id: string;
  productNameSnapshot: string;
  serialNumber: string;
  capacity?: string;
  fireClass?: string[];
  installationLocation?: string;
  purchaseDate?: string;
  installationDate?: string;
  lastInspectionDate?: string;
  lastRefillDate?: string;
  nextInspectionDate?: string;
  nextRefillDate?: string;
  qrCode?: string;
  serviceHistory: EquipmentHistory[];
  status: 'healthy' | 'inspection_due_soon' | 'refill_due_soon' | 'overdue';
  user?: {
    name?: string;
    companyName?: string;
    phone?: string;
  };
}

export default function EquipmentPassport() {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: equipment, isLoading, error } = useQuery({
    queryKey: ['equipment-passport', identifier],
    queryFn: async () =>
      (await api.get(`/equipment/passport/${identifier}`)).data.data as EquipmentPassportData,
    enabled: Boolean(identifier)
  });

  if (isLoading) {
    return (
      <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <h1 className="heading text-xl text-ink">Equipment Passport Not Found</h1>
        <p className="mt-2 text-sm text-slateink max-w-md">
          {error ? apiErrorMessage(error) : `No active fire extinguisher or safety asset found for '${identifier}'.`}
        </p>
        <Link to="/" className="mt-6 text-sm font-medium text-safety hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  const statusConfig = {
    healthy: {
      label: 'Operational & Certified',
      tone: 'success' as const,
      icon: ShieldCheck,
      desc: 'All inspection and pressure tests are up-to-date and compliant with IS 2190 standards.'
    },
    inspection_due_soon: {
      label: 'Routine Inspection Due Soon',
      tone: 'warning' as const,
      icon: AlertTriangle,
      desc: 'Scheduled monthly/quarterly maintenance inspection is due in less than 15 days.'
    },
    refill_due_soon: {
      label: 'Refill Due Soon',
      tone: 'warning' as const,
      icon: Clock,
      desc: 'Chemical agent discharge / refill validity expires within 15 days.'
    },
    overdue: {
      label: 'Service Overdue — Action Required',
      tone: 'danger' as const,
      icon: AlertOctagon,
      desc: 'Safety inspection or chemical refill deadline has passed. Immediate service required.'
    }
  }[equipment.status] || {
    label: 'Operational',
    tone: 'neutral' as const,
    icon: ShieldCheck,
    desc: 'Registered equipment status.'
  };

  const StatusIcon = statusConfig.icon;

  const nextDueDate = equipment.nextRefillDate || equipment.nextInspectionDate;
  const daysUntilDue = nextDueDate ? differenceInDays(new Date(nextDueDate), new Date()) : null;

  function handlePrintTag() {
    window.print();
  }

  return (
    <div className="container-page max-w-4xl py-8 print:p-0">
      {/* Top Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 print:hidden">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-safety flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5" /> Digital Fire Safety Passport
          </span>
          <h1 className="heading mt-1 text-2xl text-ink">
            {equipment.productNameSnapshot}
          </h1>
          <p className="text-xs text-slateink font-mono mt-0.5">
            Serial No: <b className="text-ink font-semibold">{equipment.serialNumber}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrintTag}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print Asset Tag
          </Button>
          <Link to="/book-service" state={{ equipmentId: equipment._id, serviceName: equipment.productNameSnapshot }}>
            <Button size="sm">
              <Wrench className="h-3.5 w-3.5 mr-1" /> Book Service <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left Column: QR Sticker & Asset Identity */}
        <div className="md:col-span-1 space-y-4">
          <Card className="p-5 text-center bg-white shadow-card border-2 border-line">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-safety-light text-safety mb-2">
              <Flame className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">Asset QR Sticker</p>
            <p className="text-[10px] text-slateink mb-3">Scan with any mobile camera to view passport</p>

            {equipment.qrCode ? (
              <div className="mx-auto p-2 bg-white rounded border border-line inline-block shadow-sm">
                <img
                  src={equipment.qrCode}
                  alt={`QR Code for ${equipment.serialNumber}`}
                  className="w-44 h-44 object-contain"
                />
              </div>
            ) : (
              <div className="h-44 w-44 mx-auto flex items-center justify-center bg-paper rounded text-xs text-slateink">
                Generating QR...
              </div>
            )}

            <div className="mt-3 rounded bg-paper p-2 font-mono text-[11px] text-ink font-semibold break-all">
              {equipment.serialNumber}
            </div>
          </Card>

          {/* Quick Specs */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider border-b border-line pb-2">
              Technical Specifications
            </h3>
            <div className="flex justify-between text-xs">
              <span className="text-slateink">Agent Capacity</span>
              <span className="font-semibold text-ink">{equipment.capacity || '6 kg'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slateink">Fire Rating</span>
              <div className="flex gap-1">
                {(equipment.fireClass || ['A', 'B', 'C']).map((c) => (
                  <span key={c} className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink border border-line">
                    Class {c}
                  </span>
                ))}
              </div>
            </div>
            {equipment.installationLocation && (
              <div className="flex items-start justify-between text-xs pt-1 border-t border-line">
                <span className="text-slateink flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</span>
                <span className="font-medium text-ink text-right max-w-[140px]">{equipment.installationLocation}</span>
              </div>
            )}
            {equipment.user?.companyName && (
              <div className="flex justify-between text-xs pt-1 border-t border-line">
                <span className="text-slateink">Facility</span>
                <span className="font-medium text-ink">{equipment.user.companyName}</span>
              </div>
            )}
          </Card>
        </div>

        {/* Right Columns: Live Status & Inspection Timeline */}
        <div className="md:col-span-2 space-y-6">
          {/* Status Alert Card */}
          <div className="rounded-card border border-line p-5 shadow-card bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                  <Badge tone={statusConfig.tone}>
                    <span className="flex items-center gap-1.5">
                      <StatusIcon className="h-3.5 w-3.5" /> {statusConfig.label}
                    </span>
                  </Badge>
              </div>
              {daysUntilDue !== null && (
                <div className="text-right">
                  <p className="text-[11px] text-slateink uppercase tracking-wider font-semibold">Service Due</p>
                  <p className={`text-sm font-bold ${daysUntilDue < 0 ? 'text-rose-600' : 'text-ink'}`}>
                    {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `In ${daysUntilDue} days`}
                  </p>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-slateink leading-relaxed">
              {statusConfig.desc}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] text-slateink uppercase font-semibold">Last Refill</p>
                <p className="text-xs font-semibold text-ink mt-0.5">
                  {equipment.lastRefillDate ? format(new Date(equipment.lastRefillDate), 'd MMM yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slateink uppercase font-semibold">Last Inspection</p>
                <p className="text-xs font-semibold text-ink mt-0.5">
                  {equipment.lastInspectionDate ? format(new Date(equipment.lastInspectionDate), 'd MMM yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slateink uppercase font-semibold">Next Inspection</p>
                <p className="text-xs font-semibold text-ink mt-0.5">
                  {equipment.nextInspectionDate ? format(new Date(equipment.nextInspectionDate), 'd MMM yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slateink uppercase font-semibold">Next Refill Due</p>
                <p className="text-xs font-semibold text-safety mt-0.5">
                  {equipment.nextRefillDate ? format(new Date(equipment.nextRefillDate), 'd MMM yyyy') : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Complete Maintenance & Inspection Timeline */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <h2 className="heading text-sm text-ink flex items-center gap-1.5">
                <History className="h-4 w-4 text-safety" /> Service, Inspection & Refill History
              </h2>
              <span className="text-xs text-slateink">
                {equipment.serviceHistory?.length || 0} recorded event(s)
              </span>
            </div>

            {!equipment.serviceHistory || equipment.serviceHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slateink">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500/60 mb-2" />
                <p className="font-semibold text-ink">Initial Commissioning Log</p>
                <p className="mt-1">
                  Commissioned and inspected upon deployment. Future technician services and inspection logs will appear here.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
                {equipment.serviceHistory.map((item, idx) => (
                  <div key={item._id || idx} className="relative">
                    <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-safety text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>

                    <div className="rounded border border-line bg-paper/50 p-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-ink uppercase tracking-wide">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slateink flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {format(new Date(item.date), 'PP')}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slateink">
                        {item.technicianName && (
                          <div>
                            <span className="text-slateink">Inspector: </span>
                            <span className="font-medium text-ink">{item.technicianName}</span>
                          </div>
                        )}
                        {item.pressureReading && (
                          <div>
                            <span className="text-slateink">Pressure: </span>
                            <span className="font-semibold text-emerald-700">{item.pressureReading}</span>
                          </div>
                        )}
                        {item.sealIntact !== undefined && (
                          <div>
                            <span className="text-slateink">Safety Seal: </span>
                            <span className={item.sealIntact ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                              {item.sealIntact ? 'Intact' : 'Broken / Replaced'}
                            </span>
                          </div>
                        )}
                      </div>

                      {item.notes && (
                        <p className="mt-2 text-slateink bg-white/70 p-2 rounded border border-line">
                          {item.notes}
                        </p>
                      )}

                      {item.reportUrl && (
                        <div className="mt-2 text-right">
                          <a
                            href={item.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-safety hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            View Signed Inspection Report (PDF) →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
