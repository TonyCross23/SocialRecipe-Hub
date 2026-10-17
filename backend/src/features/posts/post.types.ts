import type { RecipeDetails } from '../recipes/recipe.dto.js';
import type { PostStatus, PostVisibility } from '../../generated/prisma/enums.js';

export interface ContentAuthor {
  id: string;
  name: string;
  image: string | null;
}

export interface PostView {
  recipe?: RecipeDetails | null;
  savedByCurrentUser?: boolean;
  isRepost?: boolean;
  sharedPost?: PostView | null;
  id: string;
  title: string;
  content: string;
  images: string[];
  sharesCount: number;
  status: PostStatus;
  visibility: PostVisibility;
  createdAt: Date;
  updatedAt: Date;
  author: ContentAuthor;
  likesCount: number;
  commentsCount: number;
  likedByCurrentUser: boolean;
}

export interface CommentView {
  id: string;
  content: string;
  status: PostStatus;
  postId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: ContentAuthor;
  likesCount: number;
  repliesCount: number;
  likedByCurrentUser: boolean;
}

export interface Page<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePostData {
  recipe?: RecipeDetails | null;
  title: string;
  content: string;
  images: string[];
  visibility: PostVisibility;
}

export interface ModerationPolicy {
  enabled: boolean;
  bannedKeywords: string[];
}

export interface PostRepository {
  getModerationPolicy(): Promise<ModerationPolicy>;
  createPost(
    userId: string,
    data: CreatePostData,
    status: PostStatus,
    enqueueModeration: boolean,
  ): Promise<PostView>;
  getFeed(userId: string, page: number, limit: number): Promise<Page<PostView>>;
  createComment(
    userId: string,
    postId: string,
    content: string,
    parentId: string | null,
    status: PostStatus,
    enqueueModeration: boolean,
  ): Promise<CommentView>;
  getComments(
    userId: string,
    postId: string,
    page: number,
    limit: number,
    sort?: 'oldest' | 'newest',
  ): Promise<Page<CommentView>>;
  postExists(postId: string, viewerId?: string): Promise<boolean>;
  commentBelongsToPost(commentId: string, postId: string, viewerId?: string): Promise<boolean>;
  likePost(userId: string, postId: string): Promise<void>;
  unlikePost(userId: string, postId: string): Promise<void>;
  likeComment(userId: string, commentId: string): Promise<void>;
  unlikeComment(userId: string, commentId: string): Promise<void>;
  incrementShare(postId: string): Promise<number | null>;
}
