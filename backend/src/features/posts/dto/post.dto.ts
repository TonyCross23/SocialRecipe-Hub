import { z } from '../../../shared/zod.js';

const httpsImageUrl = z.url({ protocol: /^https$/ }).max(2048);

export const createPostDto = z
  .strictObject({
    title: z.string().trim().min(3).max(200),
    content: z.string().trim().max(20_000).default(''),
    images: z.array(httpsImageUrl).max(10).default([]),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).default('PUBLIC'),
  })
  .refine((data) => data.content.length > 0 || data.images.length > 0, {
    message: 'A post must contain text or at least one image',
    path: ['content'],
  });

export const createCommentDto = z.strictObject({
  content: z.string().trim().min(1).max(5000),
  parentId: z.uuid().nullable().optional(),
});

export const postIdParamsDto = z.strictObject({ postId: z.uuid() });

export const postCommentParamsDto = z.strictObject({
  postId: z.uuid(),
  commentId: z.uuid(),
});

export const postPaginationDto = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
