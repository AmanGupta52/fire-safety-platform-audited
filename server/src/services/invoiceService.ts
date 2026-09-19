import { Order } from '../models/Order';
import { Invoice } from '../models/Invoice';
import { User } from '../models/User';
import { Setting } from '../models/AuditLog';
import { nextNumber } from './numberingService';
import { generateInvoicePdf } from './pdfService';
import { splitGst } from './pricingService';

const DEFAULT_COMPANY = {
  name: 'Your Fire Safety Company Pvt. Ltd.',
  address: 'Configure company address in Admin > Settings',
  phone: '+91-00000-00000',
  email: 'info@firesafety.example',
  gstin: undefined as string | undefined,
  stateCode: '27' // Maharashtra default — used only for the intra/inter-state GST demo split
};

export async function getCompanySettings() {
  const setting = await Setting.findOne({ key: 'company' });
  return { ...DEFAULT_COMPANY, ...(setting?.value as object) };
}

export async function generateInvoiceForOrder(orderId: string) {
  const existing = await Invoice.findOne({ order: orderId });
  if (existing) return existing;

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found for invoicing');
  const user = await User.findById(order.user);
  const company = await getCompanySettings();

  const shippingState = String((order.shippingAddress as any)?.state || '');
  const isInterState = shippingState.toLowerCase() !== 'maharashtra'; // demo heuristic; configure per real company state

  const items = order.items.map((item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const gstAmount = lineSubtotal * (item.gstPercentage / 100);
    const { cgst, sgst, igst } = splitGst(gstAmount, isInterState);
    return {
      name: item.name, hsnCode: '', quantity: item.quantity, unitPrice: item.unitPrice,
      gstPercentage: item.gstPercentage, cgst, sgst, igst, lineTotal: item.lineTotal
    };
  });

  const invoiceNumber = await nextNumber('invoice', 'INV');

  const pdf = await generateInvoicePdf({
    invoiceNumber,
    date: new Date(),
    company,
    customer: {
      name: user?.name || 'Customer', companyName: order.companyName,
      phone: (order.billingAddress as any)?.phone || user?.phone || '', email: user?.email || '',
      gstNumber: order.gstNumber, address: formatAddress(order.billingAddress)
    },
    items,
    totals: { subtotal: order.subtotal, totalGst: order.gstAmount, grandTotal: order.totalAmount }
  });

  return Invoice.create({
    invoiceNumber, order: order._id, user: order.user,
    companySnapshot: company, customerSnapshot: { name: user?.name, email: user?.email, gstNumber: order.gstNumber },
    items, subtotal: order.subtotal, totalGst: order.gstAmount, grandTotal: order.totalAmount,
    pdfUrl: pdf.url, pdfPublicId: pdf.publicId
  });
}

function formatAddress(addr: unknown): string {
  const a = addr as Record<string, string> | undefined;
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}
