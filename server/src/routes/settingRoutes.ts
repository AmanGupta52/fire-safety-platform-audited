import { Router } from 'express';
import * as settingController from '../controllers/settingController';
import * as auditLogController from '../controllers/auditLogController';
import { requireAuth } from '../middleware/auth';
import { requirePermission, requireAnyPermission, requireRole } from '../middleware/rbac';

export const settingRouter = Router();
settingRouter.get('/public', settingController.getPublicSettings);
settingRouter.get('/', requireAuth, requireAnyPermission('settings.read', 'settings.manage'), settingController.listAllSettings);
settingRouter.get('/:key', requireAuth, requireAnyPermission('settings.read', 'settings.manage'), settingController.getSetting);
settingRouter.put('/:key', requireAuth, requireRole('super_admin'), settingController.updateSetting);

export const auditLogRouter = Router();
auditLogRouter.get('/', requireAuth, requirePermission('audit.read'), auditLogController.listAuditLogs);
auditLogRouter.get('/verify', requireAuth, requirePermission('audit.read'), auditLogController.verifyAuditLogChain);
