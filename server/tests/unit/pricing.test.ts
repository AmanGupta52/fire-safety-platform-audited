import { describe, it, expect } from 'vitest';
import { priceOrder, shippingFor, priceLines, applyDiscount } from '../../src/services/pricingService';
import { numberToWordsINR } from '../../src/services/pdfService';

describe('priceOrder: GST is charged on the DISCOUNTED value', () => {
  it('matches a hand calculation (3 x Rs 1000 @18%, Rs 300 coupon)', () => {
    const r = priceOrder([{ quantity: 3, unitPrice: 1000, gstPercentage: 18 }], 300, 0);
    expect(r.subtotal).toBe(3000);
    expect(r.discount).toBe(300);
    expect(r.taxableTotal).toBe(2700);
    expect(r.gstAmount).toBe(486); // 18% of 2700, NOT 18% of 3000 (= 540)
    expect(r.total).toBe(3186);
  });

  it('spreads the discount across mixed GST rates in proportion', () => {
    const r = priceOrder(
      [
        { quantity: 1, unitPrice: 1000, gstPercentage: 18 },
        { quantity: 1, unitPrice: 1000, gstPercentage: 5 }
      ],
      200,
      0
    );
    expect(r.lines[0].discountShare + r.lines[1].discountShare).toBe(200);
    expect(r.lines[0].taxableValue).toBe(900);
    expect(r.lines[1].taxableValue).toBe(900);
    expect(r.gstAmount).toBe(162 + 45);
    expect(r.total).toBe(1800 + 207);
  });

  it('keeps shares exactly equal to the discount even when it does not divide evenly', () => {
    const r = priceOrder(
      [
        { quantity: 1, unitPrice: 333.33, gstPercentage: 18 },
        { quantity: 1, unitPrice: 333.33, gstPercentage: 18 },
        { quantity: 1, unitPrice: 333.34, gstPercentage: 18 }
      ],
      100,
      0
    );
    const sum = Math.round(r.lines.reduce((a, l) => a + l.discountShare, 0) * 100) / 100;
    expect(sum).toBe(100);
    expect(r.taxableTotal).toBe(900);
  });

  it('never lets a discount exceed the subtotal or go negative', () => {
    expect(priceOrder([{ quantity: 1, unitPrice: 500, gstPercentage: 18 }], 9999, 0).discount).toBe(500);
    expect(priceOrder([{ quantity: 1, unitPrice: 500, gstPercentage: 18 }], -50, 0).discount).toBe(0);
  });

  it('adds shipping after tax (shipping is not taxed here)', () => {
    const r = priceOrder([{ quantity: 1, unitPrice: 1000, gstPercentage: 18 }], 0, shippingFor(1000));
    expect(r.shippingFee).toBe(99);
    expect(r.total).toBe(1000 + 180 + 99);
  });

  it('handles an empty cart', () => {
    const r = priceOrder([], 0, 0);
    expect(r.total).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it('without a discount it agrees with the older helper', () => {
    const lines = [{ quantity: 2, unitPrice: 799.5, gstPercentage: 18 }, { quantity: 1, unitPrice: 120, gstPercentage: 12 }];
    const a = priceOrder(lines);
    const b = priceLines(lines);
    expect(a.subtotal).toBe(b.subtotal);
    expect(a.gstAmount).toBe(b.gstAmount);
  });
});

describe('shippingFor', () => {
  it('is free from Rs 2,000 and Rs 99 below it', () => {
    expect(shippingFor(1999.99)).toBe(99);
    expect(shippingFor(2000)).toBe(0);
    expect(shippingFor(0)).toBe(0);
  });
});

describe('applyDiscount', () => {
  it('applies percentage coupons with a cap', () => {
    expect(applyDiscount(5000, { discountType: 'percentage', discountValue: 10, maximumDiscount: 300 } as never)).toBe(300);
    expect(applyDiscount(1000, { discountType: 'percentage', discountValue: 10 } as never)).toBe(100);
  });
  it('applies fixed coupons without exceeding the subtotal', () => {
    expect(applyDiscount(100, { discountType: 'fixed', discountValue: 500 } as never)).toBe(100);
  });
});

describe('numberToWordsINR', () => {
  it('uses the Indian lakh/crore system', () => {
    expect(numberToWordsINR(123456)).toBe('INR One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only');
    expect(numberToWordsINR(10000000)).toBe('INR One Crore Rupees Only');
  });
  it('includes paise instead of dropping them', () => {
    expect(numberToWordsINR(1180.5)).toBe('INR One Thousand One Hundred Eighty Rupees and Fifty Paise Only');
    expect(numberToWordsINR(0.99)).toBe('INR Zero Rupees and Ninety Nine Paise Only');
  });
  it('rounds floating point noise correctly', () => {
    expect(numberToWordsINR(100.1 + 0.2)).toContain('Thirty Paise');
  });
});
