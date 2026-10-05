import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { requireAuth } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/rbac';

const router = Router();

// Global search sits ABOVE the blanket reports.read guard: it needs only a signed-in staff account, and the
// controller filters each result group by that user's own permissions.
router.get('/global-search', requireAuth, requireAnyPermission('orders.read', 'customers.read', 'service_bookings.read', 'products.read'), reportController.globalSearch);

router.use(requireAuth, requirePermission('reports.read'));

router.get('/dashboard', reportController.dashboardSummary);
router.get('/dashboard-v2', reportController.dashboardV2);
router.get('/revenue-chart', reportController.revenueChart);
router.get('/sales-by-category', reportController.salesByCategory);
router.get('/top-products', reportController.topProducts);
router.get('/top-customers', reportController.topCustomers);
router.get('/amc-renewal-rate', reportController.amcRenewalRate);
router.get('/service-completion-rate', reportController.serviceCompletionRate);
router.get('/export/orders.csv', reportController.exportOrdersCsv);

export default router;
