import type { RecipeDetails } from '../recipes/recipe.dto.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError, notFound } from '../../errors.js';
import type { ContentModerationService } from '../posts/services/moderation.service.js';
import { visiblePosts, visibleUsers, visibleNotifications } from '../posts/post-access.js';
import type { Page, PostView } from '../posts/post.types.js';
export interface CommunityPostReader {
  getSavedPosts(viewer: string, page: number, limit: number): Promise<Page<PostView>>;
  searchPosts(viewer: string, q: string, page: number, limit: number): Promise<Page<PostView>>;
  getPost(viewer: string, postId: string): Promise<PostView | null>;
  getUserPosts(viewer: string, user: string, page: number, limit: number): Promise<Page<PostView>>;
}
export class PrismaCommunityRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly posts: CommunityPostReader,
    private readonly moderation: ContentModerationService,
  ) {}
  async editPost(
    viewer: string,
    postId: string,
    input: {
      title: string;
      content: string;
      images: string[];
      visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
      expectedUpdatedAt: string;
      recipe?: RecipeDetails | null;
    },
  ) {
    const current = await this.db.post.findFirst({
      where: { id: postId, userId: viewer, status: { not: 'DELETED' } },
    });
    if (!current) throw notFound('Post');
    if (current.status === 'BANNED')
      throw new AppError(409, 'POST_BANNED', 'This post is restricted and cannot be edited.');
    if (current.updatedAt.getTime() !== Date.parse(input.expectedUpdatedAt))
      throw new AppError(409, 'POST_CHANGED', 'This post has changed. Reopen it before editing.');
    if (
      current.isRepost
        ? input.images.length > 0 || input.content.length > 2000
        : !input.content && !input.images.length
    )
      throw new AppError(
        400,
        'INVALID_POST',
        current.isRepost
          ? 'A share caption can contain up to 2000 characters and no extra photos.'
          : 'Add text or at least one photo.',
      );
    if (current.isRepost && input.recipe)
      throw new AppError(400, 'INVALID_POST', 'Shared posts cannot contain extra recipe details.');
    const title = current.isRepost ? 'Shared post' : input.title;
    const recipeToReview = input.recipe === undefined ? current.recipe : input.recipe;
    const decision = await this.moderation.evaluate(
      `${title}\n${input.content}\n${recipeToReview ? JSON.stringify(recipeToReview) : ''}`,
    );
    await this.db.$transaction(async (tx) => {
      const changed = await tx.post.updateMany({
        where: {
          id: postId,
          userId: viewer,
          updatedAt: current.updatedAt,
          status: { notIn: ['DELETED', 'BANNED'] },
        },
        data: {
          title,
          ...(input.recipe !== undefined ? { recipe: input.recipe ?? Prisma.DbNull } : {}),
          content: input.content,
          images: input.images,
          visibility: input.visibility,
          status: current.status === 'FLAGGED' ? 'FLAGGED' : decision.status,
          updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
        },
      });
      if (!changed.count)
        throw new AppError(409, 'POST_CHANGED', 'This post has changed. Reopen it before editing.');
      await tx.moderationJob.updateMany({
        where: { postId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'FAILED', lockedAt: null, lastError: 'Superseded by post edit' },
      });
      if (decision.enqueueAiModeration) await tx.moderationJob.create({ data: { postId } });
      if (decision.status === 'FLAGGED' && current.status !== 'FLAGGED') {
        const reviewers = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            role: { permissions: { some: { permission: { name: 'moderation:review' } } } },
          },
          select: { id: true },
        });
        if (reviewers.length)
          await tx.notification.createMany({
            data: reviewers.map(({ id }) => ({
              userId: id,
              type: 'FLAGGED_CONTENT',
              title: 'Edited post flagged by policy',
              message: 'An edited post needs review.',
              data: { postId },
            })),
          });
      }
    });
    return this.post(viewer, postId);
  }

  async deletePost(viewer: string, postId: string) {
    await this.db.$transaction(async (tx) => {
      const changed = await tx.post.updateMany({
        where: { id: postId, userId: viewer },
        data: { status: 'DELETED' },
      });
      if (!changed.count) throw notFound('Post');
      await tx.moderationJob.updateMany({
        where: { postId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'FAILED', lockedAt: null, lastError: 'Post deleted by owner' },
      });
    });
  }

  async repost(
    viewer: string,
    postId: string,
    content: string,
    visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE',
  ) {
    const decision = await this.moderation.evaluate(content);
    return this.db.$transaction(async (tx) => {
      const source = await tx.post.findFirst({
        where: { AND: [visiblePosts(viewer), { id: postId }] },
      });
      if (!source) throw notFound('Post');
      const original = source.isRepost
        ? source.sharedPostId
          ? await tx.post.findUnique({ where: { id: source.sharedPostId } })
          : null
        : source;
      if (
        !original ||
        original.visibility !== 'PUBLIC' ||
        original.status !== 'PUBLISHED' ||
        source.status !== 'PUBLISHED'
      )
        throw new AppError(409, 'POST_NOT_SHAREABLE', 'Only available public posts can be shared.');
      const post = await tx.post.create({
        data: {
          userId: viewer,
          title: 'Shared post',
          content,
          images: [],
          visibility,
          isRepost: true,
          sharedPostId: original.id,
          status: decision.status,
        },
      });
      await tx.post.update({ where: { id: original.id }, data: { sharesCount: { increment: 1 } } });
      if (decision.enqueueAiModeration)
        await tx.moderationJob.create({ data: { postId: post.id } });
      if (decision.status === 'FLAGGED') {
        const reviewers = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            role: { permissions: { some: { permission: { name: 'moderation:review' } } } },
          },
          select: { id: true },
        });
        if (reviewers.length)
          await tx.notification.createMany({
            data: reviewers.map(({ id }) => ({
              userId: id,
              type: 'FLAGGED_CONTENT',
              title: 'Shared post flagged by policy',
              message: 'A share caption matched a banned keyword and needs review.',
              data: { postId: post.id },
            })),
          });
      }
      if (original.userId !== viewer && decision.status === 'PUBLISHED') {
        const actor = await tx.user.findUniqueOrThrow({
          where: { id: viewer },
          select: { id: true, name: true, image: true },
        });
        await tx.notification.create({
          data: {
            userId: original.userId,
            actorId: viewer,
            type: 'SHARE',
            title: 'New share',
            message: `${actor.name} shared your post.`,
            data: { postId: original.id, actor },
          },
        });
      }
      return { id: post.id, status: post.status };
    });
  }

  async searchPosts(viewer: string, q: string, page: number, limit: number) {
    return this.posts.searchPosts(viewer, q, page, limit);
  }

  async post(viewer: string, postId: string) {
    const post = await this.posts.getPost(viewer, postId);
    if (!post) throw notFound('Post');
    return post;
  }

  async likes(viewer: string, postId: string, page: number, limit: number) {
    if (!(await this.db.post.count({ where: { AND: [visiblePosts(viewer), { id: postId }] } })))
      throw notFound('Post');
    const where = { postId, user: visibleUsers(viewer) };
    const [items, total] = await this.db.$transaction([
      this.db.like.findMany({
        where,
        include: { user: { select: this.userSelect(viewer) } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.like.count({ where }),
    ]);
    return {
      data: items.map((item) => ({ ...toUser(item.user), likedAt: item.createdAt })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private userSelect(viewer: string) {
    return {
      id: true,
      name: true,
      image: true,
      followers: { where: { followerId: viewer }, select: { followerId: true }, take: 1 },
      _count: {
        select: { followers: true, following: true, posts: { where: visiblePosts(viewer) } },
      },
    } as const;
  }
  async directory(viewer: string, page: number, limit: number, search: string, suggested: boolean) {
    const where: Prisma.UserWhereInput = {
      id: { not: viewer },
      ...visibleUsers(viewer),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(suggested ? { followers: { none: { followerId: viewer } } } : {}),
    };
    const [users, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: this.userSelect(viewer),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.user.count({ where }),
    ]);
    return {
      data: users.map(toUser),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async profile(viewer: string, userId: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId, ...visibleUsers(viewer) },
      select: this.userSelect(viewer),
    });
    if (!user) throw notFound('User');
    return toUser(user);
  }
  async userPosts(viewer: string, userId: string, page: number, limit: number) {
    if (!(await this.db.user.count({ where: { id: userId, ...visibleUsers(viewer) } })))
      throw notFound('User');
    return this.posts.getUserPosts(viewer, userId, page, limit);
  }
  async notifications(userId: string, page: number, limit: number) {
    const where = visibleNotifications(userId);
    const [data, total, unreadCount] = await this.db.$transaction([
      this.db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.notification.count({ where }),
      this.db.notification.count({ where: { ...visibleNotifications(userId), readAt: null } }),
    ]);
    return {
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async unread(userId: string) {
    const [unreadCount, latestNotification] = await this.db.$transaction([
      this.db.notification.count({ where: { ...visibleNotifications(userId), readAt: null } }),
      this.db.notification.findFirst({
        where: { ...visibleNotifications(userId), readAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);
    return { unreadCount, latestNotification };
  }
  async read(userId: string, id?: string) {
    if (id) {
      const result = await this.db.notification.updateMany({
        where: { id, userId },
        data: { readAt: new Date() },
      });
      if (!result.count) throw notFound('Notification');
      return { updated: result.count };
    }
    return {
      updated: (
        await this.db.notification.updateMany({
          where: { ...visibleNotifications(userId), readAt: null },
          data: { readAt: new Date() },
        })
      ).count,
    };
  }
}
function toUser(user: {
  id: string;
  name: string;
  image: string | null;
  followers: unknown[];
  _count: { followers: number; following: number; posts: number };
}) {
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    isFollowing: user.followers.length > 0,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    postsCount: user._count.posts,
  };
}
