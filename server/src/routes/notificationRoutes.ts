import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', notificationController.myNotifications);
router.patch('/:id/read', notificationController.markNotificationRead);
router.patch('/read-all', notificationController.markAllNotificationsRead);

export default router;
