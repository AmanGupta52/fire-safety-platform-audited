import { Router } from 'express';
import * as equipmentController from '../controllers/equipmentController';
import rateLimit from 'express-rate-limit';
import { requireAuth, attachUserIfPresent } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createEquipmentSchema } from '../validators/serviceValidators';

const router = Router();

// Publicly accessible equipment passport (scanned via physical QR code sticker). Anonymous callers get a
// redacted view; the owner and authorised staff get the full record. Rate-limited because serial numbers are
// short and guessable.
const isTest = process.env.NODE_ENV === 'test';
const passportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10_000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many lookups. Please try again later.', errors: [] }
});
router.get('/passport/:identifier', passportLimiter, attachUserIfPresent, equipmentController.getEquipmentPassport);

// Authenticated routes
router.use(requireAuth);

router.get('/my', equipmentController.listMyEquipment);
router.get('/my/:id', equipmentController.getMyEquipment);
router.post('/my', validate(createEquipmentSchema), equipmentController.registerEquipment);
router.put('/my/:id', equipmentController.updateMyEquipment);

// Recording a service event: administrators, or the technician on an assigned job (checked in the controller).
router.post(
  '/passport/:id/log',
  requireAnyPermission('equipment.update', 'service_bookings.update'),
  equipmentController.logPassportService
);

router.get('/', requirePermission('equipment.read'), equipmentController.adminListEquipment);
router.get('/due', requirePermission('equipment.read'), equipmentController.adminDueEquipment);

export default router;
