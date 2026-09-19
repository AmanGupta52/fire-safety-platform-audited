import { Router } from 'express';
import * as productController from '../controllers/productController';
import * as categoryController from '../controllers/categoryController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { createProductSchema, updateProductSchema, createCategorySchema } from '../validators/productValidators';

const router = Router();

// Public
router.get('/', productController.listProducts);
router.get('/search-suggestions', productController.searchSuggestions);
router.get('/low-stock', requireAuth, requirePermission('products.read'), productController.lowStockProducts);
router.get('/:slug', productController.getProductBySlug);

// Admin
router.post('/', requireAuth, requirePermission('products.create'), validate(createProductSchema), productController.createProduct);
router.put('/:id', requireAuth, requirePermission('products.update'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', requireAuth, requirePermission('products.delete'), productController.deleteProduct);
router.patch('/:id/stock', requireAuth, requirePermission('products.update'), productController.adjustStock);

export const categoryRouter = Router();
categoryRouter.get('/', categoryController.listCategories);
categoryRouter.get('/:slug', categoryController.getCategory);
categoryRouter.post('/', requireAuth, requirePermission('categories.create'), validate(createCategorySchema), categoryController.createCategory);
categoryRouter.put('/:id', requireAuth, requirePermission('categories.update'), categoryController.updateCategory);
categoryRouter.delete('/:id', requireAuth, requirePermission('categories.delete'), categoryController.deleteCategory);

export default router;
