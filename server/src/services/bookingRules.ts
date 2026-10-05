import { Types } from 'mongoose';
import { ServiceBooking, ServiceStatus } from '../models/ServiceBooking';
import { Technician } from '../models/Technician';
import { ApiError } from '../utils/ApiError';

// ---------------------------------------------------------------------------------------------
// Time slots
// ---------------------------------------------------------------------------------------------

export const STANDARD_SLOTS = [
  { slot: '09:00 - 11:00', label: '09:00 AM – 11:00 AM (Morning)', period: 'Morning' },
  { slot: '11:00 - 13:00', label: '11:00 AM – 01:00 PM (Mid-day)', period: 'Morning' },
  { slot: '14:00 - 16:00', label: '02:00 PM – 04:00 PM (Afternoon)', period: 'Afternoon' },
  { slot: '16:00 - 18:00', label: '04:00 PM – 06:00 PM (Evening)', period: 'Evening' }
] as const;

export function isValidSlot(slot: unknown): slot is string {
  return typeof slot === 'string' && STANDARD_SLOTS.some((s) => s.slot === slot);
}

/** Minimum number of bookings a slot can hold, even with no technicians configured yet. */
export const MIN_SLOT_CAPACITY = 3;

/**
 * Start and end (inclusive) of the calendar day in UTC. Dates are compared in UTC everywhere so the result
 * does not change with the server's time zone.
 */
export function dayRangeUtc(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export function parseBookingDate(value: unknown): Date {
  const date = new Date(String(value));
  if (isNaN(date.getTime())) throw ApiError.badRequest('Invalid date');
  return date;
}

export function assertNotInPast(date: Date) {
  const todayStart = dayRangeUtc(new Date()).start;
  if (date.getTime() < todayStart.getTime()) {
    throw ApiError.badRequest('Please choose today or a future date');
  }
}

export async function slotCapacity(): Promise<{ capacity: number; activeTechnicians: number }> {
  const activeTechnicians = await Technician.countDocuments({ status: 'active' });
  return { capacity: Math.max(MIN_SLOT_CAPACITY, activeTechnicians), activeTechnicians };
}

export async function countBookedInSlot(date: Date, slot: string, excludeBookingId?: Types.ObjectId | string) {
  const { start, end } = dayRangeUtc(date);
  const filter: Record<string, unknown> = {
    preferredDate: { $gte: start, $lte: end },
    // Older bookings stored the slot only in preferredTime, so match either field.
    $or: [{ timeSlot: slot }, { preferredTime: slot }],
    status: { $nin: ['cancelled', 'rejected'] }
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };
  return ServiceBooking.countDocuments(filter);
}

/** Throws 409 if the slot is already full. Used by create AND reschedule so capacity is really enforced. */
export async function assertSlotHasRoom(date: Date, slot: string, excludeBookingId?: Types.ObjectId | string) {
  const [{ capacity }, booked] = await Promise.all([slotCapacity(), countBookedInSlot(date, slot, excludeBookingId)]);
  if (booked >= capacity) {
    throw new ApiError(409, 'That time slot is fully booked. Please choose another slot or date.');
  }
}

// ---------------------------------------------------------------------------------------------
// Status flow
// ---------------------------------------------------------------------------------------------

export const STATUS_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  requested: ['confirmed', 'assigned', 'cancelled', 'rejected'],
  confirmed: ['assigned', 'cancelled', 'rejected'],
  assigned: ['confirmed', 'technician_on_the_way', 'in_progress', 'cancelled'],
  technician_on_the_way: ['in_progress', 'assigned', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: []
};

export function canTransition(from: ServiceStatus, to: ServiceStatus): boolean {
  return from === to || STATUS_TRANSITIONS[from]?.includes(to) === true;
}

/** Statuses a technician may set on their own job. Completing goes through the report flow instead. */
export const TECHNICIAN_SETTABLE: ServiceStatus[] = ['technician_on_the_way', 'in_progress'];

export const OPEN_STATUSES: ServiceStatus[] = ['requested', 'confirmed', 'assigned', 'technician_on_the_way', 'in_progress'];

// ---------------------------------------------------------------------------------------------
// Service type -> equipment history
// ---------------------------------------------------------------------------------------------

export type EquipmentHistoryType = 'installation' | 'inspection' | 'refilling' | 'repair' | 'maintenance';

/**
 * Catalog service types are dynamic slugs ("fire-safety-audit", "amc", anything an admin adds), so the
 * equipment history type is derived by keyword instead of an exact-match list. Unknown services are logged
 * as 'maintenance'.
 */
export function historyTypeFor(serviceType: string): EquipmentHistoryType {
  const t = String(serviceType || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (t.includes('install')) return 'installation';
  if (t.includes('refill')) return 'refilling';
  if (t.includes('repair')) return 'repair';
  if (t.includes('inspect') || t.includes('audit') || t.includes('amc')) return 'inspection';
  return 'maintenance';
}

export const INSPECTION_INTERVAL_DAYS = 180;
export const REFILL_INTERVAL_DAYS = 365;

/** Which equipment due-dates a completed job should move forward. */
export function dueDateUpdateFor(type: EquipmentHistoryType): { inspection: boolean; refill: boolean } {
  return {
    inspection: type === 'installation' || type === 'inspection' || type === 'maintenance',
    refill: type === 'refilling'
  };
}

export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value) && value.length <= 2048;
}

export function cleanUrlList(value: unknown, max = 10): string[] {
  if (!Array.isArray(value)) return [];
  const urls = value.filter(isHttpUrl).slice(0, max);
  return urls;
}

/** Signature pad output: a small PNG/JPEG data URL. */
export function isSignatureDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 300_000;
}
