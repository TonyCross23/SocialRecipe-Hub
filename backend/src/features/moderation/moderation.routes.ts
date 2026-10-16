import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import { ModerationController } from './controllers/moderation.controller.js';
import type { ModerationUseCases } from './use-cases/moderation.use-cases.js';

export function createReportRouter(auth: AuthUseCases, moderation: ModerationUseCases) {
  const router = Router();
  const controller = new ModerationController(moderation);

  router.use(authenticate(auth));
  router.post('/', requirePermission('report:create'), controller.createReport);
  return router;
}

export function createModerationRouter(auth: AuthUseCases, moderation: ModerationUseCases) {
  const router = Router();
  const controller = new ModerationController(moderation);

  router.use(authenticate(auth));
  router.get('/reports', requirePermission('moderation:review'), controller.reports);
  router.patch(
    '/reports/:reportId',
    requirePermission('moderation:review'),
    controller.updateReport,
  );
  router.post(
    '/reports/:reportId/action',
    requirePermission('moderation:review'),
    controller.actionReport,
  );
  router.get('/policies', requirePermission('policy:manage'), controller.policies);
  router.put('/policies/:key', requirePermission('policy:manage'), controller.updatePolicy);

  return router;
}
