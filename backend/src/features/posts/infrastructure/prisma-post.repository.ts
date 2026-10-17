import { recipeDto } from '../../recipes/recipe.dto.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { CommentView, CreatePostData, Page, PostRepository, PostView } from '../post.types.js';
import { visiblePosts, visibleUsers } from '../post-access.js';

const authorSelect = { id: true, name: true, image: true } as const;

export class PrismaPostRepository implements PostRepository {
  constructor(private readonly database: PrismaClient) {}

  async getModerationPolicy() {
    const settings = await this.database.policySetting.findMany({
      where: { key: { in: ['moderation.enabled', 'moderation.bannedKeywords'] } },
      select: { key: true, value: true },
    });
    const values = new Map(settings.map((setting) => [setting.key, setting.value]));
    const enabledValue = values.get('moderation.enabled');
    const keywordsValue = values.get('moderation.bannedKeywords');

    return {
      enabled: enabledValue === true,
      bannedKeywords: Array.isArray(keywordsValue)
        ? keywordsValue.filter((value): value is string => typeof value === 'string')
        : [],
    };
  }

  async createPost(
    userId: string,
    data: CreatePostData,
    status: 'PUBLISHED' | 'FLAGGED',
    enqueueModeration: boolean,
  ) {
    return this.database.$transaction(async (transaction) => {
      const post = await transaction.post.create({
        data: { ...data, recipe: data.recipe ?? Prisma.DbNull, userId, status },
      });

      if (enqueueModeration) {
        await transaction.moderationJob.create({ data: { postId: post.id } });
      }
      if (status === 'FLAGGED') {
        await notifyReviewers(
          transaction,
          'FLAGGED_CONTENT',
          'Post flagged by policy',
          'A post matched a banned keyword and needs review.',
          { postId: post.id },
        );
      }

      return this.findPostView(transaction, post.id, userId);
    });
  }

