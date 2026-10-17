import { z } from '../../shared/zod.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import { chatDto, type AssistantService } from './assistant.service.js';
export function createAssistantRouter(auth: AuthUseCases, assistant: AssistantService) {
  const router = Router();
  router.use(authenticate(auth));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/status', (_req, res) =>
    res.json({ configured: assistant.configured, replyLanguage: assistant.replyLanguage }),
  );
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 10,
      keyGenerator: (_req, res) => res.locals.actor!.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  router.post('/chat', async (req, res) => {
    res.json(await assistant.chat(chatDto.parse(req.body)));
  });
  router.post('/shopping-list', async (req, res) => {
    const { source } = z
      .strictObject({ source: z.string().trim().min(1).max(8000) })
      .parse(req.body);
    res.json({ draft: await assistant.shoppingList(source) });
  });
  return router;
}
