import type { CreatePostData, PostRepository } from '../post.types.js';

export class PostService {
  constructor(private readonly repository: PostRepository) {}

  createPost(
    userId: string,
    data: CreatePostData,
    status: 'PUBLISHED' | 'FLAGGED',
    enqueueModeration: boolean,
  ) {
    return this.repository.createPost(userId, data, status, enqueueModeration);
  }

  getFeed(userId: string, page: number, limit: number) {
    return this.repository.getFeed(userId, page, limit);
  }

  createComment(
    userId: string,
    postId: string,
    content: string,
    parentId: string | null,
    status: 'PUBLISHED' | 'FLAGGED',
    enqueueModeration: boolean,
  ) {
    return this.repository.createComment(
      userId,
      postId,
      content,
      parentId,
      status,
      enqueueModeration,
    );
  }

  getComments(
    userId: string,
    postId: string,
    page: number,
    limit: number,
    sort: 'oldest' | 'newest' = 'oldest',
  ) {
    return this.repository.getComments(userId, postId, page, limit, sort);
  }

  postExists(postId: string, viewerId?: string) {
    return this.repository.postExists(postId, viewerId);
  }

  commentBelongsToPost(commentId: string, postId: string, viewerId?: string) {
    return this.repository.commentBelongsToPost(commentId, postId, viewerId);
  }

  likePost(userId: string, postId: string) {
    return this.repository.likePost(userId, postId);
  }

  unlikePost(userId: string, postId: string) {
    return this.repository.unlikePost(userId, postId);
  }

  likeComment(userId: string, commentId: string) {
    return this.repository.likeComment(userId, commentId);
  }

  unlikeComment(userId: string, commentId: string) {
    return this.repository.unlikeComment(userId, commentId);
  }

  incrementShare(postId: string) {
    return this.repository.incrementShare(postId);
  }
}
