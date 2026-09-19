import { Router } from 'express';
import * as amcController from '../controllers/amcController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createAmcContractSchema } from '../validators/serviceValidators';

const router = Router();
router.use(requireAuth);

router.get('/my', amcController.myAmcContracts);
router.post('/request', amcController.requestAmc);

router.get('/', requirePermission('amc.read'), amcController.adminListAmcContracts);
router.post('/', requirePermission('amc.create'), validate(createAmcContractSchema), amcController.adminCreateAmcContract);
router.patch('/:id/assign-technician', requirePermission('amc.update'), amcController.adminAssignTechnicianToAmc);
router.post('/:id/visits', requirePermission('amc.update'), amcController.adminScheduleAmcVisit);
router.patch('/:id/status', requirePermission('amc.update'), amcController.adminUpdateAmcStatus);

export default router;
