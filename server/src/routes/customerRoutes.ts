import { Router } from 'express';
import * as customerController from '../controllers/customerController';
import * as staffController from '../controllers/staffController';
import { requireAuth } from '../middleware/auth';
import { requirePermission, requireRole } from '../middleware/rbac';

const router = Router();
router.use(requireAuth, requirePermission('customers.read'));

router.get('/', customerController.adminListCustomers);
router.get('/:id', customerController.adminGetCustomerProfile);
router.patch('/:id/tags', requirePermission('customers.update'), customerController.adminUpdateCustomerTags);
router.patch('/:id/toggle-active', requirePermission('customers.update'), customerController.adminToggleCustomerActive);

export const staffRouter = Router();
staffRouter.use(requireAuth, requireRole('super_admin', 'admin'));
staffRouter.get('/', staffController.listStaff);
staffRouter.post('/', requireRole('super_admin'), staffController.createStaff);
staffRouter.put('/:id', requireRole('super_admin'), staffController.updateStaff);

export default router;
