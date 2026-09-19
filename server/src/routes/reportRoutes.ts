import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();
router.use(requireAuth, requirePermission('reports.read'));

router.get('/dashboard', reportController.dashboardSummary);
router.get('/revenue-chart', reportController.revenueChart);
router.get('/sales-by-category', reportController.salesByCategory);
router.get('/top-products', reportController.topProducts);
router.get('/top-customers', reportController.topCustomers);
router.get('/amc-renewal-rate', reportController.amcRenewalRate);
router.get('/service-completion-rate', reportController.serviceCompletionRate);
router.get('/export/orders.csv', reportController.exportOrdersCsv);

export default router;
