import { Service } from '../models/Service';
import { ServiceBooking } from '../models/ServiceBooking';

export const INITIAL_SERVICES = [
  {
    name: 'Installation',
    slug: 'installation',
    startingPrice: 299,
    priceUnit: '/unit',
    currency: 'INR',
    description: 'Professional fitting of extinguishers, hydrant systems, alarm panels and suppression systems.',
    shortDescription: 'Professional fitting for extinguishers, hydrants and alarm systems.',
    category: 'installation',
    features: [
      'Certified installation technicians',
      'Equipment auto-registered to My Equipment',
      'Installation photos attached to your record'
    ],
    inclusions: [
      'Site survey and equipment placement',
      'Standard mounting hardware and brackets',
      'Post-installation test verification'
    ],
    exclusions: ['Structural masonry modifications', 'Major electrical rewiring outside scope'],
    estimatedDuration: '2-4 hours',
    displayOrder: 1,
    isActive: true,
    isPublished: true,
    isFeatured: true
  },
  {
    name: 'Refilling',
    slug: 'refilling',
    startingPrice: 349,
    priceUnit: '/unit',
    currency: 'INR',
    description: 'Scheduled refills for extinguishers and gas cylinders, with reminders before they run out.',
    shortDescription: 'Scheduled refills with reminders before your extinguisher runs out.',
    category: 'refilling',
    features: [
      'Automatic refill reminders',
      'On-site or pickup refilling',
      'Refill history logged per unit'
    ],
    inclusions: [
      'Discharge test and internal cylinder inspection',
      'Refill with genuine extinguishing agent to ISI specs',
      'Pressure gauge check and new tamper seal with compliance tag'
    ],
    exclusions: ['Hydraulic pressure testing if cylinder is beyond hydrostatic test date'],
    estimatedDuration: '1-2 hours',
    displayOrder: 2,
    isActive: true,
    isPublished: true,
    isFeatured: true
  },
  {
    name: 'Inspection',
    slug: 'inspection',
    startingPrice: 249,
    priceUnit: '/visit',
    currency: 'INR',
    description: 'Routine inspections logged against your registered equipment, on a schedule you can rely on.',
    shortDescription: 'Routine inspections logged against every registered asset.',
    category: 'inspection',
    features: [
      'Inspection reminders before due dates',
      'Digital inspection report',
      'Full inspection history per asset'
    ],
    inclusions: [
      'Physical inspection of pressure, seals, nozzles and mounting',
      'Digital checklist logged in your account portal',
      'Recommendation report for any damaged or overdue assets'
    ],
    exclusions: ['Parts replacement or on-the-spot cylinder refilling (quoted separately)'],
    estimatedDuration: '1 hour',
    displayOrder: 3,
    isActive: true,
    isPublished: true,
    isFeatured: true
  },
  {
    name: 'Fire Safety Audit',
    slug: 'fire-safety-audit',
    startingPrice: 4999,
    priceUnit: '',
    currency: 'INR',
    description: 'A full-site audit covering equipment, exits, signage and compliance gaps.',
    shortDescription: 'A full-site audit covering equipment, exits, signage and compliance gaps.',
    category: 'audit',
    features: [
      'Covers offices, factories, warehouses, schools and hospitals',
      'Detailed written report',
      'Recommendations prioritized by risk'
    ],
    inclusions: [
      'Complete facility walkthrough by certified safety auditor',
      'Evaluation of exits, emergency routes, alarms, hydrants and extinguisher placement',
      'Comprehensive compliance report with action checklist'
    ],
    exclusions: ['Government authority certification fees'],
    estimatedDuration: '1-2 days',
    displayOrder: 4,
    isActive: true,
    isPublished: true,
    isFeatured: true
  },
  {
    name: 'AMC Plans',
    slug: 'amc',
    startingPrice: 999,
    priceUnit: '/unit/yr',
    currency: 'INR',
    description: 'Annual maintenance contracts with scheduled visits, renewal reminders and full visit history.',
    shortDescription: 'Annual maintenance contracts with scheduled visits, renewal reminders and full visit history.',
    category: 'maintenance',
    features: [
      'Scheduled visits across the year',
      'Renewal reminders before expiry',
      'Full visit and service history'
    ],
    inclusions: [
      'Quarterly routine maintenance visits',
      'Free minor breakdown visits within 24 hours',
      'Equipment register and digital logbook management'
    ],
    exclusions: ['Consumables and extinguishing agent refills during unscheduled emergencies'],
    estimatedDuration: 'Annual',
    displayOrder: 5,
    isActive: true,
    isPublished: true,
    isFeatured: true
  }
];

/**
 * Idempotently seeds initial catalog services if they do not exist.
 * Preserves existing records and administrator edits.
 */
export async function seedServicesIfEmpty(): Promise<void> {
  for (const def of INITIAL_SERVICES) {
    const existing = await Service.findOne({ slug: def.slug });
    if (!existing) {
      await Service.create(def);
      console.log(`[seed] Service created: ${def.name} (${def.slug})`);
    }
  }
}

/**
 * Safe, non-destructive migration backfill: links historical ServiceBooking records
 * that only have serviceType to the corresponding Service catalog ObjectId.
 */
export async function backfillServiceBookings(): Promise<void> {
  const unlinkedBookings = await ServiceBooking.find({
    $or: [{ service: null }, { service: { $exists: false } }]
  });

  if (unlinkedBookings.length === 0) return;

  const typeToSlug: Record<string, string> = {
    installation: 'installation',
    inspection: 'inspection',
    refilling: 'refilling',
    fire_safety_audit: 'fire-safety-audit',
    amc_visit: 'amc'
  };

  let linkedCount = 0;
  for (const booking of unlinkedBookings) {
    const targetSlug = typeToSlug[booking.serviceType];
    if (targetSlug) {
      const service = await Service.findOne({ slug: targetSlug });
      if (service) {
        booking.service = service._id;
        await booking.save();
        linkedCount++;
      }
    }
  }

  if (linkedCount > 0) {
    console.log(`[migration] Backfilled ${linkedCount} historical bookings with Service catalog references.`);
  }
}
