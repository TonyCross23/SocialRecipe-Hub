import { registrationMailer, registerVerified } from './fixtures/registration.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createApplicationServices } from '../src/container.js';
import { createDatabase } from '../src/database.js';
import { testConfig } from './config.js';
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith('/socialrecipe_test'))
  throw new Error('Use isolated socialrecipe_test');
describe.skipIf(!databaseUrl)('reposts, likes and password change', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const app = createApp(
    createApplicationServices(db, testConfig, { registrationMailer }),
    testConfig,
    pino({ level: 'silent' }),
    async () => {},
  );
  const prefix = `social-update-${randomUUID()}`;
  const password = 'original password for testing 123!';
  let alice: { id: string; token: string; email: string; refresh: string };
  let bob: typeof alice;
  let original: string;
  let repost: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  async function member(label: string) {
    const email = `${prefix}-${label}@example.test`;
    const registration = await registerVerified(app, {
      name: label,
      email,
      password,
      dob: '2000-01-01',
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      id: registration.body.user.id,
      email,
      token: login.body.accessToken,
      refresh: login.body.refreshToken,
    };
  }
  beforeAll(async () => {
    await db.$connect();
    alice = await member('Alice');
    bob = await member('Bob');
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });
  it('creates a real feed post referencing the original author, with independent engagement', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set(auth(bob.token))
      .send({ title: 'Rice recipe', content: 'Cook rice slowly', visibility: 'PUBLIC' })
      .expect(201);
    original = created.body.post.id;
    const shared = await request(app)
      .post(`/api/v1/community/posts/${original}/share`)
      .set(auth(alice.token))
      .send({ content: 'Try this recipe!', visibility: 'PUBLIC' })
      .expect(201);
    repost = shared.body.post.id;
    const feed = await request(app)
      .get(`/api/v1/community/users/${alice.id}/posts`)
      .set(auth(alice.token))
      .expect(200);
    const detail = await request(app)
      .get(`/api/v1/community/posts/${repost}`)
      .set(auth(alice.token))
      .expect(200);
    expect(detail.body.post.sharedPost.id).toBe(original);
    expect(feed.body.data[0]).toMatchObject({
      id: repost,
      content: 'Try this recipe!',
      isRepost: true,
      author: { id: alice.id },
      sharedPost: { id: original, author: { id: bob.id } },
      likesCount: 0,
    });
    expect((await db.post.findUniqueOrThrow({ where: { id: original } })).sharesCount).toBe(1);
    expect(await db.notification.count({ where: { userId: bob.id, type: 'SHARE' } })).toBe(1);
  });
  it('flattens reshares and rejects private/followers-only sources', async () => {
    const shared = await request(app)
      .post(`/api/v1/community/posts/${repost}/share`)
      .set(auth(bob.token))
      .send({})
      .expect(201);
    expect(
      (await db.post.findUniqueOrThrow({ where: { id: shared.body.post.id } })).sharedPostId,
    ).toBe(original);
    for (const visibility of ['PRIVATE', 'FOLLOWERS'] as const) {
      const hidden = await db.post.create({
        data: { title: 'Private recipe', content: 'private', visibility, userId: bob.id },
      });
      await request(app)
        .post(`/api/v1/community/posts/${hidden.id}/share`)
        .set(auth(alice.token))
        .send({})
        .expect(404);
      await request(app)
        .post(`/api/v1/community/posts/${hidden.id}/share`)
        .set(auth(bob.token))
        .send({})
        .expect(409);
    }
  });
  it('applies moderation to share captions and queues review atomically', async () => {
    await db.policySetting.update({
      where: { key: 'moderation.bannedKeywords' },
      data: { value: ['blocked-caption-token'] },
    });
    await db.policySetting.update({ where: { key: 'moderation.enabled' }, data: { value: true } });
    try {
      const response = await request(app)
        .post(`/api/v1/community/posts/${original}/share`)
        .set(auth(alice.token))
        .send({ content: 'blocked-caption-token' })
        .expect(201);
      expect(response.body.post.status).toBe('FLAGGED');
      expect(await db.moderationJob.count({ where: { postId: response.body.post.id } })).toBe(1);
    } finally {
      await db.policySetting.update({
        where: { key: 'moderation.bannedKeywords' },
        data: { value: [] },
      });
      await db.policySetting.update({
        where: { key: 'moderation.enabled' },
        data: { value: false },
      });
    }
  });

  it('hides originals after visibility changes, moderation removal and physical deletion', async () => {
    await db.post.update({ where: { id: original }, data: { visibility: 'PRIVATE' } });
    const read = () =>
      request(app)
        .get(`/api/v1/community/users/${alice.id}/posts`)
        .set(auth(alice.token))
        .expect(200);
    expect((await read()).body.data[0].sharedPost).toBeNull();
    await request(app)
      .post(`/api/v1/community/posts/${repost}/share`)
      .set(auth(alice.token))
      .send({})
      .expect(409);
    await db.post.update({
      where: { id: original },
      data: { visibility: 'PUBLIC', status: 'BANNED' },
    });
    expect((await read()).body.data[0].sharedPost).toBeNull();
    await db.post.delete({ where: { id: original } });
    expect((await read()).body.data[0]).toMatchObject({ isRepost: true, sharedPost: null });
  });
  it('lists people who liked a visible post without exposing email/DOB', async () => {
    await request(app).put(`/api/v1/posts/${repost}/likes`).set(auth(bob.token)).expect(200);
    const response = await request(app)
      .get(`/api/v1/community/posts/${repost}/likes`)
      .set(auth(alice.token))
      .expect(200);
    expect(response.body.data[0].id).toBe(bob.id);
    expect(Number.isFinite(Date.parse(response.body.data[0].likedAt))).toBe(true);
    expect(response.body.data[0]).not.toHaveProperty('email');
    expect(response.body.data[0]).not.toHaveProperty('dob');
    await db.post.update({ where: { id: repost }, data: { visibility: 'PRIVATE' } });
    await request(app)
      .get(`/api/v1/community/posts/${repost}/likes`)
      .set(auth(bob.token))
      .expect(404);
  });
  it('requires the current password and revokes every old session after changing it', async () => {
    const second = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: alice.email, password })
      .expect(200);
    await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(alice.token))
      .send({ currentPassword: 'incorrect', newPassword: 'replacement password 123!' })
      .expect(400);
    await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(alice.token))
      .send({ currentPassword: password, newPassword: 'tiny' })
      .expect(400);
    await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(alice.token))
      .send({ currentPassword: password, newPassword: password })
      .expect(400);
    await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(alice.token))
      .send({ currentPassword: password, newPassword: 'replacement password 123!' })
      .expect(204);
    for (const token of [alice.token, second.body.accessToken])
      await request(app).get('/api/v1/auth/me').set(auth(token)).expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: alice.refresh })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: alice.email, password })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: alice.email, password: 'replacement password 123!' })
      .expect(200);
  });
});
