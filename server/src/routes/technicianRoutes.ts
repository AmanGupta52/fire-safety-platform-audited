import { Router } from 'express';
import * as technicianController from '../controllers/technicianController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('technicians.read'), technicianController.listTechnicians);
router.post('/', requirePermission('technicians.create'), technicianController.createTechnician);
router.put('/:id', requirePermission('technicians.update'), technicianController.updateTechnician);
router.patch('/:id/disable', requirePermission('technicians.update'), technicianController.disableTechnician);
router.get('/:id/workload', requirePermission('technicians.read'), technicianController.technicianWorkload);

export default router;
