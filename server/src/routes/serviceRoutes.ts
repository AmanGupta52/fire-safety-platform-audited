import { Router } from 'express';
import * as serviceController from '../controllers/serviceController';
import bookingRoutes from './bookingRoutes';
import * as serviceBookingController from '../controllers/serviceBookingController';
import { requireAuth } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  createServiceSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
  reorderServicesSchema
} from '../validators/serviceValidators';

const router = Router();

// ============================================================================
// CLEAN SERVICE CATALOG ROUTES (/api/services)
// ============================================================================

// Public service catalog
router.get('/', serviceController.listPublicServices);
router.get('/catalog', serviceController.listPublicServices);
router.get('/catalog/:slug', serviceController.getPublicServiceBySlug);

// Admin service catalog management
router.get(
  '/admin/catalog',
  requireAuth,
  requirePermission('services.read'),
  serviceController.adminListServices
);

router.get(
  '/admin/all',
  requireAuth,
  requirePermission('services.read'),
  serviceController.adminListServices
);

router.post(
  '/catalog',
  requireAuth,
  requirePermission('services.create'),
  validate(createServiceSchema),
  serviceController.adminCreateService
);

router.post(
  '/',
  requireAuth,
  requirePermission('services.create'),
  validate(createServiceSchema),
  serviceController.adminCreateService
);

router.put(
  '/catalog/reorder',
  requireAuth,
  requirePermission('services.update'),
  validate(reorderServicesSchema),
  serviceController.adminReorderServices
);

router.put(
  '/reorder',
  requireAuth,
  requirePermission('services.update'),
  validate(reorderServicesSchema),
  serviceController.adminReorderServices
);

router.get(
  '/catalog/id/:id',
  requireAuth,
  requirePermission('services.read'),
  serviceController.adminGetServiceById
);

router.get(
  '/admin/:id',
  requireAuth,
  requirePermission('services.read'),
  serviceController.adminGetServiceById
);

router.put(
  '/catalog/:id',
  requireAuth,
  requirePermission('services.update'),
  validate(updateServiceSchema),
  serviceController.adminUpdateService
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('services.update'),
  validate(updateServiceSchema),
  serviceController.adminUpdateService
);

router.patch(
  '/catalog/:id/status',
  requireAuth,
  requirePermission('services.update'),
  validate(updateServiceStatusSchema),
  serviceController.adminUpdateServiceStatus
);

router.patch(
  '/:id/status',
  requireAuth,
  requirePermission('services.update'),
  validate(updateServiceStatusSchema),
  serviceController.adminUpdateServiceStatus
);

router.delete(
  '/catalog/:id',
  requireAuth,
  requirePermission('services.delete'),
  serviceController.adminDeleteService
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('services.delete'),
  serviceController.adminDeleteService
);

router.post(
  '/catalog/:id/restore',
  requireAuth,
  requirePermission('services.update'),
  serviceController.adminRestoreService
);

router.post(
  '/:id/restore',
  requireAuth,
  requirePermission('services.update'),
  serviceController.adminRestoreService
);

// ============================================================================
// DEPRECATED ALIASES (kept so older clients do not break)
// Bookings live at /api/bookings. Only the read-only/unambiguous legacy paths below are kept. The old
// "/:id/status", "/:id/assign" and "/:id/check-in" aliases were removed on purpose: under /services those
// paths mean the CATALOG item with that id, and mixing the two meanings is exactly what caused bugs.
// ============================================================================

router.use('/bookings', bookingRoutes);
router.get('/slots', serviceBookingController.getAvailableSlots);
router.get('/my', requireAuth, serviceBookingController.myServiceBookings);
router.get('/technician/my-jobs', requireAuth, requireAnyPermission('service_bookings.read'), serviceBookingController.technicianMyJobs);

// Public lookup by service slug (placed at the end to not shadow explicit subpaths)
router.get('/:slug', serviceController.getPublicServiceBySlug);

export default router;
