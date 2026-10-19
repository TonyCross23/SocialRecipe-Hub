import type { AdminRepository } from '../admin.types.js';

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  getDashboard(now: Date) {
    return this.repository.getDashboard(now);
  }

  getUsers(page: number, limit: number, role?: string) {
    return this.repository.getUsers(page, limit, role);
  }

  banUser(userId: string, reason: string, now: Date) {
    return this.repository.banUser(userId, reason, now);
  }

  unbanUser(userId: string) {
    return this.repository.unbanUser(userId);
  }

  getNotifications(userId: string, limit: number, page = 1, filter: 'all' | 'unread' = 'all') {
    return this.repository.getNotifications(userId, limit, page, filter);
  }

  markNotificationRead(userId: string, notificationId: string, now: Date) {
    return this.repository.markNotificationRead(userId, notificationId, now);
  }

  markAllNotificationsRead(userId: string, now: Date) {
    return this.repository.markAllNotificationsRead(userId, now);
  }

  getAuditLogs(page: number, limit: number) {
    return this.repository.getAuditLogs(page, limit);
  }

  overrideAuditLog(jobId: string, action: 'APPROVE' | 'BAN_CONTENT', now: Date) {
    return this.repository.overrideAuditLog(jobId, action, now);
  }
}
