import { z } from '../../../shared/zod.js';

export const adminUserQueryDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.string().trim().min(1).max(50).optional(),
});

export const adminUserParamsDto = z.strictObject({ userId: z.uuid() });

export const banUserDto = z.strictObject({
  reason: z.string().trim().min(5).max(1000),
});

export const notificationQueryDto = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(15),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  filter: z.enum(['all', 'unread']).default('all'),
});

export const notificationParamsDto = z.strictObject({ notificationId: z.uuid() });

export const auditLogQueryDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditLogParamsDto = z.strictObject({ jobId: z.uuid() });

export const auditOverrideDto = z.strictObject({
  action: z.enum(['APPROVE', 'BAN_CONTENT']),
});
