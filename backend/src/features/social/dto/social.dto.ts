import { z } from '../../../shared/zod.js';

export const userIdParamsDto = z.strictObject({
  userId: z.uuid(),
});

export const paginationDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
