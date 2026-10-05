import { Types } from 'mongoose';
import { Service } from '../src/models/Service';
import { Technician } from '../src/models/Technician';
import { CustomerEquipment } from '../src/models/CustomerEquipment';
import { ServiceBooking } from '../src/models/ServiceBooking';
import { createTestUser } from './setup';

/** YYYY-MM-DD for today + n days (UTC). Dates are computed, never hard-coded, so tests do not rot. */
export function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export const SLOT = '11:00 - 13:00';

let counter = 0;
const unique = () => `${Date.now()}${++counter}`;

export async function makeService(overrides: Record<string, unknown> = {}) {
  const n = unique();
  return Service.create({
    name: `Test Service ${n}`,
    slug: `test-service-${n}`,
    description: 'Service used by the automated tests',
    startingPrice: 1000,
    priceUnit: '/visit',
    currency: 'INR',
    category: 'testing',
    isActive: true,
    isPublished: true,
    ...overrides
  });
}

/** A technician account (login user + technician profile). */
export async function makeTechnician(label = 'tech') {
  const { user, token } = await createTestUser('technician');
  const technician = await Technician.create({
    user: user._id,
    name: `Technician ${label}`,
    phone: '+919811100000',
    employeeId: `EMP-${unique()}`,
    status: 'active'
  });
  return { user, token, technician };
}

export async function makeEquipment(ownerId: Types.ObjectId | string, overrides: Record<string, unknown> = {}) {
  return CustomerEquipment.create({
    user: ownerId,
    productNameSnapshot: 'ABC Powder 4kg',
    serialNumber: `SN-${unique()}`,
    capacity: '4 kg',
    fireClass: ['A', 'B', 'C'],
    installationLocation: 'Warehouse B, 12 Private Road',
    notes: 'Gate code 4455',
    ...overrides
  });
}

/** A booking inserted directly (fast), assigned to a technician. */
export async function makeBooking(opts: {
  customerId: Types.ObjectId | string;
  serviceId: Types.ObjectId | string;
  serviceType: string;
  technicianId?: Types.ObjectId | string | null;
  equipmentId?: Types.ObjectId | string | null;
  status?: string;
  daysFromNow?: number;
  slot?: string;
}) {
  const date = new Date(`${isoDay(opts.daysFromNow ?? 3)}T00:00:00.000Z`);
  return ServiceBooking.create({
    bookingNumber: `SRV-T-${unique()}`,
    user: opts.customerId,
    service: opts.serviceId,
    serviceType: opts.serviceType,
    phone: '+919876543210',
    address: '1 Test Street',
    preferredDate: date,
    preferredTime: opts.slot ?? SLOT,
    timeSlot: opts.slot ?? SLOT,
    assignedTechnician: opts.technicianId ?? null,
    equipment: opts.equipmentId ?? null,
    status: opts.status ?? 'requested',
    timeline: [{ at: new Date(), by: 'system', action: opts.status ?? 'requested' }]
  });
}
