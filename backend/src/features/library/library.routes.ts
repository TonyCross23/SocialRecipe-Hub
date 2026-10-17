import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from '../../shared/zod.js';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import type { LibraryRepository } from './library.repository.js';
const pageDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const targetDto = z.strictObject({ userId: z.uuid(), kind: z.enum(['BLOCK', 'MUTE']) });
const idDto = z.strictObject({ id: z.uuid() });
const tokenDto = z.strictObject({
  token: z
    .string()
    .regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/)
    .max(256),
});
export const shoppingListDto = z.strictObject({
  title: z.string().trim().min(1).max(200),
  items: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1).max(200),
        quantity: z.string().trim().max(100),
      }),
    )
    .min(1)
    .max(60),
});
export function createLibraryRouter(auth: AuthUseCases, library: LibraryRepository) {
  const router = Router();
  router.use(authenticate(auth));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 120,
      keyGenerator: (_req, res) => res.locals.actor!.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  router.get('/saved', requirePermission('post:read'), async (req, res) => {
    const { page, limit } = pageDto.parse(req.query);
    res.json(await library.saved(res.locals.actor!.user.id, page, limit));
  });
  router.put('/saved/:id', requirePermission('post:read'), async (req, res) => {
    res.json(await library.save(res.locals.actor!.user.id, idDto.parse(req.params).id, true));
  });
  router.delete('/saved/:id', async (req, res) => {
    res.json(await library.save(res.locals.actor!.user.id, idDto.parse(req.params).id, false));
  });
  router.get('/filters', async (req, res) => {
    const { page, limit, kind } = pageDto
      .extend({ kind: z.enum(['BLOCK', 'MUTE']) })
      .parse(req.query);
    res.json(await library.filters(res.locals.actor!.user.id, kind, page, limit));
  });
  router.get('/filters/:id', async (req, res) =>
    res.json(await library.filterState(res.locals.actor!.user.id, idDto.parse(req.params).id)),
  );
  router.put('/filters/:userId/:kind', async (req, res) => {
    const { userId, kind } = targetDto.parse(req.params);
    res.json(await library.setFilter(res.locals.actor!.user.id, userId, kind, true));
  });
  router.delete('/filters/:userId/:kind', async (req, res) => {
    const { userId, kind } = targetDto.parse(req.params);
    res.json(await library.setFilter(res.locals.actor!.user.id, userId, kind, false));
  });
  router.get('/shopping-lists', async (req, res) => {
    const { page, limit } = pageDto.parse(req.query);
    res.json(await library.shoppingLists(res.locals.actor!.user.id, page, limit));
  });
  router.post('/shopping-lists', async (req, res) =>
    res.status(201).json({
      list: await library.createShoppingList(
        res.locals.actor!.user.id,
        shoppingListDto.parse(req.body),
      ),
    }),
  );
  router.get('/shopping-lists/:id', async (req, res) =>
    res.json({
      list: await library.shoppingList(res.locals.actor!.user.id, idDto.parse(req.params).id),
    }),
  );
  router.delete('/shopping-lists/:id', async (req, res) => {
    await library.deleteList(res.locals.actor!.user.id, idDto.parse(req.params).id);
    res.status(204).end();
  });
  router.patch('/shopping-lists/:id/items/:itemId', async (req, res) => {
    const { id, itemId } = z.strictObject({ id: z.uuid(), itemId: z.uuid() }).parse(req.params);
    const { checked } = z.strictObject({ checked: z.boolean() }).parse(req.body);
    res.json(await library.checkItem(res.locals.actor!.user.id, id, itemId, checked));
  });
  router.post('/push-devices', async (req, res) => {
    const { user, sessionId } = res.locals.actor!;
    res
      .status(201)
      .json(await library.registerDevice(user.id, sessionId, tokenDto.parse(req.body).token));
  });
  router.delete('/push-devices', async (req, res) => {
    await library.unregisterDevice(res.locals.actor!.user.id, tokenDto.parse(req.body).token);
    res.status(204).end();
  });
  return router;
}
