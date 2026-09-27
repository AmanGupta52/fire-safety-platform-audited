import { Router } from 'express';
import * as settingController from '../controllers/settingController';
import * as auditLogController from '../controllers/auditLogController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

export const settingRouter = Router();
settingRouter.get('/public', settingController.getPublicSettings);
settingRouter.get('/', requireAuth, requirePermission('settings.manage'), settingController.listAllSettings);
settingRouter.get('/:key', requireAuth, requirePermission('settings.manage'), settingController.getSetting);
settingRouter.put('/:key', requireAuth, requirePermission('settings.manage'), settingController.updateSetting);

export const auditLogRouter = Router();
auditLogRouter.get('/', requireAuth, requirePermission('audit.read'), auditLogController.listAuditLogs);
