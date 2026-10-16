import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ApplicationServices } from '../container.js';
import { createAuthRouter } from '../features/auth/auth.routes.js';
import {
  createModerationRouter,
  createReportRouter,
} from '../features/moderation/moderation.routes.js';
import { createPostRouter } from '../features/posts/post.routes.js';
import { createSocialRouter } from '../features/social/social.routes.js';
import type { MonitoringSnapshot } from '../monitoring.js';
import { createAdminRouter } from '../features/admin/admin.routes.js';

export function createRootRouter(
  services: ApplicationServices,
  getMonitoringSnapshot: () => MonitoringSnapshot,
) {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({ name: 'SocialRecipe API', version: 'v1', status: 'ok' });
  });

  router.use(express.json({ limit: '32kb', strict: true }));
  router.use('/auth', createAuthRateLimiter(), createAuthRouter(services.auth));
  router.use('/social', createSocialRouter(services.auth, services.social));
  router.use('/posts', createPostRouter(services.auth, services.posts));
  router.use('/reports', createReportRouter(services.auth, services.moderation));
  router.use('/admin', createAdminRouter(services.auth, services.admin, getMonitoringSnapshot));
  router.use('/moderation', createModerationRouter(services.auth, services.moderation));

  return router;
}

function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many requests; try again later' },
    },
  });
}
