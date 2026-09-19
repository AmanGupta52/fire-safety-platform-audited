import { Router } from 'express';
import * as equipmentController from '../controllers/equipmentController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createEquipmentSchema } from '../validators/serviceValidators';

const router = Router();
router.use(requireAuth);

router.get('/my', equipmentController.listMyEquipment);
router.get('/my/:id', equipmentController.getMyEquipment);
router.post('/my', validate(createEquipmentSchema), equipmentController.registerEquipment);
router.put('/my/:id', equipmentController.updateMyEquipment);

router.get('/', requirePermission('equipment.read'), equipmentController.adminListEquipment);
router.get('/due', requirePermission('equipment.read'), equipmentController.adminDueEquipment);

export default router;
