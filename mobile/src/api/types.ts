import type { RecipeDetails } from "../lib/recipe";
export interface SocialUser {
  id: string;
  name: string;
  image: string | null;
}
export interface User extends SocialUser {
  email: string;
  dob: string;
  role: string;
  permissions: string[];
  status: "ACTIVE" | "BANNED";
  bannedReason: string | null;
  createdAt: string;
}
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresAt: string;
}
export interface Session extends Tokens {
  user: User;
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
export type Visibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";
export interface Post {
  recipe?: RecipeDetails | null;
  savedByCurrentUser?: boolean;
  isRepost?: boolean;
  sharedPost?: Post | null;
  id: string;
  title: string;
  content: string;
  images: string[];
  visibility: Visibility;
  status: "PUBLISHED" | "FLAGGED" | "BANNED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  author: SocialUser;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  likedByCurrentUser: boolean;
}
export interface Comment {
  id: string;
  content: string;
  author: SocialUser;
  createdAt: string;
  likesCount: number;
  repliesCount: number;
  likedByCurrentUser: boolean;
}
export interface CreatePost {
  recipe?: RecipeDetails | null;
  title: string;
  content: string;
  images: string[];
  visibility: Visibility;
}
export type ReportTarget =
  { postId: string; commentId?: never } | { commentId: string; postId?: never };

export interface PublicProfile extends SocialUser {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  data: unknown;
}
export interface NotificationSummary {
  unreadCount: number;
  latestNotification: AppNotification | null;
}
