import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    sku: z.string().min(2),
    category: z.string().min(1),
    subcategory: z.string().optional(),
    brand: z.string().optional(),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    price: z.number().nonnegative(),
    discountPrice: z.number().nonnegative().optional(),
    gstPercentage: z.number().min(0).max(100).optional(),
    stock: z.number().int().nonnegative(),
    minimumOrderQuantity: z.number().int().positive().optional(),
    allowBackorder: z.boolean().optional(),
    unit: z.string().optional(),
    capacity: z.string().optional(),
    weight: z.string().optional(),
    fireClass: z.array(z.string()).optional(),
    modelNumber: z.string().optional(),
    specifications: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
    features: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    images: z.array(z.object({ url: z.string(), publicId: z.string().optional(), alt: z.string().optional() })).optional(),
    datasheetUrl: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isBestSeller: z.boolean().optional(),
    isActive: z.boolean().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const updateProductSchema = z.object({
  body: createProductSchema.shape.body.partial(),
  query: z.any().optional(),
  params: z.any().optional()
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    image: z.string().optional(),
    parent: z.string().optional(),
    sortOrder: z.number().optional(),
    isActive: z.boolean().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});
