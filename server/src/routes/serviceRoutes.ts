import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import * as serviceBookingController from '../controllers/serviceBookingController';
import * as serviceController from '../controllers/serviceController';
import { requireAuth, attachUserIfPresent } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  createServiceBookingSchema,
  createServiceSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
  reorderServicesSchema
} from '../validators/serviceValidators';

const router = Router();

// ============================================================================
// 1. DEDICATED CATALOG ROUTES (Clean RESTful Architecture)
// ============================================================================

// Public catalog
router.get('/catalog', serviceController.listPublicServices);
router.get('/catalog/:slug', serviceController.getPublicServiceBySlug);

// Admin catalog management
router.get(
  '/admin/catalog',
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

router.put(
  '/catalog/reorder',
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

router.put(
  '/catalog/:id',
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

router.delete(
  '/catalog/:id',
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

// ============================================================================
// 2. DEDICATED BOOKING ROUTES
// ============================================================================

router.get(
  '/bookings',
  requireAuth,
  requirePermission('services.read'),
  serviceBookingController.adminListServiceBookings
);

router.post(
  '/bookings',
  requireAuth,
  validate(createServiceBookingSchema),
  serviceBookingController.createServiceBooking
);

router.get('/bookings/my', requireAuth, serviceBookingController.myServiceBookings);

// ============================================================================
// 3. EXISTING BOOKING ROUTES (Must preserve for backward compatibility)
// ============================================================================

router.get('/my', requireAuth, serviceBookingController.myServiceBookings);
router.get('/technician/my-jobs', requireAuth, serviceBookingController.technicianMyJobs);

router.patch(
  '/:id/assign',
  requireAuth,
  requirePermission('services.update'),
  serviceBookingController.adminAssignTechnician
);

router.post(
  '/:id/report',
  requireAuth,
  requirePermission('services.update'),
  serviceBookingController.adminUploadServiceReport
);

// ============================================================================
// 4. UNIFIED ROOT ROUTES (/api/services & /api/services/:idOrSlug)
//    Intelligently dispatches between Catalog and Booking operations to satisfy
//    both Section 9 contracts and existing frontend calls.
// ============================================================================

/**
 * GET /api/services
 * - If unauthenticated OR requesting catalog explicitly (query.view='catalog' or query.catalog='true'):
 *   Returns public active & published services catalog.
 * - If authenticated and requesting bookings (e.g. query.status is present, or admin without catalog flag):
 *   Returns service bookings (preserving existing admin ServicesList.tsx behavior).
 */
router.get('/', attachUserIfPresent, (req: Request, res: Response, next: NextFunction) => {
  const isCatalogExplicit = req.query.view === 'catalog' || req.query.catalog === 'true';
  const isBookingExplicit = req.query.view === 'bookings' || req.query.status !== undefined || req.query.serviceType !== undefined;

  if (isCatalogExplicit) {
    if (req.user && req.query.all === 'true') {
      return (requirePermission('services.read'))(req, res, () => serviceController.adminListServices(req, res, next));
    }
    return serviceController.listPublicServices(req, res, next);
  }

  if (isBookingExplicit && req.user) {
    return (requirePermission('services.read'))(req, res, () => serviceBookingController.adminListServiceBookings(req, res, next));
  }

  // If user is authenticated and has services.read permission, and called from admin without explicit catalog param
  if (req.user && req.user.permissions?.includes('services.read')) {
    return serviceBookingController.adminListServiceBookings(req, res, next);
  }

  // Otherwise, default to public services catalog
  return serviceController.listPublicServices(req, res, next);
});

/**
 * POST /api/services
 * - If payload has booking attributes (serviceType or preferredDate or phone & address), creates ServiceBooking.
 * - If payload has service catalog attributes (name, description, startingPrice), creates Service catalog item.
 */
router.post('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  if (req.body.serviceType || req.body.serviceId || (req.body.preferredDate && req.body.address)) {
    return validate(createServiceBookingSchema)(req, res, () =>
      serviceBookingController.createServiceBooking(req, res, next)
    );
  }

  return (requirePermission('services.create'))(req, res, () =>
    validate(createServiceSchema)(req, res, () => serviceController.adminCreateService(req, res, next))
  );
});

/**
 * PUT /api/services/:id
 * - Admin update service catalog item.
 */
router.put(
  '/:id',
  requireAuth,
  requirePermission('services.update'),
  validate(updateServiceSchema),
  serviceController.adminUpdateService
);

/**
 * PATCH /api/services/:id/status
 * - If body has isActive/isPublished/isFeatured -> updates service catalog status.
 * - If body has booking status (requested, confirmed, etc.) -> updates booking status.
 */
router.patch(
  '/:id/status',
  requireAuth,
  requirePermission('services.update'),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.isActive !== undefined || req.body.isPublished !== undefined || req.body.isFeatured !== undefined) {
      return validate(updateServiceStatusSchema)(req, res, () =>
        serviceController.adminUpdateServiceStatus(req, res, next)
      );
    }

    return serviceBookingController.adminUpdateBookingStatus(req, res, next);
  }
);

/**
 * DELETE /api/services/:id
 * - Admin delete/deactivate service catalog item.
 */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('services.delete'),
  serviceController.adminDeleteService
);

/**
 * GET /api/services/:slug
 * - Fetch service by slug (or ID) from public catalog or admin.
 */
router.get('/:slug', attachUserIfPresent, (req: Request, res: Response, next: NextFunction) => {
  const { slug } = req.params;

  // If this is a 24-character hex ObjectId and user has admin permission, check if it's an admin lookup
  if (Types.ObjectId.isValid(slug) && req.user && req.user.permissions?.includes('services.read')) {
    return serviceController.adminGetServiceById(req, res, next);
  }

  return serviceController.getPublicServiceBySlug(req, res, next);
});

export default router;
