import { Router } from 'express';
import * as cartController from '../controllers/cartController';
import * as wishlistController from '../controllers/wishlistController';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addToCartSchema, updateCartItemSchema } from '../validators/commerceValidators';

const router = Router();
router.use(requireAuth);

router.get('/', cartController.getCart);
router.post('/items', validate(addToCartSchema), cartController.addToCart);
router.put('/items/:productId', validate(updateCartItemSchema), cartController.updateCartItem);
router.delete('/items/:productId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);
router.post('/coupon', cartController.applyCoupon);

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);
wishlistRouter.get('/', wishlistController.getWishlist);
wishlistRouter.post('/', wishlistController.addToWishlist);
wishlistRouter.delete('/:productId', wishlistController.removeFromWishlist);

export default router;
