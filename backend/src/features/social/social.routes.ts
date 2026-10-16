import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import { SocialController } from './controllers/social.controller.js';
import type { SocialUseCases } from './use-cases/social.use-cases.js';

export function createSocialRouter(auth: AuthUseCases, social: SocialUseCases) {
  const router = Router();
  const controller = new SocialController(social);

  router.use(authenticate(auth));
  router.get('/users/:userId/followers', controller.followers);
  router.get('/users/:userId/following', controller.following);
  router.put('/users/:userId/follow', requirePermission('follow:manage'), controller.follow);
  router.delete('/users/:userId/follow', requirePermission('follow:manage'), controller.unfollow);

  return router;
}
