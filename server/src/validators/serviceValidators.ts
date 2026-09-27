import { z } from 'zod';

export const createEquipmentSchema = z.object({
  body: z.object({
    productId: z.string().optional(),
    productNameSnapshot: z.string().min(2),
    serialNumber: z.string().min(2),
    purchaseDate: z.string().optional(),
    installationDate: z.string().optional(),
    installationLocation: z.string().optional(),
    lastInspectionDate: z.string().optional(),
    lastRefillDate: z.string().optional(),
    nextInspectionDate: z.string().optional(),
    nextRefillDate: z.string().optional(),
    notes: z.string().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const createServiceBookingSchema = z.object({
  body: z.object({
    serviceType: z.enum(['installation', 'inspection', 'refilling', 'repair', 'fire_safety_audit', 'amc_visit']),
    phone: z.string().min(10),
    address: z.string().min(3),
    preferredDate: z.string().min(4),
    preferredTime: z.string().optional(),
    equipmentId: z.string().optional(),
    problemDescription: z.string().optional(),
    additionalNotes: z.string().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const createAmcContractSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    planName: z.string().min(2),
    equipmentIds: z.array(z.string()).optional(),
    startDate: z.string(),
    endDate: z.string(),
    amount: z.number().nonnegative()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});
