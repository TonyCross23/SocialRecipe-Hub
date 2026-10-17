import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/openapi.js';

describe('OpenAPI document', () => {
  const paths = openApiDocument.paths ?? {};

  it('documents every current public route', () => {
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(Object.keys(paths)).toHaveLength(67);
    expect(paths).toHaveProperty('/api/v1/media/images');
    expect(paths).toHaveProperty('/api/v1/media/registration-images');
    expect(paths).toHaveProperty('/api/v1/posts/feed');
    expect(paths).toHaveProperty('/api/v1/library/saved');
    expect(paths).toHaveProperty('/api/v1/assistant/shopping-list');
    expect(paths).toHaveProperty('/api/v1/community/search/posts');
    expect(paths).toHaveProperty('/api/v1/social/users/{userId}/follow');
    expect(paths).toHaveProperty('/api/v1/reports');
    expect(paths).toHaveProperty('/api/v1/moderation/policies/{key}');
    expect(paths).toHaveProperty('/api/v1/admin/dashboard');
    expect(paths).toHaveProperty('/api/v1/admin/users/{userId}/ban');
    expect(paths).toHaveProperty('/api/v1/admin/notifications');
    expect(paths).toHaveProperty('/api/v1/admin/monitoring');
    expect(paths).toHaveProperty('/api/v1/admin/audit-logs');
    expect(paths).toHaveProperty('/api/v1/moderation/reports/{reportId}/action');
    expect(paths).toHaveProperty('/metrics');
  });

  it('documents bearer authentication for protected endpoints', () => {
    expect(paths['/api/v1/auth/me']?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(paths['/api/v1/auth/logout']?.post?.security).toEqual([{ bearerAuth: [] }]);
    expect(openApiDocument.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('does not expose password fields in response schemas', () => {
    const document = JSON.stringify(openApiDocument);
    const publicUser = openApiDocument.components?.schemas?.PublicUser;

    expect(publicUser).toBeDefined();
    expect(document).not.toContain('passwordHash');
  });
});
