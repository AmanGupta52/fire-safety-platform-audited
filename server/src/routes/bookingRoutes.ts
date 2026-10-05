import { Router } from 'express';
import * as serviceBookingController from '../controllers/serviceBookingController';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createServiceBookingSchema, updateBookingStatusSchema } from '../validators/serviceValidators';

const router = Router();

// ============================================================================
// SERVICE BOOKINGS  (/api/bookings)
// The service CATALOG lives in serviceRoutes.ts (/api/services). This router only deals with bookings.
// ============================================================================

// ---- Public / customer ----
router.get('/slots', serviceBookingController.getAvailableSlots);
router.get('/my', requireAuth, serviceBookingController.myServiceBookings);
router.post('/', requireAuth, validate(createServiceBookingSchema), serviceBookingController.createServiceBooking);
router.patch('/:id/reschedule', requireAuth, serviceBookingController.customerRescheduleBooking);
router.patch('/:id/cancel', requireAuth, serviceBookingController.customerCancelBooking);

// ---- Technician mobile flow ----
// Route-level permission is a first gate; the controller additionally checks that the job is assigned to
// the caller (or the caller is an admin).
router.get(
  '/technician/my-jobs',
  requireAuth,
  requireAnyPermission('service_bookings.read'),
  serviceBookingController.technicianMyJobs
);
router.post(
  '/:id/check-in',
  requireAuth,
  requireAnyPermission('service_bookings.update'),
  serviceBookingController.technicianCheckIn
);
router.post(
  '/:id/complete-report',
  requireAuth,
  requireAnyPermission('service_bookings.update'),
  serviceBookingController.technicianCompleteJob
);

// ---- Staff management ----
router.get('/', requireAuth, requireAnyPermission('service_bookings.read'), serviceBookingController.adminListServiceBookings);
router.patch('/:id/assign', requireAuth, requireAnyPermission('service_bookings.assign'), serviceBookingController.adminAssignTechnician);
router.patch(
  '/:id/status',
  requireAuth,
  requireAnyPermission('service_bookings.update'),
  validate(updateBookingStatusSchema),
  serviceBookingController.adminUpdateBookingStatus
);
router.post('/:id/report', requireAuth, requireAnyPermission('service_bookings.update'), serviceBookingController.adminUploadServiceReport);

export default router;
