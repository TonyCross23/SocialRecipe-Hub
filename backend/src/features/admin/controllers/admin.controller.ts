import type { Request, Response } from 'express';
import {
  auditLogParamsDto,
  auditLogQueryDto,
  auditOverrideDto,
  adminUserParamsDto,
  adminUserQueryDto,
  banUserDto,
  notificationParamsDto,
  notificationQueryDto,
} from '../dto/admin.dto.js';
import type { AdminUseCases } from '../use-cases/admin.use-cases.js';
import type { MonitoringSnapshot } from '../../../monitoring.js';

export class AdminController {
  constructor(
    private readonly admin: AdminUseCases,
    private readonly getMonitoringSnapshot: () => MonitoringSnapshot,
  ) {}

  dashboard = async (_request: Request, response: Response) => {
    response.json(await this.admin.getDashboard());
  };

  users = async (request: Request, response: Response) => {
    const { page, limit, role } = adminUserQueryDto.parse(request.query);
    response.json(await this.admin.getUsers(page, limit, role));
  };

  banUser = async (request: Request, response: Response) => {
    const { userId } = adminUserParamsDto.parse(request.params);
    const { reason } = banUserDto.parse(request.body);
    response.json(await this.admin.banUser(response.locals.actor!.user.id, userId, reason));
  };

  unbanUser = async (request: Request, response: Response) => {
    const { userId } = adminUserParamsDto.parse(request.params);
    response.json(await this.admin.unbanUser(userId));
  };

  notifications = async (request: Request, response: Response) => {
    const { limit, page, filter } = notificationQueryDto.parse(request.query);
    response.json(
      await this.admin.getNotifications(response.locals.actor!.user.id, limit, page, filter),
    );
  };

  readNotification = async (request: Request, response: Response) => {
    const { notificationId } = notificationParamsDto.parse(request.params);
    response.json(
      await this.admin.markNotificationRead(response.locals.actor!.user.id, notificationId),
    );
  };

  readAllNotifications = async (_request: Request, response: Response) => {
    response.json(await this.admin.markAllNotificationsRead(response.locals.actor!.user.id));
  };

  monitoring = (_request: Request, response: Response) => {
    response.json(this.getMonitoringSnapshot());
  };

  auditLogs = async (request: Request, response: Response) => {
    const { page, limit } = auditLogQueryDto.parse(request.query);
    response.json(await this.admin.getAuditLogs(page, limit));
  };

  overrideAuditLog = async (request: Request, response: Response) => {
    const { jobId } = auditLogParamsDto.parse(request.params);
    const { action } = auditOverrideDto.parse(request.body);
    response.json(await this.admin.overrideAuditLog(jobId, action));
  };
}
