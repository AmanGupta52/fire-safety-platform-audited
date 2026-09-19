import { Router } from 'express';
import * as serviceController from '../controllers/serviceBookingController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createServiceBookingSchema } from '../validators/serviceValidators';

const router = Router();
router.use(requireAuth);

router.post('/', validate(createServiceBookingSchema), serviceController.createServiceBooking);
router.get('/my', serviceController.myServiceBookings);
router.get('/technician/my-jobs', serviceController.technicianMyJobs);

router.get('/', requirePermission('services.read'), serviceController.adminListServiceBookings);
router.patch('/:id/assign', requirePermission('services.update'), serviceController.adminAssignTechnician);
router.patch('/:id/status', requirePermission('services.update'), serviceController.adminUpdateBookingStatus);
router.post('/:id/report', requirePermission('services.update'), serviceController.adminUploadServiceReport);

export default router;
