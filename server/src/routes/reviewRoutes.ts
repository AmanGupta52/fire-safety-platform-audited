import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.get('/product/:productId', reviewController.listProductReviews);
router.get('/service/:serviceId', reviewController.listServiceReviews);
router.post('/', requireAuth, reviewController.createReview);
router.post('/booking', requireAuth, reviewController.createBookingReview);

router.get('/admin', requireAuth, requirePermission('reviews.read'), reviewController.adminListReviews);
router.patch('/admin/:id/moderate', requireAuth, requirePermission('reviews.update'), reviewController.adminModerateReview);

export default router;
