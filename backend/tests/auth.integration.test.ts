import { registrationMailer, registerVerified } from './fixtures/registration.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createApplicationServices } from '../src/container.js';
import { createDatabase } from '../src/database.js';
import { testConfig } from './config.js';

// Explicit opt-in. Never target the application database.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith('/socialrecipe_test')) {
  throw new Error('Integration tests require a database named socialrecipe_test');
}
describe.skipIf(!databaseUrl)('PostgreSQL auth integration', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const services = createApplicationServices(db, testConfig, { registrationMailer });
  const app = createApp(services, testConfig, pino({ level: 'silent' }), async () => {
    await db.$queryRaw`SELECT 1`;
  });
  const prefix = `test-${randomUUID()}`;
  const password = 'recipe test passphrase 123!';
  const account = (label: string) => ({
    name: 'Recipe Tester',
    email: `${prefix}-${label}@example.com`,
    password,
    dob: '1995-04-20',
  });
  async function registerAndLogin(label: string) {
    const input = account(label);
    await registerVerified(app, input);
    return (
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: input.email, password })
        .expect(200)
    ).body;
  }
  beforeAll(async () => {
    await db.$connect();
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it('registers a member, hashes the password and never returns it', async () => {
    const input = account('registration');
    const response = await registerVerified(app, input);
    expect(response.body.user.role).toBe('member');
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.headers['cache-control']).toBe('no-store');
    const stored = await db.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...input, email: input.email.toUpperCase() })
      .expect(409);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...account('privilege'), roleId: randomUUID() })
      .expect(400);
  });

  it('allows pending requests but creates only one member on verification', async () => {
    const responses = await Promise.all(
      [1, 2].map(() => request(app).post('/api/v1/auth/register').send(account('duplicate'))),
    );
    expect(responses.map((r) => r.status)).toEqual([202, 202]);
    expect(await db.user.count({ where: { email: account('duplicate').email } })).toBe(0);
    await registerVerified(app, account('duplicate'));
    expect(await db.user.count({ where: { email: account('duplicate').email } })).toBe(1);
  });

  it('uses the same error for unknown email and wrong password', async () => {
    await registerAndLogin('credentials');
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: account('absent').email, password })
      .expect(401);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: account('credentials').email, password: 'wrong' })
      .expect(401);
    expect(unknown.body.error.code).toBe(wrong.body.error.code);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('rotates hashed tokens and revokes the whole family after reuse', async () => {
    const login = await registerAndLogin('rotation');
    const stored = await db.refreshToken.findFirstOrThrow({ where: { userId: login.user.id } });
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(login.refreshToken);
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(login.refreshToken);
    await request(app)
      .get('/api/v1/auth/me')
      .auth(rotated.body.accessToken, { type: 'bearer' })
      .expect(200);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
    await request(app)
      .get('/api/v1/auth/me')
      .auth(rotated.body.accessToken, { type: 'bearer' })
      .expect(401);
    expect(
      (await db.authSession.findUniqueOrThrow({ where: { id: stored.sessionId } })).revokedAt,
    ).not.toBeNull();
  });

  it('serializes concurrent refreshes and commits replay revocation', async () => {
    const login = await registerAndLogin('concurrent');
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.refreshToken }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
    const winner = responses.find((r) => r.status === 200)!;
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: winner.body.refreshToken })
      .expect(401);
    await request(app)
      .get('/api/v1/auth/me')
      .auth(winner.body.accessToken, { type: 'bearer' })
      .expect(401);
  });

  it('logout immediately invalidates access and refresh for only that session', async () => {
    const login = await registerAndLogin('logout');
    const other = (
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: account('logout').email, password })
        .expect(200)
    ).body;
    await request(app)
      .post('/api/v1/auth/logout')
      .auth(login.accessToken, { type: 'bearer' })
      .send({})
      .expect(204);
    await request(app)
      .get('/api/v1/auth/me')
      .auth(login.accessToken, { type: 'bearer' })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(401);
    await request(app)
      .get('/api/v1/auth/me')
      .auth(other.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('rejects expired database tokens and sessions even with valid JWTs', async () => {
    const login = await registerAndLogin('expiry');
    await db.refreshToken.updateMany({
      where: { userId: login.user.id },
      data: { expiresAt: new Date(0) },
    });
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(401);
    await db.authSession.updateMany({
      where: { userId: login.user.id },
      data: { expiresAt: new Date(0) },
    });
    await request(app)
      .get('/api/v1/auth/me')
      .auth(login.accessToken, { type: 'bearer' })
      .expect(401);
  });

  it('reads current role permissions rather than caching JWT privileges', async () => {
    const login = await registerAndLogin('roles');
    const admin = await db.role.findUniqueOrThrow({ where: { name: 'admin' } });
    await db.user.update({ where: { id: login.user.id }, data: { roleId: admin.id } });
    const me = await request(app)
      .get('/api/v1/auth/me')
      .auth(login.accessToken, { type: 'bearer' })
      .expect(200);
    expect(me.body.user.permissions).toContain('rbac:manage');
  });

  it('enforces schema invariants in PostgreSQL', async () => {
    const login = await registerAndLogin('constraints');
    await expect(
      db.follow.create({ data: { followerId: login.user.id, followingId: login.user.id } }),
    ).rejects.toThrow();
    await expect(db.like.create({ data: { userId: login.user.id } })).rejects.toThrow();
    const post = await db.post.create({
      data: { title: 'Recipe', content: 'Instructions', userId: login.user.id },
    });
    const comment = await db.comment.create({
      data: { content: 'Great!', postId: post.id, userId: login.user.id },
    });
    await expect(
      db.like.create({ data: { userId: login.user.id, postId: post.id, commentId: comment.id } }),
    ).rejects.toThrow();
    await db.like.create({ data: { userId: login.user.id, postId: post.id } });
    await expect(
      db.like.create({ data: { userId: login.user.id, postId: post.id } }),
    ).rejects.toThrow();
    const otherPost = await db.post.create({
      data: { title: 'Other', content: 'Recipe', userId: login.user.id },
    });
    await expect(
      db.comment.create({
        data: {
          content: 'Reply',
          userId: login.user.id,
          postId: otherPost.id,
          parentId: comment.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.post.update({ where: { id: post.id }, data: { sharesCount: -1 } }),
    ).rejects.toThrow();
    await expect(
      db.report.create({ data: { reason: 'spam', reporterId: login.user.id } }),
    ).rejects.toThrow();
    await expect(db.moderationJob.create({ data: {} })).rejects.toThrow();
  });

  it('returns controlled errors for malformed JSON, oversized payloads and missing auth', async () => {
    const root = await request(app).get('/api/v1').expect(200);
    expect(root.body).toEqual({ name: 'SocialRecipe API', version: 'v1', status: 'ok' });

    const docs = await request(app).get('/api-docs/openapi.json').expect(200);
    expect(docs.body.openapi).toBe('3.1.0');
    expect(docs.body.paths['/api/v1/auth/login'].post).toBeDefined();

    const swagger = await request(app).get('/api-docs/').expect(200);
    expect(swagger.text).toContain('SocialRecipe API Docs');

    await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'x'.repeat(40_000) })
      .expect(413);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'garbage', extra: true })
      .expect(400);
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/health/ready').expect(200);
  });
});
