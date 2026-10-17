import {
  createRecoveryRouter,
  createAppealAdminRouter,
} from '../features/recovery/recovery.routes.js';
import { createLibraryRouter } from '../features/library/library.routes.js';
import { createAssistantRouter } from '../features/assistant/assistant.routes.js';
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
import { createMediaRouter } from '../features/media/media.routes.js';
import { createCommunityRouter } from '../features/community/community.routes.js';

export function createRootRouter(
  services: ApplicationServices,
  getMonitoringSnapshot: () => MonitoringSnapshot,
) {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({ name: 'SocialRecipe API', version: 'v1', status: 'ok' });
  });

  const json = express.json({ limit: '32kb', strict: true });
  // The post DTO permits 20,000 characters plus ten image URLs. UTF-8 text
  // (e.g. Burmese), structured recipe steps and escapes exceed the default 32 KiB.
  const postJson = express.json({ limit: '512kb', strict: true });
  const chatJson = express.json({ limit: '128kb', strict: true });
  router.use((request, response, next) => {
    const creatingPost =
      (request.method === 'POST' && /^\/posts\/?$/.test(request.path)) ||
      (request.method === 'PATCH' && /^\/community\/posts\/[^/]+\/?$/.test(request.path));
    return (
      creatingPost
        ? postJson
        : request.method === 'POST' &&
            (/^\/assistant\/(chat|shopping-list)\/?$/.test(request.path) ||
              /^\/library\/shopping-lists\/?$/.test(request.path))
          ? chatJson
          : json
    )(request, response, next);
  });
  router.use('/auth', createRecoveryRouter(services.recovery));
  router.use('/admin', createAppealAdminRouter(services.auth, services.recovery));
  router.use(
    '/auth',
    createAuthRateLimiter(),
    createAuthRouter(services.auth, services.registration),
  );
  router.use('/media', createMediaRouter(services.auth, services.media));
  router.use('/assistant', createAssistantRouter(services.auth, services.assistant));
  router.use('/community', createCommunityRouter(services.auth, services.community));
  router.use('/library', createLibraryRouter(services.auth, services.library));
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
