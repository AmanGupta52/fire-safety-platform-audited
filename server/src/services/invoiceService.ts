import { Order } from '../models/Order';
import { Invoice } from '../models/Invoice';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Setting } from '../models/AuditLog';
import { nextNumber } from './numberingService';
import path from 'path';
import fs from 'fs';
import { IInvoice } from '../models/Invoice';
import { CompanyInfo, generateInvoicePdf, renderInvoicePdf } from './pdfService';
import { splitGst } from './pricingService';
import { sendEmail, emailTemplates } from './emailService';
import { logger } from '../config/logger';
import { env } from '../config/env';

const DEFAULT_COMPANY = {
  name: 'Shubam Fire Protection Pvt. Ltd.',
  companyName: 'Shubam Fire Protection Pvt. Ltd.',
  address: 'Shop 4, Commercial Complex, Sector 17, Navi Mumbai, Maharashtra 400703',
  phone: '+91-98765-43210',
  email: 'billing@firesafety.example',
  gstin: '',
  gstNumber: '',
  state: 'Maharashtra',
  stateCode: '27'
};

export async function getCompanySettings() {
  const setting = await Setting.findOne({ key: 'company' });
  const val = (setting?.value as Record<string, unknown>) || {};
  return {
    ...DEFAULT_COMPANY,
    ...val,
    name: (val.companyName || val.name || DEFAULT_COMPANY.name) as string,
    companyName: (val.companyName || val.name || DEFAULT_COMPANY.companyName) as string,
    gstin: (val.gstin || val.gstNumber || DEFAULT_COMPANY.gstin) as string,
    gstNumber: (val.gstNumber || val.gstin || DEFAULT_COMPANY.gstNumber) as string,
    state: (val.state || DEFAULT_COMPANY.state) as string,
    stateCode: (val.stateCode || DEFAULT_COMPANY.stateCode) as string
  };
}

export async function generateInvoiceForOrder(orderId: string) {
  const existing = await Invoice.findOne({ order: orderId });
  if (existing) return existing;

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found for invoicing');
  const user = await User.findById(order.user);
  const company = await getCompanySettings();

  // A tax invoice without the seller's GSTIN is not valid. Never print a placeholder number: in production we
  // refuse to generate (the order itself is unaffected; an admin can retry once Settings are filled in).
  if (!company.gstin && env.nodeEnv === 'production') {
    throw new Error('Company GSTIN is not configured. Add it under Settings, then regenerate the invoice.');
  }

  const shippingState = String((order.shippingAddress as Record<string, unknown>)?.state || '');
  const isInterState = shippingState.trim().toLowerCase() !== company.state.toLowerCase();

  // Populate or look up HSN codes
  const productIds = order.items.map((i) => i.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).select('_id hsnCode');
  const hsnMap = new Map<string, string>();
  for (const p of products) {
    if (p.hsnCode) hsnMap.set(p._id.toString(), p.hsnCode);
  }

  const items = order.items.map((item) => {
    // Orders created after the discount fix carry taxableValue/gstAmount (GST on the discounted value).
    // Older orders fall back to the undiscounted calculation.
    const taxableValue = item.taxableValue ?? Math.round(item.unitPrice * item.quantity * 100) / 100;
    const gstAmount = item.gstAmount ?? Math.round(taxableValue * (item.gstPercentage / 100) * 100) / 100;
    const { cgst, sgst, igst } = splitGst(gstAmount, isInterState);
    const prodId = item.product ? item.product.toString() : '';
    const hsnCode = hsnMap.get(prodId) || '8424';

    return {
      name: item.name,
      hsnCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstPercentage: item.gstPercentage,
      taxableValue,
      cgst,
      sgst,
      igst,
      lineTotal: Math.round((taxableValue + gstAmount) * 100) / 100
    };
  });

  const taxableTotal = Math.round((order.subtotal - (order.discount || 0)) * 100) / 100;

  const invoiceNumber = await nextNumber('invoice', 'INV');

  const pdf = await generateInvoicePdf({
    invoiceNumber,
    orderNumber: order.orderNumber,
    date: new Date(),
    company,
    customer: {
      name: user?.name || 'Customer',
      companyName: order.companyName,
      phone: (order.billingAddress as Record<string, unknown>)?.phone as string || user?.phone || '',
      email: user?.email || '',
      gstNumber: order.gstNumber,
      address: formatAddress(order.billingAddress),
      state: shippingState || company.state
    },
    items,
    totals: {
      subtotal: order.subtotal,
      discount: order.discount || 0,
      shippingFee: order.shippingFee || 0,
      taxableTotal,
      totalGst: order.gstAmount,
      grandTotal: order.totalAmount
    },
    isInterState
  });

  const invoice = await Invoice.create({
    invoiceNumber,
    order: order._id,
    user: order.user,
    companySnapshot: company,
    customerSnapshot: {
      name: user?.name,
      email: user?.email,
      gstNumber: order.gstNumber,
      address: formatAddress(order.billingAddress)
    },
    items,
    subtotal: order.subtotal,
    discount: order.discount || 0,
    shippingFee: order.shippingFee || 0,
    taxableTotal,
    totalGst: order.gstAmount,
    grandTotal: order.totalAmount,
    pdfUrl: pdf.url,
    pdfPublicId: pdf.publicId
  });

  // Automatically email the GST tax invoice to the customer
  if (user?.email && pdf.url) {
    try {
      await sendEmail(
        user.email,
        `Tax Invoice #${invoiceNumber} for Order #${order.orderNumber}`,
        emailTemplates.invoiceReady(invoiceNumber, order.orderNumber, pdf.url, order.totalAmount)
      );
    } catch (err) {
      logger.error({ err, invoiceNumber }, '[invoiceService] Failed to send invoice email');
    }
  }

  return invoice;
}

