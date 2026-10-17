import { updatePostDto } from '../posts/dto/post.dto.js';
import { Router } from 'express';
import { z } from '../../shared/zod.js';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import type { PrismaCommunityRepository } from './community.repository.js';
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};
const pageDto = z.strictObject(pagination);
const directoryDto = z.strictObject({
  ...pagination,
  q: z.string().trim().max(100).default(''),
  suggested: z.enum(['true', 'false']).default('false'),
});
const userDto = z.strictObject({ userId: z.uuid() });
const notificationDto = z.strictObject({ id: z.uuid() });
export function createCommunityRouter(auth: AuthUseCases, community: PrismaCommunityRepository) {
  const router = Router();
  router.use(authenticate(auth));
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.patch('/posts/:postId', requirePermission('post:update:own'), async (req, res) => {
    const { postId } = z.strictObject({ postId: z.uuid() }).parse(req.params);
    res.json({
      post: await community.editPost(
        res.locals.actor!.user.id,
        postId,
        updatePostDto.parse(req.body),
      ),
    });
  });
  router.delete('/posts/:postId', requirePermission('post:delete:own'), async (req, res) => {
    const { postId } = z.strictObject({ postId: z.uuid() }).parse(req.params);
    await community.deletePost(res.locals.actor!.user.id, postId);
    res.status(204).end();
  });
  router.post('/posts/:postId/share', requirePermission('post:create'), async (req, res) => {
    const { postId } = z.strictObject({ postId: z.uuid() }).parse(req.params);
    const { content, visibility } = z
      .strictObject({
        content: z.string().trim().max(2000).default(''),
        visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).default('PUBLIC'),
      })
      .parse(req.body ?? {});
    res.status(201).json({
      post: await community.repost(res.locals.actor!.user.id, postId, content, visibility),
    });
  });
  router.get('/search/posts', requirePermission('post:read'), async (req, res) => {
    const { q, page, limit } = z
      .strictObject({
        ...pagination,
        q: z.string().trim().min(1).max(100),
      })
      .parse(req.query);
    res.json(await community.searchPosts(res.locals.actor!.user.id, q, page, limit));
  });
  router.get('/posts/:postId/likes', requirePermission('post:read'), async (req, res) => {
    const { postId } = z.strictObject({ postId: z.uuid() }).parse(req.params);
    const { page, limit } = pageDto.parse(req.query);
    res.json(await community.likes(res.locals.actor!.user.id, postId, page, limit));
  });
  router.get('/posts/:postId', requirePermission('post:read'), async (req, res) => {
    const { postId } = z.strictObject({ postId: z.uuid() }).parse(req.params);
    res.json({ post: await community.post(res.locals.actor!.user.id, postId) });
  });
  router.get('/users', async (req, res) => {
    const { page, limit, q, suggested } = directoryDto.parse(req.query);
    res.json(
      await community.directory(res.locals.actor!.user.id, page, limit, q, suggested === 'true'),
    );
  });
  router.get('/users/:userId', async (req, res) => {
    const { userId } = userDto.parse(req.params);
    res.json({ user: await community.profile(res.locals.actor!.user.id, userId) });
  });
  router.get('/users/:userId/posts', async (req, res) => {
    const { userId } = userDto.parse(req.params);
    const { page, limit } = pageDto.parse(req.query);
    res.json(await community.userPosts(res.locals.actor!.user.id, userId, page, limit));
  });
  router.get('/notifications', async (req, res) => {
    const { page, limit } = pageDto.parse(req.query);
    res.json(await community.notifications(res.locals.actor!.user.id, page, limit));
  });
  router.get('/notifications/unread-count', async (_req, res) => {
    res.json(await community.unread(res.locals.actor!.user.id));
  });
  router.patch('/notifications/read-all', async (_req, res) => {
    res.json(await community.read(res.locals.actor!.user.id));
  });
  router.patch('/notifications/:id/read', async (req, res) => {
    const { id } = notificationDto.parse(req.params);
    res.json(await community.read(res.locals.actor!.user.id, id));
  });
  return router;
}
