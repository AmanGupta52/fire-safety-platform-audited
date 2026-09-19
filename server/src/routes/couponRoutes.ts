import { Router } from 'express';
import * as couponController from '../controllers/couponController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();
router.use(requireAuth, requirePermission('coupons.read'));

router.get('/', couponController.listCoupons);
router.post('/', requirePermission('coupons.create'), couponController.createCoupon);
router.put('/:id', requirePermission('coupons.update'), couponController.updateCoupon);
router.delete('/:id', requirePermission('coupons.delete'), couponController.deleteCoupon);

export default router;
