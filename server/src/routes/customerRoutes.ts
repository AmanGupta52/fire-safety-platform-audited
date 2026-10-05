import { Router } from 'express';
import * as customerController from '../controllers/customerController';
import * as staffController from '../controllers/staffController';
import { requireAuth } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createStaffSchema, updateStaffSchema } from '../validators/authValidators';

const router = Router();
router.use(requireAuth, requirePermission('customers.read'));

router.get('/', customerController.adminListCustomers);
router.get('/:id', customerController.adminGetCustomerProfile);
router.patch('/:id/tags', requirePermission('customers.update'), customerController.adminUpdateCustomerTags);
router.patch('/:id/toggle-active', requirePermission('customers.update'), customerController.adminToggleCustomerActive);

export const staffRouter = Router();
staffRouter.use(requireAuth);

// Read permissions or role super_admin/admin
staffRouter.get(
  '/permissions',
  requireAnyPermission('staff.read', 'staff.manage', 'roles.read', 'roles.manage'),
  staffController.getAvailableRolesAndPermissions
);

staffRouter.get(
  '/',
  requireAnyPermission('staff.read', 'staff.manage'),
  staffController.listStaff
);

staffRouter.get(
  '/:id',
  requireAnyPermission('staff.read', 'staff.manage'),
  staffController.getStaffById
);

// Create staff (requires staff.create or staff.manage)
staffRouter.post(
  '/',
  requireAnyPermission('staff.create', 'staff.manage'),
  validate(createStaffSchema),
  staffController.createStaff
);

// Update staff (requires staff.update or staff.manage)
staffRouter.put(
  '/:id',
  requireAnyPermission('staff.update', 'staff.manage'),
  validate(updateStaffSchema),
  staffController.updateStaff
);

staffRouter.patch(
  '/:id/status',
  requireAnyPermission('staff.update', 'staff.manage'),
  staffController.updateStaff
);

// Re-send the set-password link to someone who has not signed in yet
staffRouter.post(
  '/:id/resend-invite',
  requireAnyPermission('staff.create', 'staff.update', 'staff.manage'),
  staffController.resendStaffInvite
);

// Delete/deactivate staff (requires staff.delete or staff.manage)
staffRouter.delete(
  '/:id',
  requireAnyPermission('staff.delete', 'staff.manage'),
  staffController.deleteStaff
);

export default router;
