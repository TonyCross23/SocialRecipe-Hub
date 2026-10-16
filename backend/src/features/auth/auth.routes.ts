import { Router } from 'express';
import { AuthController } from './controllers/auth.controller.js';
import { authenticate } from './auth.middleware.js';
import type { AuthUseCases } from './use-cases/auth.use-cases.js';

export function createAuthRouter(auth: AuthUseCases) {
  const router = Router();
  const controller = new AuthController(auth);

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.get('/me', authenticate(auth), controller.me);
  router.post('/logout', authenticate(auth), controller.logout);

  return router;
}
