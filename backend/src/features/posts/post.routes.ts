import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import { PostController } from './controllers/post.controller.js';
import type { PostUseCases } from './use-cases/post.use-cases.js';

export function createPostRouter(auth: AuthUseCases, posts: PostUseCases) {
  const router = Router();
  const controller = new PostController(posts);

  router.use(authenticate(auth));
  router.get('/feed', requirePermission('post:read'), controller.feed);
  router.post('/', requirePermission('post:create'), controller.create);
  router.put('/:postId/likes', requirePermission('like:create'), controller.likePost);
  router.delete('/:postId/likes', requirePermission('like:create'), controller.unlikePost);
  router.get('/:postId/comments', requirePermission('post:read'), controller.comments);
  router.post('/:postId/comments', requirePermission('comment:create'), controller.createComment);
  router.put(
    '/:postId/comments/:commentId/likes',
    requirePermission('like:create'),
    controller.likeComment,
  );
  router.delete(
    '/:postId/comments/:commentId/likes',
    requirePermission('like:create'),
    controller.unlikeComment,
  );
  router.post('/:postId/share', requirePermission('post:read'), controller.share);

  return router;
}