  async getFeed(userId: string, page: number, limit: number) {
    const where = visiblePosts(userId, true);
    const [posts, total] = await this.database.$transaction([
      this.database.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: postViewInclude(userId),
      }),
      this.database.post.count({ where }),
    ]);

    return toPage(await this.withOriginals(this.database, posts, userId), page, limit, total);
  }

  async getSavedPosts(viewerId: string, page: number, limit: number) {
    const where = { userId: viewerId, post: visiblePosts(viewerId) };
    const [saved, total] = await this.database.$transaction([
      this.database.savedPost.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { post: { include: postViewInclude(viewerId) } },
      }),
      this.database.savedPost.count({ where }),
    ]);
    return toPage(
      await this.withOriginals(
        this.database,
        saved.map((s) => s.post),
        viewerId,
      ),
      page,
      limit,
      total,
    );
  }

  async searchPosts(viewerId: string, q: string, page: number, limit: number) {
    const where: Prisma.PostWhereInput = {
      AND: [
        visiblePosts(viewerId),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    };
    const [posts, total] = await this.database.$transaction([
      this.database.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: postViewInclude(viewerId),
      }),
      this.database.post.count({ where }),
    ]);
    return toPage(await this.withOriginals(this.database, posts, viewerId), page, limit, total);
  }

  async getPost(viewerId: string, postId: string) {
    const post = await this.database.post.findFirst({
      where: { AND: [visiblePosts(viewerId), { id: postId }] },
      include: postViewInclude(viewerId),
    });
    return post ? (await this.withOriginals(this.database, [post], viewerId))[0]! : null;
  }

  async getUserPosts(viewerId: string, userId: string, page: number, limit: number) {
    const where: Prisma.PostWhereInput = { ...visiblePosts(viewerId), userId };
    const [posts, total] = await this.database.$transaction([
      this.database.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: postViewInclude(viewerId),
      }),
      this.database.post.count({ where }),
    ]);
    return toPage(await this.withOriginals(this.database, posts, viewerId), page, limit, total);
  }

  async createComment(
    userId: string,
    postId: string,
    content: string,
    parentId: string | null,
    status: 'PUBLISHED' | 'FLAGGED',
    enqueueModeration: boolean,
  ) {
    return this.database.$transaction(async (transaction) => {
      const comment = await transaction.comment.create({
        data: { userId, postId, content, parentId, status },
      });

      if (enqueueModeration) {
        await transaction.moderationJob.create({ data: { commentId: comment.id } });
      }
      if (status === 'PUBLISHED') {
        const post = await transaction.post.findUniqueOrThrow({
          where: { id: postId },
          select: { userId: true },
        });
        if (post.userId !== userId) {
          const actor = await transaction.user.findUniqueOrThrow({
            where: { id: userId },
            select: authorSelect,
          });
          await transaction.notification.create({
            data: {
              userId: post.userId,
              actorId: userId,
              type: 'COMMENT',
              title: 'New comment',
              message: `${actor.name} commented on your post.`,
              data: { postId, commentId: comment.id, actor },
            },
          });
        }
      }
      if (status === 'FLAGGED') {
        await notifyReviewers(
          transaction,
          'FLAGGED_CONTENT',
          'Comment flagged by policy',
          'A comment matched a banned keyword and needs review.',
          { commentId: comment.id, postId },
        );
      }

      return this.findCommentView(transaction, comment.id, userId);
    });
  }

  async getComments(
    userId: string,
    postId: string,
    page: number,
    limit: number,
    sort: 'oldest' | 'newest' = 'oldest',
  ) {
    const where: Prisma.CommentWhereInput = {
      postId,
      user: visibleUsers(userId),
      status: { notIn: ['DELETED', 'BANNED'] },
    };
    const [comments, total] = await this.database.$transaction([
      this.database.comment.findMany({
        where,
        orderBy: [
          { createdAt: sort === 'newest' ? 'desc' : 'asc' },
          { id: sort === 'newest' ? 'desc' : 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: commentViewInclude(userId),
      }),
      this.database.comment.count({ where }),
    ]);

    return toPage(comments.map(toCommentView), page, limit, total);
  }

  async postExists(postId: string, viewerId?: string) {
    return (
      (await this.database.post.count({
        where: {
          AND: [
            { id: postId },
            viewerId ? visiblePosts(viewerId) : { status: { notIn: ['DELETED', 'BANNED'] } },
          ],
        },
      })) > 0
    );
  }

  async commentBelongsToPost(commentId: string, postId: string, viewerId?: string) {
    return (
      (await this.database.comment.count({
        where: {
          id: commentId,
          postId,
          ...(viewerId ? { user: visibleUsers(viewerId) } : {}),
          status: { notIn: ['DELETED', 'BANNED'] },
        },
      })) > 0
    );
  }

  async likePost(userId: string, postId: string) {
    await this.database.$transaction(async (transaction) => {
      const result = await transaction.like.createMany({
        data: [{ userId, postId }],
        skipDuplicates: true,
      });
      if (result.count) {
        const post = await transaction.post.findUniqueOrThrow({
          where: { id: postId },
          select: { userId: true },
        });
        if (post.userId !== userId) {
          const actor = await transaction.user.findUniqueOrThrow({
            where: { id: userId },
            select: authorSelect,
          });
          await transaction.notification.create({
            data: {
              userId: post.userId,
              actorId: userId,
              type: 'LIKE',
              title: 'New like',
              message: `${actor.name} liked your post.`,
              data: { postId, actor },
            },
          });
        }
      }
    });
  }

  async unlikePost(userId: string, postId: string) {
    await this.database.like.deleteMany({ where: { userId, postId } });
  }

  async likeComment(userId: string, commentId: string) {
    await this.database.like.upsert({
      where: { userId_commentId: { userId, commentId } },
      update: {},
      create: { userId, commentId },
    });
  }

  async unlikeComment(userId: string, commentId: string) {
    await this.database.like.deleteMany({ where: { userId, commentId } });
  }

  async incrementShare(postId: string) {
    const result = await this.database.post.updateMany({
      where: { id: postId, status: { notIn: ['DELETED', 'BANNED'] } },
      data: { sharesCount: { increment: 1 } },
    });

    if (result.count === 0) {
      return null;
    }

    const post = await this.database.post.findUniqueOrThrow({
      where: { id: postId },
      select: { sharesCount: true },
    });

    return post.sharesCount;
  }

  private async withOriginals(
    db: PrismaClient | Prisma.TransactionClient,
    posts: Array<
      Parameters<typeof toPostView>[0] & { isRepost: boolean; sharedPostId: string | null }
    >,
    viewerId: string,
  ) {
    const ids = posts.flatMap((post) => (post.sharedPostId ? [post.sharedPostId] : []));
    const originals = ids.length
      ? await db.post.findMany({
          where: {
            AND: [
              visiblePosts(viewerId),
              { id: { in: ids }, status: 'PUBLISHED', user: { status: 'ACTIVE' } },
            ],
          },
          include: postViewInclude(viewerId),
        })
      : [];
    const byId = new Map(originals.map((post) => [post.id, toPostView(post)]));
    return posts.map((post) => ({
      ...toPostView(post),
      isRepost: post.isRepost,
      sharedPost: post.sharedPostId ? (byId.get(post.sharedPostId) ?? null) : null,
    }));
  }

  private async findPostView(
    database: Prisma.TransactionClient,
    postId: string,
    currentUserId: string,
  ) {
    const post = await database.post.findUniqueOrThrow({
      where: { id: postId },
      include: postViewInclude(currentUserId),
    });

    return (await this.withOriginals(database, [post], currentUserId))[0]!;
  }

  private async findCommentView(
    database: Prisma.TransactionClient,
    commentId: string,
    currentUserId: string,
  ) {
    const comment = await database.comment.findUniqueOrThrow({
      where: { id: commentId },
      include: commentViewInclude(currentUserId),
    });

    return toCommentView(comment);
  }
}

function postViewInclude(currentUserId: string) {
  return {
    user: { select: authorSelect },
    savedBy: { where: { userId: currentUserId }, select: { userId: true } },
    likes: { where: { userId: currentUserId }, select: { id: true } },
    _count: { select: { likes: true, comments: true } },
  } as const;
}

function commentViewInclude(currentUserId: string) {
  return {
    user: { select: authorSelect },
    likes: { where: { userId: currentUserId }, select: { id: true } },
    _count: { select: { likes: true, replies: true } },
  } as const;
}

function toPostView(post: {
  id: string;
  title: string;
  content: string;
  images: string[];
  sharesCount: number;
  recipe?: unknown;
  savedBy?: Array<{ userId: string }>;
  status: PostView['status'];
  visibility: PostView['visibility'];
  createdAt: Date;
  updatedAt: Date;
  user: PostView['author'];
  likes: Array<{ id: string }>;
  _count: { likes: number; comments: number };
}): PostView {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    images: post.images,
    sharesCount: post.sharesCount,
    recipe: recipeDto.safeParse(post.recipe).data ?? null,
    savedByCurrentUser: Boolean(post.savedBy?.length),
    status: post.status,
    visibility: post.visibility,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.user,
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    likedByCurrentUser: post.likes.length > 0,
  };
}

function toCommentView(comment: {
  id: string;
  content: string;
  status: CommentView['status'];
  postId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: CommentView['author'];
  likes: Array<{ id: string }>;
  _count: { likes: number; replies: number };
}): CommentView {
  return {
    id: comment.id,
    content: comment.content,
    status: comment.status,
    postId: comment.postId,
    parentId: comment.parentId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.user,
    likesCount: comment._count.likes,
    repliesCount: comment._count.replies,
    likedByCurrentUser: comment.likes.length > 0,
  };
}

function toPage<T>(data: T[], page: number, limit: number, total: number): Page<T> {
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function notifyReviewers(
  database: Prisma.TransactionClient,
  type: string,
  title: string,
  message: string,
  data: Prisma.InputJsonValue,
) {
  const reviewers = await database.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { permissions: { some: { permission: { name: 'moderation:review' } } } },
    },
    select: { id: true },
  });
  if (reviewers.length > 0) {
    await database.notification.createMany({
      data: reviewers.map(({ id }) => ({ userId: id, type, title, message, data })),
    });
  }
}
