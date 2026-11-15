import { Router } from 'express';
import * as deviceController from '../controllers/deviceController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.post('/', deviceController.registerDevice);
router.delete('/', deviceController.unregisterDevice);

export default router;
