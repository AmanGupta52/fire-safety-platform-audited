import { z } from 'zod';

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const updateCartItemSchema = z.object({
  body: z.object({ quantity: z.number().int().positive() }),
  query: z.any().optional(),
  params: z.object({ productId: z.string().min(1) })
});

export const addressSchema = z.object({
  contactName: z.string().min(2),
  phone: z.string().min(10),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().min(4),
  country: z.string().optional()
});

export const checkoutSchema = z.object({
  body: z.object({
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    companyName: z.string().optional(),
    gstNumber: z.string().optional(),
    couponCode: z.string().optional(),
    paymentMethod: z.enum(['mock', 'cod', 'razorpay'])
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const createQuoteSchema = z.object({
  body: z.object({
    customerName: z.string().min(2),
    companyName: z.string().optional(),
    phone: z.string().min(10),
    email: z.string().email(),
    gstNumber: z.string().optional(),
    address: z.string().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().positive()
        })
      )
      .min(1),
    requirements: z.string().optional(),
    preferredDate: z.string().optional(),
    additionalNotes: z.string().optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});
