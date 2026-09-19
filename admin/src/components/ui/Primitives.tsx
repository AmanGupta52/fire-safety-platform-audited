import clsx from 'clsx';
import { LucideIcon } from 'lucide-react';

// ---------- Badge ----------
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-paper text-slateink border-line',
  success: 'bg-forest-light text-forest border-forest/20',
  warning: 'bg-amber-light text-amber border-amber/30',
  danger: 'bg-brand-light text-brand-dark border-brand/20',
  info: 'bg-ink/5 text-ink border-ink/10'
};
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium', badgeTones[tone])}>
      {children}
    </span>
  );
}

// ---------- Card ----------
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('rounded-md border border-line bg-card shadow-card', className)}>{children}</div>;
}

// ---------- StatCard ----------
export function StatCard({
  label, value, icon: Icon, accent = 'ink', suffix
}: { label: string; value: string | number; icon: LucideIcon; accent?: 'ink' | 'brand' | 'amber' | 'forest'; suffix?: string }) {
  const accentColors: Record<string, string> = {
    ink: 'text-ink bg-ink/5', brand: 'text-brand bg-brand-light', amber: 'text-amber bg-amber-light', forest: 'text-forest bg-forest-light'
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slateink">{label}</p>
          <p className="stat-number mt-2 text-2xl text-ink">
            {value}
            {suffix && <span className="ml-1 text-sm font-normal text-slateink">{suffix}</span>}
          </p>
        </div>
        <div className={clsx('rounded p-2', accentColors[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

// ---------- EmptyState ----------
export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-full bg-paper p-3">
        <Icon className="h-5 w-5 text-slateink" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs text-slateink">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- Spinner ----------
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-16', className)}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" />
    </div>
  );
}
