import { z } from '../../shared/zod.js';
import { registerDto } from './dto/auth.dto.js';
import type { RegistrationService } from '../registration/registration.service.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { changePasswordDto, updateProfileDto } from './dto/auth.dto.js';
import { AuthController } from './controllers/auth.controller.js';
import { authenticate } from './auth.middleware.js';
import type { AuthUseCases } from './use-cases/auth.use-cases.js';

export function createAuthRouter(auth: AuthUseCases, registration: RegistrationService) {
  const router = Router();
  const controller = new AuthController(auth);

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  const registrationLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  router.post('/register', registrationLimit, async (req, res) => {
    res
      .status(202)
      .json(await registration.start(registerDto.omit({ image: true }).parse(req.body)));
  });
  router.post('/register/verify', async (req, res) => {
    const { requestId, code } = z
      .strictObject({ requestId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
      .parse(req.body);
    res.status(201).json(await registration.verify(requestId, code));
  });
  router.post('/register/resend', registrationLimit, async (req, res) => {
    const { requestId } = z.strictObject({ requestId: z.uuid() }).parse(req.body);
    res.json(await registration.resend(requestId));
  });
  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.post(
    '/change-password',
    authenticate(auth),
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      keyGenerator: (_req, res) => res.locals.actor!.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    async (req, res) => {
      const { currentPassword, newPassword } = changePasswordDto.parse(req.body);
      const actor = res.locals.actor!;
      await auth.changePassword(actor.user.id, actor.user.email, currentPassword, newPassword);
      res.status(204).end();
    },
  );
  router.patch('/me', authenticate(auth), async (req, res) => {
    res.json(await auth.updateProfile(res.locals.actor!.user.id, updateProfileDto.parse(req.body)));
  });
  router.get('/me', authenticate(auth), controller.me);
  router.post('/logout', authenticate(auth), controller.logout);

  return router;
}
