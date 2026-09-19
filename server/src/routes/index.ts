import { Router } from 'express';

import authRoutes from './authRoutes';
import productRoutes, { categoryRouter } from './productRoutes';
import cartRoutes, { wishlistRouter } from './cartRoutes';
import orderRoutes from './orderRoutes';
import quoteRoutes from './quoteRoutes';
import equipmentRoutes from './equipmentRoutes';
import serviceRoutes from './serviceRoutes';
import technicianRoutes from './technicianRoutes';
import amcRoutes from './amcRoutes';
import reviewRoutes from './reviewRoutes';
import blogRoutes from './blogRoutes';
import { bannerRouter, galleryRouter, faqRouter } from './contentRoutes';
import couponRoutes from './couponRoutes';
import notificationRoutes from './notificationRoutes';
import customerRoutes, { staffRouter } from './customerRoutes';
import reportRoutes from './reportRoutes';
import { settingRouter, auditLogRouter } from './settingRoutes';
import uploadRoutes from './uploadRoutes';
import invoiceRoutes, { paymentRouter } from './invoiceRoutes';
import addressRoutes from './addressRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', customerRoutes); // customer profile lookups are exposed through /customers for admin; /users kept for spec parity
router.use('/products', productRoutes);
router.use('/categories', categoryRouter);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRouter);
router.use('/orders', orderRoutes);
router.use('/quotes', quoteRoutes);
router.use('/payments', paymentRouter);
router.use('/invoices', invoiceRoutes);
router.use('/amc', amcRoutes);
router.use('/services', serviceRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/technicians', technicianRoutes);
router.use('/reviews', reviewRoutes);
router.use('/blog', blogRoutes);
router.use('/banners', bannerRouter);
router.use('/gallery', galleryRouter);
router.use('/faqs', faqRouter);
router.use('/notifications', notificationRoutes);
router.use('/customers', customerRoutes);
router.use('/staff', staffRouter);
router.use('/reports', reportRoutes);
router.use('/coupons', couponRoutes);
router.use('/settings', settingRouter);
router.use('/audit-logs', auditLogRouter);
router.use('/uploads', uploadRoutes);
router.use('/addresses', addressRoutes);

export default router;
