import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import { AdminController } from './controllers/admin.controller.js';
import type { AdminUseCases } from './use-cases/admin.use-cases.js';
import type { MonitoringSnapshot } from '../../monitoring.js';

export function createAdminRouter(
  auth: AuthUseCases,
  admin: AdminUseCases,
  getMonitoringSnapshot: () => MonitoringSnapshot,
) {
  const router = Router();
  const controller = new AdminController(admin, getMonitoringSnapshot);

  router.use(authenticate(auth), requirePermission('admin:read'));
  router.get('/dashboard', controller.dashboard);
  router.get('/monitoring', controller.monitoring);
  router.get('/audit-logs', requirePermission('moderation:review'), controller.auditLogs);
  router.post(
    '/audit-logs/:jobId/override',
    requirePermission('moderation:review'),
    controller.overrideAuditLog,
  );
  router.get('/users', controller.users);
  router.patch('/users/:userId/ban', requirePermission('user:ban'), controller.banUser);
  router.delete('/users/:userId/ban', requirePermission('user:ban'), controller.unbanUser);
  router.get('/notifications', controller.notifications);
  router.patch('/notifications/read-all', controller.readAllNotifications);
  router.patch('/notifications/:notificationId/read', controller.readNotification);

  return router;
}
