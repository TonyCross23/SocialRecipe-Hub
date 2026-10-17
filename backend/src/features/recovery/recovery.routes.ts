import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from '../../shared/zod.js';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import type { RecoveryService } from './recovery.service.js';
const identity = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(128),
});
export function createRecoveryRouter(recovery: RecoveryService) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(
    ['/forgot-password', '/reset-password', '/appeals'],
    rateLimit({
      windowMs: 15 * 60000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  router.post('/forgot-password', async (req, res) => {
    const { email, language } = identity
      .omit({ password: true })
      .extend({ language: z.enum(['en', 'my']).default('en') })
      .parse(req.body);
    res.json(await recovery.forgot(email, language));
  });
  router.post('/reset-password', async (req, res) => {
    const { requestId, code, newPassword } = z
      .strictObject({
        requestId: z.uuid(),
        code: z.string().regex(/^\d{6}$/),
        newPassword: z.string().min(12).max(128),
      })
      .parse(req.body);
    await recovery.reset(requestId, code, newPassword);
    res.status(204).end();
  });
  router.post('/appeals', async (req, res) => {
    const { email, password, message } = identity
      .extend({ message: z.string().trim().min(20).max(2000) })
      .parse(req.body);
    res.status(201).json(await recovery.submitAppeal(email, password, message));
  });
  router.post('/appeals/status', async (req, res) => {
    const { email, password } = identity.parse(req.body);
    res.json(await recovery.appealStatus(email, password));
  });
  return router;
}
export function createAppealAdminRouter(auth: AuthUseCases, recovery: RecoveryService) {
  const router = Router();
  router.use(
    '/appeals',
    authenticate(auth),
    requirePermission('admin:read'),
    requirePermission('user:ban'),
  );
  router.get('/appeals', async (req, res) => {
    const { page, limit, status } = z
      .strictObject({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'STALE', 'ALL']).default('PENDING'),
      })
      .parse(req.query);
    res.json(await recovery.appeals(page, limit, status));
  });
  router.patch('/appeals/:id', async (req, res) => {
    const { id } = z.strictObject({ id: z.uuid() }).parse(req.params);
    const { decision, response } = z
      .strictObject({
        decision: z.enum(['APPROVED', 'REJECTED']),
        response: z.string().trim().min(1).max(1000),
      })
      .parse(req.body);
    res.json(await recovery.reviewAppeal(id, res.locals.actor!.user.id, decision, response));
  });
  return router;
}
