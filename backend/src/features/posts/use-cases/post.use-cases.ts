import { notFound } from '../../../errors.js';
import type { CreatePostData } from '../post.types.js';
import type { ContentModerationService } from '../services/moderation.service.js';
import type { PostService } from '../services/post.service.js';

export class PostUseCases {
  constructor(
    private readonly posts: PostService,
    private readonly moderation: ContentModerationService,
  ) {}

  async createPost(userId: string, data: CreatePostData) {
    const decision = await this.moderation.evaluate(
      `${data.title}\n${data.content}\n${data.recipe ? JSON.stringify(data.recipe) : ''}`,
    );

    return this.posts.createPost(userId, data, decision.status, decision.enqueueAiModeration);
  }

  getFeed(userId: string, page: number, limit: number) {
    return this.posts.getFeed(userId, page, limit);
  }

  async createComment(userId: string, postId: string, content: string, parentId: string | null) {
    await this.ensurePostExists(postId, userId);

    if (parentId && !(await this.posts.commentBelongsToPost(parentId, postId, userId))) {
      throw notFound('Parent comment');
    }

    const decision = await this.moderation.evaluate(content);
    return this.posts.createComment(
      userId,
      postId,
      content,
      parentId,
      decision.status,
      decision.enqueueAiModeration,
    );
  }

  async getComments(
    userId: string,
    postId: string,
    page: number,
    limit: number,
    sort: 'oldest' | 'newest' = 'oldest',
  ) {
    await this.ensurePostExists(postId, userId);
    return this.posts.getComments(userId, postId, page, limit, sort);
  }

  async likePost(userId: string, postId: string) {
    await this.ensurePostExists(postId, userId);
    await this.posts.likePost(userId, postId);
    return { liked: true };
  }

  async unlikePost(userId: string, postId: string) {
    await this.ensurePostExists(postId, userId);
    await this.posts.unlikePost(userId, postId);
    return { liked: false };
  }

  async likeComment(userId: string, postId: string, commentId: string) {
    await this.ensureCommentExists(postId, commentId, userId);
    await this.posts.likeComment(userId, commentId);
    return { liked: true };
  }

  async unlikeComment(userId: string, postId: string, commentId: string) {
    await this.ensureCommentExists(postId, commentId, userId);
    await this.posts.unlikeComment(userId, commentId);
    return { liked: false };
  }

  async share(postId: string, viewerId?: string) {
    if (viewerId) await this.ensurePostExists(postId, viewerId);
    const sharesCount = await this.posts.incrementShare(postId);
    if (sharesCount === null) {
      throw notFound('Post');
    }

    return { sharesCount };
  }

  private async ensurePostExists(postId: string, userId: string) {
    if (!(await this.posts.postExists(postId, userId))) {
      throw notFound('Post');
    }
  }

  private async ensureCommentExists(postId: string, commentId: string, userId: string) {
    await this.ensurePostExists(postId, userId);
    if (!(await this.posts.commentBelongsToPost(commentId, postId, userId))) {
      throw notFound('Comment');
    }
  }
}
