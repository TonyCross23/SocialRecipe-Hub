import type { PostStatus, ReportStatus } from '../../generated/prisma/enums.js';

export interface AdminDashboard {
  totals: {
    users: number;
    posts: number;
    comments: number;
    likes: number;
    follows: number;
    reports: number;
  };
  recent: {
    usersLast7Days: number;
    postsLast7Days: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  postsByStatus: Array<{ status: PostStatus; count: number }>;
  reportsByStatus: Array<{ status: ReportStatus; count: number }>;
  moderationJobsByStatus: Array<{ status: string; count: number }>;
  generatedAt: Date;
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  image: string | null;
  dob: Date;
  role: string;
  status: 'ACTIVE' | 'BANNED';
  bannedAt: Date | null;
  bannedReason: string | null;
  createdAt: Date;
  counts: {
    posts: number;
    comments: number;
    followers: number;
    following: number;
    reports: number;
  };
}

export interface AdminNotificationView {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}

export interface AdminUserPage {
  data: AdminUserView[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AuditLogView {
  id: string;
  postId: string | null;
  commentId: string | null;
  status: string;
  attempts: number;
  result: unknown;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRepository {
  getDashboard(now: Date): Promise<AdminDashboard>;
  getUsers(page: number, limit: number, role?: string): Promise<AdminUserPage>;
  banUser(userId: string, reason: string, now: Date): Promise<boolean>;
  unbanUser(userId: string): Promise<boolean>;
  getNotifications(
    userId: string,
    limit: number,
  ): Promise<{
    data: AdminNotificationView[];
    unreadCount: number;
  }>;
  markNotificationRead(userId: string, notificationId: string, now: Date): Promise<boolean>;
  markAllNotificationsRead(userId: string, now: Date): Promise<void>;
  getAuditLogs(
    page: number,
    limit: number,
  ): Promise<{
    data: AuditLogView[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  overrideAuditLog(
    jobId: string,
    action: 'APPROVE' | 'BAN_CONTENT',
    now: Date,
  ): Promise<AuditLogView | null>;
}
