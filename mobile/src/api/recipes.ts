import { api } from "./client";
import type {
  Comment,
  CreatePost,
  Page,
  Post,
  ReportTarget,
  Session,
  SocialUser,
  User,
} from "./types";
import type { z } from "zod";
import type { registerSchema } from "../lib/validation";

export const recipesApi = {
  login: (body: { email: string; password: string }) =>
    api<Session>("/auth/login", { method: "POST", body, auth: false }),
  register: (body: z.infer<typeof registerSchema>) =>
    api<{ requestId: string; expiresIn: number; resendAfter: number }>(
      "/auth/register",
      {
        method: "POST",
        body,
        auth: false,
      },
    ),
  verifyRegistration: (requestId: string, code: string) =>
    api<{ user: User }>("/auth/register/verify", {
      method: "POST",
      body: { requestId, code },
      auth: false,
    }),
  resendRegistration: (requestId: string) =>
    api<{ requestId: string; expiresIn: number; resendAfter: number }>(
      "/auth/register/resend",
      { method: "POST", body: { requestId }, auth: false },
    ),
  updateProfile: (body: { name: string; dob: string; image: string | null }) =>
    api<{ user: User }>("/auth/me", { method: "PATCH", body }),
  me: (signal?: AbortSignal) => api<{ user: User }>("/auth/me", { signal }),
  logout: () => api<void>("/auth/logout", { method: "POST", body: {} }),
  post: (id: string, signal?: AbortSignal) =>
    api<{ post: Post }>(`/community/posts/${id}`, { signal }),
  feed: (page: number, signal?: AbortSignal) =>
    api<Page<Post>>(`/posts/feed?page=${page}&limit=20`, { signal }),
  createPost: (body: CreatePost) =>
    api<{ post: Post }>("/posts", { method: "POST", body }),
  editPost: (id: string, body: CreatePost & { expectedUpdatedAt: string }) =>
    api<{ post: Post }>(`/community/posts/${id}`, { method: "PATCH", body }),
  deletePost: (id: string) =>
    api<void>(`/community/posts/${id}`, { method: "DELETE" }),
  users: (
    id: string,
    kind: "followers" | "following",
    page: number,
    signal?: AbortSignal,
  ) =>
    api<Page<SocialUser>>(
      `/social/users/${encodeURIComponent(id)}/${kind}?page=${page}&limit=20`,
      { signal },
    ),
  follow: (id: string, following: boolean) =>
    api<{ following: boolean }>(
      `/social/users/${encodeURIComponent(id)}/follow`,
      { method: following ? "PUT" : "DELETE" },
    ),
  like: (id: string, liked: boolean) =>
    api(`/posts/${id}/likes`, { method: liked ? "PUT" : "DELETE" }),
  comments: (id: string, page: number, signal?: AbortSignal) =>
    api<Page<Comment>>(
      `/posts/${id}/comments?page=${page}&limit=20&sort=newest`,
      {
        signal,
      },
    ),
  comment: (id: string, content: string) =>
    api<{ comment: Comment }>(`/posts/${id}/comments`, {
      method: "POST",
      body: { content },
    }),
  share: (
    id: string,
    content = "",
    visibility: import("./types").Visibility = "PUBLIC",
  ) =>
    api<{ post: { id: string; status: Post["status"] } }>(
      `/community/posts/${id}/share`,
      { method: "POST", body: { content, visibility } },
    ),
  likes: (id: string, page: number, signal?: AbortSignal) =>
    api<Page<import("./types").PublicProfile & { likedAt: string }>>(
      `/community/posts/${id}/likes?page=${page}&limit=20`,
      { signal },
    ),
  likeComment: (postId: string, id: string, liked: boolean) =>
    api(`/posts/${postId}/comments/${id}/likes`, {
      method: liked ? "PUT" : "DELETE",
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),
  report: (target: ReportTarget, reason: string) =>
    api("/reports", { method: "POST", body: { ...target, reason } }),
};

export const communityApi = {
  searchPosts: (q: string, page: number, signal?: AbortSignal) =>
    api<Page<Post>>(
      `/community/search/posts?q=${encodeURIComponent(q)}&page=${page}&limit=20`,
      { signal },
    ),
  people: (page: number, q = "", suggested = false, signal?: AbortSignal) =>
    api<Page<import("./types").PublicProfile>>(
      `/community/users?page=${page}&limit=20&q=${encodeURIComponent(q)}&suggested=${suggested}`,
      { signal },
    ),
  profile: (id: string, signal?: AbortSignal) =>
    api<{ user: import("./types").PublicProfile }>(
      `/community/users/${encodeURIComponent(id)}`,
      { signal },
    ),
  posts: (id: string, page: number, signal?: AbortSignal) =>
    api<Page<Post>>(
      `/community/users/${encodeURIComponent(id)}/posts?page=${page}&limit=20`,
      { signal },
    ),
  notifications: (page: number, signal?: AbortSignal) =>
    api<Page<import("./types").AppNotification> & { unreadCount: number }>(
      `/community/notifications?page=${page}&limit=20`,
      { signal },
    ),
  unread: (signal?: AbortSignal) =>
    api<import("./types").NotificationSummary>(
      "/community/notifications/unread-count",
      { signal },
    ),
  readNotification: (id?: string) =>
    api(
      `/community/notifications/${id ? `${encodeURIComponent(id)}/read` : "read-all"}`,
      { method: "PATCH" },
    ),
  deleteNotification: (id: string) =>
    api<void>(`/community/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
