import { AppError, notFound } from '../../../errors.js';
import type { AdminService } from '../services/admin.service.js';

export class AdminUseCases {
  constructor(
    private readonly admin: AdminService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  getDashboard() {
    return this.admin.getDashboard(this.clock());
  }

  getUsers(page: number, limit: number, role?: string) {
    return this.admin.getUsers(page, limit, role);
  }

  async banUser(actorId: string, userId: string, reason: string) {
    if (actorId === userId) {
      throw new AppError(400, 'SELF_BAN_NOT_ALLOWED', 'You cannot ban your own account');
    }
    if (!(await this.admin.banUser(userId, reason, this.clock()))) throw notFound('User');
    return { status: 'BANNED' as const };
  }

  async unbanUser(userId: string) {
    if (!(await this.admin.unbanUser(userId))) throw notFound('User');
    return { status: 'ACTIVE' as const };
  }

  getNotifications(userId: string, limit: number, page = 1, filter: 'all' | 'unread' = 'all') {
    return this.admin.getNotifications(userId, limit, page, filter);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    if (!(await this.admin.markNotificationRead(userId, notificationId, this.clock()))) {
      throw notFound('Notification');
    }
    return { read: true };
  }

  async markAllNotificationsRead(userId: string) {
    await this.admin.markAllNotificationsRead(userId, this.clock());
    return { read: true };
  }

  getAuditLogs(page: number, limit: number) {
    return this.admin.getAuditLogs(page, limit);
  }

  async overrideAuditLog(jobId: string, action: 'APPROVE' | 'BAN_CONTENT') {
    const log = await this.admin.overrideAuditLog(jobId, action, this.clock());
    if (!log) throw notFound('Moderation job');
    return { log };
  }
}
