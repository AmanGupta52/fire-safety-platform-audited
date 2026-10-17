import { Router, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok } from '../utils/apiResponse';
import { loadInvoicePdf } from '../services/invoiceService';

const router = Router();
router.use(requireAuth);

router.get('/my', asyncHandler(async (req: Request, res: Response) => {
  const invoices = await Invoice.find({ user: req.user!.id }).sort({ createdAt: -1 });
  return ok(res, invoices);
}));

router.get('/my/:id', asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user!.id });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return ok(res, invoice);
}));

router.get('/', requirePermission('orders.read'), asyncHandler(async (_req: Request, res: Response) => {
  const invoices = await Invoice.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(200);
  return ok(res, invoices);
}));

/**
 * GET /api/invoices/:id/pdf: the invoice as a real PDF file ("INV-2026-000001.pdf"), for the customer who owns it and for
 * staff who can read orders. Both frontends download through this instead of linking to the stored file's URL, which
 * (on Cloudinary) used to have no .pdf extension and so saved as a file nothing could open.
 * Add ?inline=1 to view it in the browser instead of downloading.
 */
router.get('/:id/pdf', asyncHandler(async (req: Request, res: Response) => {
  const invoice = isValidObjectId(req.params.id) ? await Invoice.findById(req.params.id) : null;
  const mayReadAll = req.user!.role === 'super_admin' || req.user!.permissions.includes('orders.read');
  // Someone else's invoice looks exactly like one that doesn't exist.
  if (!invoice || (!mayReadAll && invoice.user.toString() !== req.user!.id)) throw ApiError.notFound('Invoice not found');

  const pdf = await loadInvoicePdf(invoice);
  const fileName = `${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${fileName}"`);
  res.setHeader('Content-Length', String(pdf.length));
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(pdf);
}));

// Emails the invoice to its owner: staff only. (It used to be open to any signed-in user, who could make the system
// email any customer's invoice by guessing ids.)
router.post('/:id/email', requirePermission('orders.update'), asyncHandler(async (req: Request, res: Response) => {
  const { emailInvoiceToCustomer } = await import('../services/invoiceService');
  const success = await emailInvoiceToCustomer(req.params.id);
  if (!success) throw ApiError.badRequest('Failed to send invoice email: invoice or user email not found');
  return ok(res, { success: true }, 'Invoice emailed successfully');
}));

export const paymentRouter = Router();
paymentRouter.use(requireAuth);
paymentRouter.get('/my', asyncHandler(async (req: Request, res: Response) => {
  const payments = await Payment.find({ user: req.user!.id }).sort({ createdAt: -1 });
  return ok(res, payments);
}));

export default router;
