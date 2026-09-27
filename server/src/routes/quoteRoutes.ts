import { Router } from 'express';
import * as quoteController from '../controllers/quoteController';
import { requireAuth, attachUserIfPresent } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createQuoteSchema } from '../validators/commerceValidators';

const router = Router();

// B2B quote requests can be submitted by guests (attachUserIfPresent links it if logged in).
router.post('/', attachUserIfPresent, validate(createQuoteSchema), quoteController.createQuote);
router.get('/my', requireAuth, quoteController.myQuotes);

router.get('/', requireAuth, requirePermission('quotes.read'), quoteController.adminListQuotes);
router.get('/:id', requireAuth, requirePermission('quotes.read'), quoteController.adminGetQuote);
router.put('/:id', requireAuth, requirePermission('quotes.update'), quoteController.adminUpdateQuote);
router.patch('/:id/status', requireAuth, requirePermission('quotes.update'), quoteController.adminSetQuoteStatus);
router.post('/:id/pdf', requireAuth, requirePermission('quotes.update'), quoteController.adminGenerateQuotePdf);
router.post('/:id/convert', requireAuth, requirePermission('quotes.update'), quoteController.adminConvertQuoteToOrder);

export default router;
