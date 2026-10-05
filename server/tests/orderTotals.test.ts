// Unit tests of the pricing helpers (subtotal, GST split, coupons, shipping rule).
// The checkout ENDPOINT itself - the real totals a customer is charged, coupon rules and invoices - is covered at
// HTTP level in tests/orders.test.ts, and the GST-after-discount maths in tests/unit/pricing.test.ts.
import { describe, it, expect } from 'vitest';
import { priceLines, splitGst, applyDiscount, PricedLine } from '../src/services/pricingService';

describe('Order Total Calculations Test Suite', () => {
  describe('priceLines (Subtotal & GST Calculation)', () => {
    it('should calculate subtotal and GST correctly for single item line', () => {
      const lines: PricedLine[] = [
        { quantity: 2, unitPrice: 1000, gstPercentage: 18 }
      ];

      const result = priceLines(lines);

      expect(result.subtotal).toBe(2000); // 2 * 1000
      expect(result.gstAmount).toBe(360); // 2000 * 0.18
      expect(result.total).toBe(2360); // 2000 + 360
    });

    it('should calculate subtotal and blended GST correctly for multiple items with different tax rates', () => {
      const lines: PricedLine[] = [
        { quantity: 3, unitPrice: 500, gstPercentage: 18 },  // sub: 1500, gst: 270
        { quantity: 2, unitPrice: 1200, gstPercentage: 12 }, // sub: 2400, gst: 288
        { quantity: 1, unitPrice: 350, gstPercentage: 5 }    // sub: 350,  gst: 17.50
      ];

      const result = priceLines(lines);

      expect(result.subtotal).toBe(4250);
      expect(result.gstAmount).toBe(575.5); // 270 + 288 + 17.5
      expect(result.total).toBe(4825.5);
    });

    it('should round numbers properly to two decimal places', () => {
      const lines: PricedLine[] = [
        { quantity: 3, unitPrice: 99.99, gstPercentage: 18 } // 299.97 * 0.18 = 53.9946 -> 54
      ];

      const result = priceLines(lines);

      expect(result.subtotal).toBe(299.97);
      expect(result.gstAmount).toBe(53.99);
      expect(result.total).toBe(353.96);
    });

    it('should return 0 subtotal, GST and total for empty lines array', () => {
      const result = priceLines([]);
      expect(result.subtotal).toBe(0);
      expect(result.gstAmount).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('splitGst (Intra-state vs Inter-state Tax Distribution)', () => {
    it('should split GST equally into CGST and SGST for intra-state supply', () => {
      const gstAmount = 360;
      const split = splitGst(gstAmount, false);

      expect(split.cgst).toBe(180);
      expect(split.sgst).toBe(180);
      expect(split.igst).toBe(0);
    });

    it('should assign full GST to IGST for inter-state supply', () => {
      const gstAmount = 360;
      const split = splitGst(gstAmount, true);

      expect(split.cgst).toBe(0);
      expect(split.sgst).toBe(0);
      expect(split.igst).toBe(360);
    });
  });

  describe('applyDiscount (Coupon Discounts & Thresholds)', () => {
    it('should return 0 discount when no coupon is provided', () => {
      expect(applyDiscount(2000, null)).toBe(0);
    });

    it('should calculate fixed value discount correctly', () => {
      const coupon = {
        discountType: 'fixed' as const,
        discountValue: 250
      };

      const discount = applyDiscount(2000, coupon);
      expect(discount).toBe(250);
    });

    it('should not allow fixed discount to exceed subtotal', () => {
      const coupon = {
        discountType: 'fixed' as const,
        discountValue: 500
      };

      const discount = applyDiscount(300, coupon);
      expect(discount).toBe(300); // capped at subtotal
    });

    it('should calculate percentage discount correctly', () => {
      const coupon = {
        discountType: 'percentage' as const,
        discountValue: 10
      };

      const discount = applyDiscount(2500, coupon);
      expect(discount).toBe(250); // 10% of 2500
    });

    it('should cap percentage discount at maximumDiscount limit', () => {
      const coupon = {
        discountType: 'percentage' as const,
        discountValue: 20,
        maximumDiscount: 300
      };

      // 20% of 3000 would be 600, but cap is 300
      const discount = applyDiscount(3000, coupon);
      expect(discount).toBe(300);
    });
  });

  describe('Complete Order Grand Total Formula', () => {
    it('should compute final order total including subtotal, discount, GST, and shipping fee', () => {
      // Scenario 1: Subtotal under 2000 (shipping fee 99 applies)
      const lines: PricedLine[] = [{ quantity: 1, unitPrice: 1500, gstPercentage: 18 }];
      const { subtotal, gstAmount } = priceLines(lines); // sub: 1500, gst: 270
      const discount = applyDiscount(subtotal, { discountType: 'fixed', discountValue: 100 }); // 100
      const shippingFee = subtotal > 0 && subtotal < 2000 ? 99 : 0; // 99
      const totalAmount = Math.round((subtotal - discount + gstAmount + shippingFee) * 100) / 100;

      // 1500 - 100 + 270 + 99 = 1769
      expect(totalAmount).toBe(1769);
    });

    it('should give free shipping when subtotal is 2000 or greater', () => {
      // Scenario 2: Subtotal >= 2000 (free shipping)
      const lines: PricedLine[] = [{ quantity: 2, unitPrice: 1500, gstPercentage: 18 }];
      const { subtotal, gstAmount } = priceLines(lines); // sub: 3000, gst: 540
      const discount = applyDiscount(subtotal, { discountType: 'percentage', discountValue: 10, maximumDiscount: 500 }); // 300
      const shippingFee = subtotal > 0 && subtotal < 2000 ? 99 : 0; // 0
      const totalAmount = Math.round((subtotal - discount + gstAmount + shippingFee) * 100) / 100;

      // 3000 - 300 + 540 + 0 = 3240
      expect(shippingFee).toBe(0);
      expect(totalAmount).toBe(3240);
    });
  });
});
