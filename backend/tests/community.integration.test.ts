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
  throw new Error('Integration tests require socialrecipe_test');
describe.skipIf(!databaseUrl)('member profiles and notifications', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const app = createApp(
    createApplicationServices(db, testConfig, { registrationMailer }),
    testConfig,
    pino({ level: 'silent' }),
    async () => {},
  );
  const prefix = `community-test-${randomUUID()}`;
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };
  let publicPostId: string;
  async function member(label: string) {
    const body = {
      name: label,
      email: `${prefix}-${label}@example.test`,
      password: 'community test password 123!',
      dob: '2000-01-01',
    };
    const registration = await registerVerified(app, body);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);
    return { id: registration.body.user.id, token: login.body.accessToken };
  }
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
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
  it('exposes public profiles without private fields and filters posts by viewer visibility', async () => {
    for (const visibility of ['PUBLIC', 'FOLLOWERS', 'PRIVATE']) {
      const response = await request(app)
        .post('/api/v1/posts')
        .set(as(bob.token))
        .send({ title: `${visibility} recipe`, content: 'Recipe instructions', visibility })
        .expect(201);
      if (visibility === 'PUBLIC') publicPostId = response.body.post.id;
    }
    const profile = await request(app)
      .get(`/api/v1/community/users/${bob.id}`)
      .set(as(alice.token))
      .expect(200);
    expect(profile.body.user).not.toHaveProperty('email');
    expect(profile.body.user).not.toHaveProperty('dob');
    expect(profile.body.user.postsCount).toBe(1);
    const owner = await request(app)
      .get(`/api/v1/community/users/${bob.id}/posts`)
      .set(as(bob.token))
      .expect(200);
    expect(owner.body.pagination.total).toBe(3);
    const other = await request(app)
      .get(`/api/v1/community/users/${bob.id}/posts`)
      .set(as(alice.token))
      .expect(200);
    expect(other.body.data.map((post: { visibility: string }) => post.visibility)).toEqual([
      'PUBLIC',
    ]);
  });
  it('searches paginated post keywords without exposing private or removed posts', async () => {
    const keyword = `search-${randomUUID()}`;
    const created: Record<string, string> = {};
    for (const visibility of ['PUBLIC', 'FOLLOWERS', 'PRIVATE']) {
      const post = await request(app)
        .post('/api/v1/posts')
        .set(as(bob.token))
        .send({ title: `${keyword} recipe`, content: 'မြန်မာ ထမင်းကြော်', visibility })
        .expect(201);
      created[visibility] = post.body.post.id;
    }
    const search = (token: string, q = keyword, page = 1) =>
      request(app)
        .get('/api/v1/community/search/posts')
        .query({ q, page, limit: 1 })
        .set(as(token));
    const publicOnly = await search(alice.token, keyword.toUpperCase()).expect(200);
    expect(publicOnly.body.data.map((p: { id: string }) => p.id)).toEqual([created.PUBLIC]);
    expect(publicOnly.body.pagination.total).toBe(1);
    const owner = await search(bob.token).expect(200);
    expect(owner.body.pagination.totalPages).toBe(3);
    const second = await search(bob.token, keyword, 2).expect(200);
    expect(second.body.data[0].id).not.toBe(owner.body.data[0].id);
    expect(owner.body.data[0].author).not.toHaveProperty('email');
    const burmese = await search(bob.token, 'ထမင်းကြော်').expect(200);
    expect(burmese.body.pagination.total).toBeGreaterThanOrEqual(3);
    await db.post.update({ where: { id: created.PUBLIC }, data: { status: 'BANNED' } });
    await search(alice.token)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toEqual([]);
      });
    await db.post.update({ where: { id: created.PRIVATE }, data: { status: 'DELETED' } });
    const remaining = await search(bob.token).expect(200);
    expect(remaining.body.pagination.total).toBe(1);
    await request(app).get('/api/v1/community/search/posts').query({ q: keyword }).expect(401);
    for (const q of ['', '   ', 'x'.repeat(101)]) await search(alice.token, q).expect(400);
    await db.post.deleteMany({ where: { id: { in: Object.values(created) } } });
  });
  it('searches names without disclosing private account fields', async () => {
    const found = await request(app)
      .get('/api/v1/community/users')
      .query({ q: 'bOb', page: 1, limit: 50 })
      .set(as(alice.token))
      .expect(200);
    expect(found.body.data.map((u: { id: string }) => u.id)).toContain(bob.id);
    expect(found.body.data.find((u: { id: string }) => u.id === bob.id)).not.toHaveProperty(
      'email',
    );
    expect(found.body.data.find((u: { id: string }) => u.id === bob.id)).not.toHaveProperty('dob');
  });
  it('generates one follow/like notification for repeated idempotent writes', async () => {
    for (let i = 0; i < 2; i++) {
      await request(app)
        .put(`/api/v1/social/users/${bob.id}/follow`)
        .set(as(alice.token))
        .expect(200);
      await request(app)
        .put(`/api/v1/posts/${publicPostId}/likes`)
        .set(as(alice.token))
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/posts/${publicPostId}/comments`)
      .set(as(alice.token))
      .send({ content: 'Looks delicious!' })
      .expect(201);
    const notifications = await request(app)
      .get('/api/v1/community/notifications')
      .set(as(bob.token))
      .expect(200);
    expect(notifications.body.unreadCount).toBe(3);
    expect(notifications.body.data.map((item: { type: string }) => item.type).sort()).toEqual([
      'COMMENT',
      'FOLLOW',
      'LIKE',
    ]);
    const posts = await request(app)
      .get(`/api/v1/community/users/${bob.id}/posts`)
      .set(as(alice.token))
      .expect(200);
    expect(posts.body.pagination.total).toBe(2);
  });
  it('prevents another member from reading or marking owned notifications', async () => {
    const inbox = await request(app)
      .get('/api/v1/community/notifications')
      .set(as(bob.token))
      .expect(200);
    const id = inbox.body.data[0].id;
    const own = await request(app)
      .get('/api/v1/community/notifications')
      .set(as(alice.token))
      .expect(200);
    expect(own.body.pagination.total).toBe(0);
    await request(app)
      .patch(`/api/v1/community/notifications/${id}/read`)
      .set(as(alice.token))
      .expect(404);
    await request(app)
      .patch('/api/v1/community/notifications/read-all')
      .set(as(bob.token))
      .expect(200);
    const count = await request(app)
      .get('/api/v1/community/notifications/unread-count')
      .set(as(bob.token))
      .expect(200);
    expect(count.body.unreadCount).toBe(0);
  });
  it('supports following back the notification actor with a live relationship state', async () => {
    const inbox = await request(app)
      .get('/api/v1/community/notifications')
      .set(as(bob.token))
      .expect(200);
    const follow = inbox.body.data.find((n: { type: string }) => n.type === 'FOLLOW');
    expect(follow.data.actor.id).toBe(alice.id);
    const profilePath = `/api/v1/community/users/${follow.data.actor.id}`;
    const before = await request(app).get(profilePath).set(as(bob.token)).expect(200);
    expect(before.body.user.isFollowing).toBe(false);
    for (let i = 0; i < 2; i++)
      await request(app)
        .put(`/api/v1/social/users/${follow.data.actor.id}/follow`)
        .set(as(bob.token))
        .expect(200);
    const after = await request(app).get(profilePath).set(as(bob.token)).expect(200);
    expect(after.body.user.isFollowing).toBe(true);
    const aliceInbox = await request(app)
      .get('/api/v1/community/notifications')
      .set(as(alice.token))
      .expect(200);
    expect(aliceInbox.body.data.filter((n: { type: string }) => n.type === 'FOLLOW')).toHaveLength(
      1,
    );
  });
});
