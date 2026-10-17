import { registrationMailer, registerVerified } from './fixtures/registration.js';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createApplicationServices } from '../src/container.js';
import { createDatabase } from '../src/database.js';
import { testConfig } from './config.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith('/socialrecipe_test')) {
  throw new Error('Integration tests require a database named socialrecipe_test');
}

describe.skipIf(!databaseUrl)('Social, post, and moderation HTTP integration', () => {
  const database = createDatabase(testConfig.DATABASE_URL);
  const services = createApplicationServices(database, testConfig, { registrationMailer });
  const app = createApp(services, testConfig, pino({ level: 'silent' }), async () => {
    await database.$queryRaw`SELECT 1`;
  });
  const prefix = `features-${randomUUID()}`;
  const password = 'feature test passphrase 123!';

  async function createAccount(label: string) {
    const registration = {
      name: `Tester ${label}`,
      email: `${prefix}-${label}@example.com`,
      password,
      dob: '1995-04-20',
    };
    await registerVerified(app, registration);
    return (
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: registration.email, password })
        .expect(200)
    ).body;
  }

  beforeAll(() => database.$connect());

  afterAll(async () => {
    await database.policySetting.update({
      where: { key: 'moderation.bannedKeywords' },
      data: { value: [] },
    });
    await database.policySetting.update({
      where: { key: 'moderation.enabled' },
      data: { value: false },
    });
    await database.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await database.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await database.$disconnect();
  });

  it('supports follow, feed, comments, likes, shares, reports, policies, and RBAC', async () => {
    const author = await createAccount('author');
    const reader = await createAccount('reader');

    await request(app)
      .put(`/api/v1/social/users/${author.user.id}/follow`)
      .auth(reader.accessToken, { type: 'bearer' })
      .expect(200, { following: true });

    const followers = await request(app)
      .get(`/api/v1/social/users/${author.user.id}/followers?page=1&limit=10`)
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    expect(followers.body.data[0].id).toBe(reader.user.id);

    const createdPost = await request(app)
      .post('/api/v1/posts')
      .auth(author.accessToken, { type: 'bearer' })
      .send({
        title: 'Easy noodle recipe',
        content: 'Boil noodles and add the sauce.',
        images: ['https://example.com/noodles.jpg'],
        visibility: 'FOLLOWERS',
      })
      .expect(201);
    const postId = createdPost.body.post.id as string;

    const feed = await request(app)
      .get('/api/v1/posts/feed')
      .auth(reader.accessToken, { type: 'bearer' })
      .expect(200);
    expect(feed.body.data.some((post: { id: string }) => post.id === postId)).toBe(true);

    await request(app)
      .put(`/api/v1/posts/${postId}/likes`)
      .auth(reader.accessToken, { type: 'bearer' })
      .expect(200, { liked: true });

    const comment = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .auth(reader.accessToken, { type: 'bearer' })
      .send({ content: 'This worked very well.' })
      .expect(201);
    const commentId = comment.body.comment.id as string;

    await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .auth(author.accessToken, { type: 'bearer' })
      .send({ content: 'Glad you liked it!', parentId: commentId })
      .expect(201);
    await request(app)
      .put(`/api/v1/posts/${postId}/comments/${commentId}/likes`)
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200, { liked: true });
    await request(app)
      .post(`/api/v1/posts/${postId}/share`)
      .auth(reader.accessToken, { type: 'bearer' })
      .expect(200, { sharesCount: 1 });

    const report = await request(app)
      .post('/api/v1/reports')
      .auth(reader.accessToken, { type: 'bearer' })
      .send({ reason: 'This report has enough detail.', commentId })
      .expect(201);

    await request(app)
      .get('/api/v1/moderation/reports')
      .auth(reader.accessToken, { type: 'bearer' })
      .expect(403);

    const adminRole = await database.role.findUniqueOrThrow({ where: { name: 'admin' } });
    await database.user.update({
      where: { id: author.user.id },
      data: { roleId: adminRole.id },
    });
    const dashboard = await request(app)
      .get('/api/v1/admin/dashboard')
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    expect(dashboard.body.totals.users).toBeGreaterThanOrEqual(2);
    expect(dashboard.body).toHaveProperty('postsByStatus');

    const users = await request(app)
      .get('/api/v1/admin/users?role=member')
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    expect(users.body.pagination).toHaveProperty('total');

    const postReport = await request(app)
      .post('/api/v1/reports')
      .auth(reader.accessToken, { type: 'bearer' })
      .send({ reason: 'This post should be reviewed by an administrator.', postId })
      .expect(201);

    const notifications = await request(app)
      .get('/api/v1/admin/notifications?limit=20')
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    expect(notifications.body.unreadCount).toBeGreaterThan(0);
    expect(notifications.body.data[0].type).toBe('NEW_REPORT');

    await request(app)
      .patch(`/api/v1/admin/notifications/${notifications.body.data[0].id}/read`)
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);

    await request(app)
      .post(`/api/v1/moderation/reports/${postReport.body.report.id}/action`)
      .auth(author.accessToken, { type: 'bearer' })
      .send({ action: 'BAN_CONTENT', reason: 'The reported post violates community policy.' })
      .expect(200);

    const bannedPost = await database.post.findUniqueOrThrow({ where: { id: postId } });
    const activeOwner = await database.user.findUniqueOrThrow({ where: { id: author.user.id } });
    expect(bannedPost.status).toBe('BANNED');
    expect(activeOwner.status).toBe('ACTIVE');

    const feedAfterBan = await request(app)
      .get('/api/v1/posts/feed')
      .auth(reader.accessToken, { type: 'bearer' })
      .expect(200);
    expect(feedAfterBan.body.data.some((post: { id: string }) => post.id === postId)).toBe(false);

    const monitoring = await request(app)
      .get('/api/v1/admin/monitoring')
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    expect(monitoring.body).toMatchObject({ status: 'healthy' });
    expect(monitoring.body.timeline).toBeInstanceOf(Array);

    await request(app)
      .patch(`/api/v1/admin/users/${reader.user.id}/ban`)
      .auth(author.accessToken, { type: 'bearer' })
      .send({ reason: 'Temporary integration test account ban.' })
      .expect(200);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${prefix}-reader@example.com`, password })
      .expect(403);
    await request(app)
      .delete(`/api/v1/admin/users/${reader.user.id}/ban`)
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    const restoredReader = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${prefix}-reader@example.com`, password })
      .expect(200);

    await request(app)
      .patch(`/api/v1/moderation/reports/${report.body.report.id}`)
      .auth(author.accessToken, { type: 'bearer' })
      .send({ status: 'REVIEWED' })
      .expect(200);
    await request(app)
      .put('/api/v1/moderation/policies/moderation.bannedKeywords')
      .auth(author.accessToken, { type: 'bearer' })
      .send({ value: ['unsafe-term'] })
      .expect(200);
    await request(app)
      .put('/api/v1/moderation/policies/moderation.enabled')
      .auth(author.accessToken, { type: 'bearer' })
      .send({ value: true })
      .expect(200);

    const flagged = await request(app)
      .post('/api/v1/posts')
      .auth(author.accessToken, { type: 'bearer' })
      .send({ title: 'Another recipe', content: 'Contains unsafe-term.' })
      .expect(201);
    expect(flagged.body.post.status).toBe('FLAGGED');

    const auditLogs = await request(app)
      .get('/api/v1/admin/audit-logs?page=1&limit=20')
      .auth(author.accessToken, { type: 'bearer' })
      .expect(200);
    const flaggedJob = auditLogs.body.data.find(
      (job: { postId: string }) => job.postId === flagged.body.post.id,
    );
    expect(flaggedJob).toBeDefined();
    await request(app)
      .post(`/api/v1/admin/audit-logs/${flaggedJob.id}/override`)
      .auth(author.accessToken, { type: 'bearer' })
      .send({ action: 'APPROVE' })
      .expect(200);
    expect(
      (await database.post.findUniqueOrThrow({ where: { id: flagged.body.post.id } })).status,
    ).toBe('PUBLISHED');

    await request(app)
      .delete(`/api/v1/social/users/${author.user.id}/follow`)
      .auth(restoredReader.body.accessToken, { type: 'bearer' })
      .expect(200, { following: false });

    await request(app).get('/metrics').expect(401);
    const metrics = await request(app)
      .get('/metrics')
      .auth(testConfig.METRICS_TOKEN!, { type: 'bearer' })
      .expect(200);
    expect(metrics.text).toContain('socialrecipe_http_requests_total');
  });
});
