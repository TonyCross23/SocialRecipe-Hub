import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { CommentView, CreatePostData, Page, PostRepository, PostView } from '../post.types.js';

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
        data: { ...data, userId, status },
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
    const where: Prisma.PostWhereInput = {
      status: { notIn: ['DELETED', 'BANNED'] },
      OR: [
        { visibility: 'PUBLIC' },
        { userId },
        {
          visibility: 'FOLLOWERS',
          user: { followers: { some: { followerId: userId } } },
        },
      ],
    };
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

    return toPage(posts.map(toPostView), page, limit, total);
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

  async getComments(userId: string, postId: string, page: number, limit: number) {
    const where: Prisma.CommentWhereInput = {
      postId,
      status: { notIn: ['DELETED', 'BANNED'] },
    };
    const [comments, total] = await this.database.$transaction([
      this.database.comment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: commentViewInclude(userId),
      }),
      this.database.comment.count({ where }),
    ]);

    return toPage(comments.map(toCommentView), page, limit, total);
  }

  async postExists(postId: string) {
    return (
      (await this.database.post.count({
        where: { id: postId, status: { notIn: ['DELETED', 'BANNED'] } },
      })) > 0
    );
  }

  async commentBelongsToPost(commentId: string, postId: string) {
    return (
      (await this.database.comment.count({
        where: { id: commentId, postId, status: { notIn: ['DELETED', 'BANNED'] } },
      })) > 0
    );
  }

  async likePost(userId: string, postId: string) {
    await this.database.like.upsert({
      where: { userId_postId: { userId, postId } },
      update: {},
      create: { userId, postId },
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

  private async findPostView(
    database: Prisma.TransactionClient,
    postId: string,
    currentUserId: string,
  ) {
    const post = await database.post.findUniqueOrThrow({
      where: { id: postId },
      include: postViewInclude(currentUserId),
    });

    return toPostView(post);
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
