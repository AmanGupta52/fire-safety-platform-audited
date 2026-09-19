import { Request, Response } from 'express';
import { Quote } from '../models/Quote';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created, paginationMeta } from '../utils/apiResponse';
import { nextNumber } from '../services/numberingService';
import { generateQuotePdf } from '../services/pdfService';
import { getCompanySettings } from '../services/invoiceService';
import { priceLines } from '../services/pricingService';
import { notify } from '../services/notificationService';
import { emailTemplates } from '../services/emailService';
import { writeAuditLog } from '../services/auditService';

export const createQuote = asyncHandler(async (req: Request, res: Response) => {
  const { customerName, companyName, phone, email, gstNumber, address, items, requirements, preferredDate, additionalNotes } = req.body;

  const resolvedItems = [];
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) throw ApiError.badRequest(`Product ${item.productId} not found`);
    resolvedItems.push({ product: product._id, name: product.name, quantity: item.quantity });
  }

  const quoteNumber = await nextNumber('quote', 'QT');
  const quote = await Quote.create({
    quoteNumber,
    user: req.user?.id || null,
    customerName, companyName, phone, email, gstNumber, address,
    items: resolvedItems, requirements,
    preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    additionalNotes, status: 'requested'
  });

  await notify({
    userId: req.user?.id, type: 'quote_created', title: 'Quotation Received',
    message: `Your quotation request ${quoteNumber} has been received. Our team will contact you shortly.`,
    email, emailHtml: emailTemplates.quoteCreated(quoteNumber), phone
  });

  return created(res, quote, 'Quotation request submitted');
});

export const myQuotes = asyncHandler(async (req: Request, res: Response) => {
  const quotes = await Quote.find({ user: req.user!.id }).sort({ createdAt: -1 });
  return ok(res, quotes);
});

export const adminListQuotes = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Quote.countDocuments(filter)
  ]);
  return ok(res, items, 'Quotes fetched', paginationMeta(page, limit, total));
});

export const adminGetQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');
  return ok(res, quote);
});

export const adminUpdateQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');
  const previous = quote.toObject();

  const allowed = ['items', 'requirements', 'additionalNotes', 'validUntil'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (quote as any)[key] = req.body[key];
  }
  await quote.save();

  await writeAuditLog(req, 'update', 'quotes', 'Quote', quote._id, previous, quote.toObject());
  return ok(res, quote, 'Quote updated');
});

export const adminSetQuoteStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: 'reviewing' | 'sent' | 'approved' | 'rejected' };
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');

  quote.status = status;
  await quote.save();

  if (status === 'approved') {
    await notify({
      userId: quote.user, type: 'quote_approved', title: 'Quotation Approved',
      message: `Your quotation ${quote.quoteNumber} has been approved.`, email: quote.email
    });
  }

  await writeAuditLog(req, 'set_status', 'quotes', 'Quote', quote._id, null, { status });
  return ok(res, quote, 'Quote status updated');
});

export const adminGenerateQuotePdf = asyncHandler(async (req: Request, res: Response) => {
  const quote = await Quote.findById(req.params.id).populate('items.product');
  if (!quote) throw ApiError.notFound('Quote not found');

  const priced = quote.items.map((item) => {
    const product = item.product as any;
    const unitPrice = item.unitPrice ?? product?.discountPrice ?? product?.price ?? 0;
    const gstPercentage = item.gstPercentage ?? product?.gstPercentage ?? 18;
    const lineTotal = Math.round(unitPrice * item.quantity * (1 + gstPercentage / 100) * 100) / 100;
    return { name: item.name, quantity: item.quantity, unitPrice, gstPercentage, lineTotal };
  });

  const totals = priceLines(priced.map((p) => ({ quantity: p.quantity, unitPrice: p.unitPrice, gstPercentage: p.gstPercentage })));
  const company = await getCompanySettings();

  const validUntil = quote.validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const pdf = await generateQuotePdf({
    quoteNumber: quote.quoteNumber,
    date: quote.createdAt,
    validUntil,
    company,
    customer: {
      name: quote.customerName, companyName: quote.companyName, phone: quote.phone,
      email: quote.email, gstNumber: quote.gstNumber, address: quote.address
    },
    items: priced,
    totals: { subtotal: totals.subtotal, gstAmount: totals.gstAmount, total: totals.total }
  });

  quote.pdfUrl = pdf.url;
  quote.pdfPublicId = pdf.publicId;
  quote.validUntil = validUntil;
  quote.totalAmount = totals.total;
  await quote.save();

  return ok(res, { pdfUrl: pdf.url }, 'Quote PDF generated');
});

export const adminConvertQuoteToOrder = asyncHandler(async (req: Request, res: Response) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');
  if (!quote.user) throw ApiError.badRequest('Only quotes linked to a registered account can be converted to an order');
  if (quote.status === 'converted') throw ApiError.badRequest('This quote has already been converted');

  // Conversion re-uses checkout-style logic but with quote-approved pricing;
  // in production this should invoke the same transactional order-creation path as checkout().
  const orderNumber = await nextNumber('order', 'ORD');

  const items = [];
  let subtotal = 0, gstAmount = 0;
  for (const item of quote.items) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    const unitPrice = item.unitPrice ?? product.discountPrice ?? product.price;
    const gstPercentage = item.gstPercentage ?? product.gstPercentage;
    const lineTotal = Math.round(unitPrice * item.quantity * (1 + gstPercentage / 100) * 100) / 100;
    items.push({ product: product._id, name: product.name, sku: product.sku, quantity: item.quantity, unitPrice, gstPercentage, lineTotal });
    subtotal += unitPrice * item.quantity;
    gstAmount += unitPrice * item.quantity * (gstPercentage / 100);
  }

  const order = await Order.create({
    orderNumber, user: quote.user, items,
    subtotal: Math.round(subtotal * 100) / 100, discount: 0, gstAmount: Math.round(gstAmount * 100) / 100,
    shippingFee: 0, totalAmount: Math.round((subtotal + gstAmount) * 100) / 100,
    status: 'confirmed', paymentStatus: 'unpaid', paymentMethod: 'cod',
    billingAddress: { line1: quote.address || 'Provided separately', city: '', state: '', pincode: '', contactName: quote.customerName, phone: quote.phone },
    shippingAddress: { line1: quote.address || 'Provided separately', city: '', state: '', pincode: '', contactName: quote.customerName, phone: quote.phone },
    companyName: quote.companyName, gstNumber: quote.gstNumber
  });

  quote.status = 'converted';
  quote.convertedOrder = order._id;
  await quote.save();

  await writeAuditLog(req, 'convert_to_order', 'quotes', 'Quote', quote._id, null, { orderId: order._id });
  return ok(res, { quote, order }, 'Quote converted to order');
});
