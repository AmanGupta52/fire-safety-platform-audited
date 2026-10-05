import { Router, Request, Response } from 'express';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok } from '../utils/apiResponse';

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

router.post('/:id/email', asyncHandler(async (req: Request, res: Response) => {
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
