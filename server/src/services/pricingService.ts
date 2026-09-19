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
