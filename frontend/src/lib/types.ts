export type User = { id: string; name: string; email: string; role: string; status: 'ACTIVE' | 'BANNED'; permissions: string[]; image?: string | null };
export type AuthResponse = { user: User; accessToken: string; refreshToken: string };
export type Page<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export type Report = { id: string; reason: string; status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED'; postId: string | null; commentId: string | null; createdAt: string };
export type Policy = { id: string; key: 'moderation.enabled' | 'moderation.bannedKeywords' | 'moderation.policy'; value: unknown; description: string | null };
export type AdminUser = User & { createdAt: string; bannedReason: string | null; counts: { posts: number; comments: number; followers: number; following: number; reports: number } };
export type Notification = { id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string; data: Record<string, unknown> | null };
