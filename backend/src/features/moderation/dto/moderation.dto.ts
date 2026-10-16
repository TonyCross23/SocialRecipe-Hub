import { z } from '../../../shared/zod.js';

export const createReportDto = z
  .strictObject({
    reason: z.string().trim().min(10).max(2000),
    postId: z.uuid().optional(),
    commentId: z.uuid().optional(),
  })
  .refine((input) => Number(Boolean(input.postId)) + Number(Boolean(input.commentId)) === 1, {
    message: 'Provide exactly one of postId or commentId',
    path: ['postId'],
  });

export const reportIdParamsDto = z.strictObject({ reportId: z.uuid() });

export const reportPaginationDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED']).optional(),
});

export const updateReportDto = z.strictObject({
  status: z.enum(['REVIEWED', 'DISMISSED', 'ACTIONED']),
});

export const reportActionDto = z.strictObject({
  action: z.enum(['DISMISS', 'BAN_CONTENT']),
  reason: z.string().trim().min(5).max(1000),
});

export const policyKeyParamsDto = z.strictObject({
  key: z.enum(['moderation.enabled', 'moderation.bannedKeywords', 'moderation.policy']),
});

export const updatePolicyDto = z.strictObject({
  value: z.union([
    z.boolean(),
    z.string().trim().min(1).max(10_000),
    z.array(z.string().trim().min(1).max(100)).max(500),
  ]),
});

export function validatePolicyValue(
  key: z.infer<typeof policyKeyParamsDto>['key'],
  value: z.infer<typeof updatePolicyDto>['value'],
) {
  const schemaByKey = {
    'moderation.enabled': z.boolean(),
    'moderation.bannedKeywords': z.array(z.string().trim().min(1).max(100)).max(500),
    'moderation.policy': z.string().trim().min(1).max(10_000),
  } as const;

  return schemaByKey[key].parse(value) as boolean | string | string[];
}
