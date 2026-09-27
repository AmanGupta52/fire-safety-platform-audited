import { Router } from 'express';
import * as blogController from '../controllers/blogController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.get('/', blogController.listPublishedPosts);
router.get('/:slug', blogController.getPostBySlug);

router.get('/admin/all', requireAuth, requirePermission('blog.read'), blogController.adminListPosts);
router.post('/admin', requireAuth, requirePermission('blog.create'), blogController.adminCreatePost);
router.put('/admin/:id', requireAuth, requirePermission('blog.update'), blogController.adminUpdatePost);
router.delete('/admin/:id', requireAuth, requirePermission('blog.delete'), blogController.adminDeletePost);

export default router;
