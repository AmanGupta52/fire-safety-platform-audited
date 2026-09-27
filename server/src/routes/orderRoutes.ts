import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { checkoutSchema } from '../validators/commerceValidators';

const router = Router();
router.use(requireAuth);

router.post('/checkout', validate(checkoutSchema), orderController.checkout);
router.get('/my', orderController.myOrders);
router.get('/my/:id', orderController.getMyOrder);
router.post('/my/:id/cancel', orderController.cancelMyOrder);

router.get('/', requirePermission('orders.read'), orderController.adminListOrders);
router.patch('/:id/status', requirePermission('orders.update'), orderController.adminUpdateOrderStatus);

export default router;
