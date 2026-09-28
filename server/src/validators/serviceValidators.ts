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
    serviceId: z.string().optional(),
    serviceType: z.enum(['installation', 'inspection', 'refilling', 'repair', 'fire_safety_audit', 'amc_visit']).optional(),
    phone: z.string().min(10),
    address: z.string().min(3),
    preferredDate: z.string().min(4),
    preferredTime: z.string().optional(),
    equipmentId: z.string().optional(),
    problemDescription: z.string().optional(),
    additionalNotes: z.string().optional()
  }).refine((data) => data.serviceId || data.serviceType, {
    message: 'Either serviceId or serviceType must be provided'
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

const serviceImageSchema = z.union([
  z.string(),
  z.object({
    url: z.string().url(),
    publicId: z.string().optional(),
    alt: z.string().optional()
  })
]);

export const createServiceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Service name must be at least 2 characters'),
    slug: z.string().optional(),
    shortDescription: z.string().optional(),
    description: z.string().min(5, 'Service description must be at least 5 characters'),
    startingPrice: z.number().nonnegative('Starting price must be 0 or positive'),
    priceUnit: z.string().optional(),
    currency: z.string().optional(),
    category: z.string().optional(),
    image: serviceImageSchema.optional(),
    gallery: z.array(serviceImageSchema).optional(),
    features: z.array(z.string()).optional(),
    inclusions: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    estimatedDuration: z.string().optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const updateServiceSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().optional(),
    shortDescription: z.string().optional(),
    description: z.string().min(5).optional(),
    startingPrice: z.number().nonnegative().optional(),
    priceUnit: z.string().optional(),
    currency: z.string().optional(),
    category: z.string().optional(),
    image: serviceImageSchema.optional().nullable(),
    gallery: z.array(serviceImageSchema).optional(),
    features: z.array(z.string()).optional(),
    inclusions: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    estimatedDuration: z.string().optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const updateServiceStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isFeatured: z.boolean().optional()
  }).refine((data) => data.isActive !== undefined || data.isPublished !== undefined || data.isFeatured !== undefined, {
    message: 'At least one of isActive, isPublished, or isFeatured must be provided'
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const reorderServicesSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        displayOrder: z.number().int()
      })
    ).min(1, 'At least one item must be provided for reordering')
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

