export interface PricedLine {
  quantity: number;
  unitPrice: number;
  gstPercentage: number;
}

export interface PricingBreakdown {
  subtotal: number;
  gstAmount: number;
  total: number;
}

export interface OrderPricingLine extends PricedLine {
  /** Line value before discount and before GST (quantity x unitPrice). */
  lineSubtotal: number;
  /** Share of the order-level discount allocated to this line. */
  discountShare: number;
  /** Value on which GST is charged (lineSubtotal - discountShare). */
  taxableValue: number;
  gstAmount: number;
}

export interface OrderPricing {
  subtotal: number;
  discount: number;
  taxableTotal: number;
  gstAmount: number;
  shippingFee: number;
  total: number;
  lines: OrderPricingLine[];
}

/**
 * Prices a whole order the way Indian GST law expects: the discount reduces the taxable value, and GST is
 * charged on the discounted value. The discount is spread across lines in proportion to their value (the last
 * line absorbs the rounding remainder so the shares always add up to the discount exactly).
 * Shipping is added after tax (it is not taxed here).
 */
export function priceOrder(lines: PricedLine[], discount = 0, shippingFee = 0): OrderPricing {
  const lineSubtotals = lines.map((l) => round2(l.quantity * l.unitPrice));
  const subtotal = round2(lineSubtotals.reduce((a, b) => a + b, 0));
  const safeDiscount = round2(Math.min(Math.max(discount, 0), subtotal));

  let allocated = 0;
  const priced: OrderPricingLine[] = lines.map((l, i) => {
    const isLast = i === lines.length - 1;
    const share = isLast
      ? round2(safeDiscount - allocated)
      : subtotal > 0
        ? round2((safeDiscount * lineSubtotals[i]) / subtotal)
        : 0;
    allocated = round2(allocated + share);
    const taxableValue = round2(lineSubtotals[i] - share);
    return {
      ...l,
      lineSubtotal: lineSubtotals[i],
      discountShare: share,
      taxableValue,
      gstAmount: round2(taxableValue * (l.gstPercentage / 100))
    };
  });

  const taxableTotal = round2(priced.reduce((a, l) => a + l.taxableValue, 0));
  const gstAmount = round2(priced.reduce((a, l) => a + l.gstAmount, 0));
  const fee = round2(Math.max(shippingFee, 0));

  return {
    subtotal,
    discount: safeDiscount,
    taxableTotal,
    gstAmount,
    shippingFee: fee,
    total: round2(taxableTotal + gstAmount + fee),
    lines: priced
  };
}

/** Standard shipping rule: free from Rs 2,000 (pre-GST subtotal), Rs 99 otherwise. */
export function shippingFor(subtotal: number): number {
  return subtotal > 0 && subtotal < 2000 ? 99 : 0;
}

export function priceLines(lines: PricedLine[]): PricingBreakdown {
  let subtotal = 0;
  let gstAmount = 0;

  for (const line of lines) {
    const lineSubtotal = line.quantity * line.unitPrice;
    subtotal += lineSubtotal;
    gstAmount += lineSubtotal * (line.gstPercentage / 100);
  }

  return {
    subtotal: round2(subtotal),
    gstAmount: round2(gstAmount),
    total: round2(subtotal + gstAmount)
  };
}

// India GST split: intra-state -> CGST+SGST (half each); inter-state -> IGST (full).
export function splitGst(gstAmount: number, isInterState: boolean) {
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: round2(gstAmount) };
  }
  const half = round2(gstAmount / 2);
  return { cgst: half, sgst: half, igst: 0 };
}

export function applyDiscount(
  subtotal: number,
  coupon: { discountType: 'percentage' | 'fixed'; discountValue: number; maximumDiscount?: number } | null
): number {
  if (!coupon) return 0;
  let discount =
    coupon.discountType === 'percentage' ? subtotal * (coupon.discountValue / 100) : coupon.discountValue;
  if (coupon.maximumDiscount) discount = Math.min(discount, coupon.maximumDiscount);
  return round2(Math.min(discount, subtotal));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
