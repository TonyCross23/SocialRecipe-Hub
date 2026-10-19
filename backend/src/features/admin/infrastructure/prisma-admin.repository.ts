import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AdminDashboard, AdminRepository, AdminUserPage } from '../admin.types.js';

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly database: PrismaClient) {}

  async getDashboard(now: Date): Promise<AdminDashboard> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [
      users,
      posts,
      comments,
      likes,
      follows,
      reports,
      usersLast7Days,
      postsLast7Days,
      roles,
      postGroups,
      reportGroups,
      moderationGroups,
    ] = await this.database.$transaction([
      this.database.user.count(),
      this.database.post.count(),
      this.database.comment.count(),
      this.database.like.count(),
      this.database.follow.count(),
      this.database.report.count(),
      this.database.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.database.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.database.role.findMany({
        select: { name: true, _count: { select: { users: true } } },
        orderBy: { name: 'asc' },
      }),
      this.database.post.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { status: true },
      }),
      this.database.report.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { status: true },
      }),
      this.database.moderationJob.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { status: true },
      }),
    ]);

    return {
      totals: { users, posts, comments, likes, follows, reports },
      recent: { usersLast7Days, postsLast7Days },
      usersByRole: roles.map((role) => ({ role: role.name, count: role._count.users })),
      postsByStatus: postGroups.map((group) => ({
        status: group.status,
        count: readGroupCount(group._count),
      })),
      reportsByStatus: reportGroups.map((group) => ({
        status: group.status,
        count: readGroupCount(group._count),
      })),
      moderationJobsByStatus: moderationGroups.map((group) => ({
        status: group.status,
        count: readGroupCount(group._count),
      })),
      generatedAt: now,
    };
  }

  async getUsers(page: number, limit: number, role?: string): Promise<AdminUserPage> {
    const where = role ? { role: { name: role } } : {};
    const [users, total] = await this.database.$transaction([
      this.database.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          role: { select: { name: true } },
          _count: {
            select: {
              posts: true,
              comments: true,
              followers: true,
              following: true,
              reports: true,
            },
          },
        },
      }),
      this.database.user.count({ where }),
    ]);

    return {
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        dob: user.dob,
        role: user.role.name,
        status: user.status,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
        createdAt: user.createdAt,
        counts: user._count,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async banUser(userId: string, reason: string, now: Date) {
    const result = await this.database.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id: userId },
        data: { status: 'BANNED', bannedAt: now, bannedReason: reason },
      });
      if (updated.count > 0) {
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      return updated.count;
    });
    return result > 0;
  }

  async unbanUser(userId: string) {
    const result = await this.database.user.updateMany({
      where: { id: userId },
      data: { status: 'ACTIVE', bannedAt: null, bannedReason: null },
    });
    return result.count > 0;
  }

  async getNotifications(
    userId: string,
    limit: number,
    page = 1,
    filter: 'all' | 'unread' = 'all',
  ) {
    const where = { userId, ...(filter === 'unread' ? { readAt: null } : {}) };
    const [data, unreadCount, total] = await this.database.$transaction([
      this.database.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.database.notification.count({ where: { userId, readAt: null } }),
      this.database.notification.count({ where }),
    ]);
    return {
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markNotificationRead(userId: string, notificationId: string, now: Date) {
    const result = await this.database.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: now },
    });
    return result.count > 0;
  }

  async markAllNotificationsRead(userId: string, now: Date) {
    await this.database.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });
  }

  async getAuditLogs(page: number, limit: number) {
    const [data, total] = await this.database.$transaction([
      this.database.moderationJob.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.database.moderationJob.count(),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async overrideAuditLog(jobId: string, action: 'APPROVE' | 'BAN_CONTENT', _now: Date) {
    return this.database.$transaction(async (transaction) => {
      const job = await transaction.moderationJob.findUnique({ where: { id: jobId } });
      if (!job) return null;

      const contentStatus = action === 'APPROVE' ? 'PUBLISHED' : 'BANNED';
      if (job.postId) {
        await transaction.post.update({
          where: { id: job.postId },
          data: { status: contentStatus },
        });
      }
      if (job.commentId) {
        await transaction.comment.update({
          where: { id: job.commentId },
          data: { status: action === 'APPROVE' ? 'PUBLISHED' : 'DELETED' },
        });
      }

      return transaction.moderationJob.update({
        where: { id: jobId },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'FLAGGED',
          result: { overriddenByAdmin: true, action },
          lastError: null,
        },
      });
    });
  }
}

function readGroupCount(count: true | { status?: number } | undefined) {
  return typeof count === 'object' ? (count.status ?? 0) : 0;
}