export async function emailInvoiceToCustomer(invoiceId: string): Promise<boolean> {
  const invoice = await Invoice.findById(invoiceId).populate('order', 'orderNumber');
  if (!invoice || !invoice.pdfUrl) return false;

  const user = await User.findById(invoice.user);
  if (!user?.email) return false;

  const orderNum = (invoice.order as unknown as Record<string, unknown>)?.orderNumber as string || 'Direct';
  const result = await sendEmail(
    user.email,
    `Tax Invoice #${invoice.invoiceNumber}`,
    emailTemplates.invoiceReady(invoice.invoiceNumber, orderNum, invoice.pdfUrl, invoice.grandTotal)
  );

  // A failed send is reported as { sent: false } (it does not throw), so don't tell the admin it went out.
  return result.sent;
}

function formatAddress(addr: unknown): string {
  const a = addr as Record<string, string> | undefined;
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}

/**
 * Best-effort invoice generation for flows that must not fail because of invoicing (checkout, status updates).
 * Errors are logged; the order stays valid and an admin can regenerate the invoice later.
 */
export async function tryGenerateInvoiceForOrder(orderId: string) {
  try {
    return await generateInvoiceForOrder(orderId);
  } catch (err) {
    logger.error({ err, orderId }, '[invoiceService] Invoice generation failed; order left intact');
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Downloading an invoice
// ---------------------------------------------------------------------------------------------------------------

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const isPdf = (buffer: Buffer) => buffer.length > 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF';

/** The PDF exactly as it was stored (local disk or Cloudinary), or null when it can't be read. Never throws. */
async function readStoredPdf(url?: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const localPrefix = `${env.publicUrl}/uploads/`;
    if (url.startsWith(localPrefix)) {
      // Resolve inside the uploads folder only: a stored URL containing ../ must never read other files.
      const file = path.resolve(UPLOADS_DIR, decodeURIComponent(url.slice(localPrefix.length)));
      if (!file.startsWith(UPLOADS_DIR + path.sep)) return null;
      const buffer = fs.readFileSync(file);
      return isPdf(buffer) ? buffer : null;
    }
    // Only our own Cloudinary storage is fetched, so a bad value in the database can't point the server at somewhere else.
    const remote = new URL(url);
    if (remote.protocol !== 'https:' || !remote.hostname.endsWith('.cloudinary.com')) return null;
    const response = await fetch(remote, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    if (Number(response.headers.get('content-length') || 0) > MAX_PDF_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length <= MAX_PDF_BYTES && isPdf(buffer) ? buffer : null;
  } catch {
    return null;
  }
}

/** Rebuilds the invoice PDF from the saved invoice (used when the stored file is missing, blocked or not a real PDF). */
async function renderInvoiceFromRecord(invoice: IInvoice): Promise<Buffer> {
  const [order, user] = await Promise.all([Order.findById(invoice.order), User.findById(invoice.user)]);
  const company = invoice.companySnapshot as unknown as CompanyInfo;
  const customer = invoice.customerSnapshot as Record<string, string | undefined>;
  const billing = (order?.billingAddress || {}) as Record<string, unknown>;
  const shippingState = String((order?.shippingAddress as Record<string, unknown> | undefined)?.state || '');
  return renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: order?.orderNumber,
    date: invoice.createdAt,
    company,
    customer: {
      name: customer.name || user?.name || 'Customer',
      companyName: order?.companyName,
      phone: (billing.phone as string) || user?.phone || '',
      email: customer.email || user?.email || '',
      gstNumber: customer.gstNumber,
      address: customer.address,
      state: shippingState || company.state
    },
    items: invoice.items,
    totals: {
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      shippingFee: invoice.shippingFee,
      taxableTotal: invoice.taxableTotal ?? invoice.subtotal - (invoice.discount || 0),
      totalGst: invoice.totalGst,
      grandTotal: invoice.grandTotal
    },
    isInterState: invoice.items.some((item) => item.igst > 0)
  });
}

/** The bytes of a real PDF for this invoice: the stored original when readable, otherwise a faithful rebuild. */
export async function loadInvoicePdf(invoice: IInvoice): Promise<Buffer> {
  const stored = await readStoredPdf(invoice.pdfUrl);
  if (stored) return stored;
  logger.warn({ invoiceNumber: invoice.invoiceNumber }, '[invoiceService] Stored invoice PDF not readable, rebuilding it from the invoice record');
  return renderInvoiceFromRecord(invoice);
}
