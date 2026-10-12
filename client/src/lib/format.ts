// Shared money and date formatting. Money is always Indian-grouped (en-IN); dates and times are always shown
// in India Standard Time, whatever time zone the visitor's device is set to, so a booking made at 11 pm IST never
// shows up as "tomorrow" for someone travelling.

const IST = 'Asia/Kolkata';

/** ₹1,23,456 (or ₹1,23,456.5): no forced decimals, at most two. */
export function formatInr(amount: number | null | undefined, maximumFractionDigits = 2): string {
  return `₹${(amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits })}`;
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dateFormats = {
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/** "9 Oct 2026" (short), "9 Oct" (dayMonth), "9 October 2026" (long), "Friday, 9 October 2026" (full). Empty/invalid input gives "—". */
export function formatDate(value: DateInput, style: keyof typeof dateFormats = 'short'): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { ...dateFormats[style], timeZone: IST }).format(date);
}

/** "9 Oct 2026, 7:05 pm" */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST
  }).format(date);
}

/** Today's date in IST as yyyy-mm-dd, for <input type="date" min=...>. */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: IST }).format(new Date());
}

/** The IST calendar date `days` from today (1 = tomorrow) as yyyy-mm-dd. */
export function addDaysIST(days: number): string {
  const base = new Date(`${todayIST()}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
