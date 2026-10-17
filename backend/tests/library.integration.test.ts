import { registrationMailer, registerVerified } from './fixtures/registration.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createApplicationServices } from '../src/container.js';
import { createDatabase } from '../src/database.js';
import { PushWorker } from '../src/features/push/push.worker.js';
import { testConfig } from './config.js';
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith('/socialrecipe_test'))
  throw new Error('Requires isolated test DB');
const recipe = {
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredients: [
    { name: 'ဆန်', quantity: 200, unit: 'g' },
    { name: 'Salt', quantity: null, unit: 'to taste' },
  ],
  steps: ['Wash the rice.', 'Cook until tender.'],
};
describe.skipIf(!databaseUrl)('saved recipes, shopping lists, safety and push', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const app = createApp(
    createApplicationServices(db, testConfig, { registrationMailer }),
    testConfig,
    pino({ level: 'silent' }),
    async () => {},
  );
  const prefix = `library-test-${randomUUID()}`;
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };
  let postId: string;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  async function member(name: string) {
    const body = {
      name,
      email: `${prefix}-${name.replaceAll(' ', '-')}@example.test`,
      password: 'library test password 123!',
      dob: '2000-01-01',
    };
    const user = await registerVerified(app, body);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);
    return { id: user.body.user.id as string, token: login.body.accessToken as string };
  }
  beforeAll(async () => {
    await db.$connect();
    alice = await member('Library Alice');
    bob = await member('Library Bob');
    const post = await request(app)
      .post('/api/v1/posts')
      .set(as(bob.token))
      .send({ title: prefix, content: 'Rice for dinner.', recipe })
      .expect(201);
    postId = post.body.post.id;
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });
  it('round-trips and validates recipe metadata, preserving it for legacy edits', async () => {
    let result = await request(app)
      .get(`/api/v1/community/posts/${postId}`)
      .set(as(alice.token))
      .expect(200);
    expect(result.body.post.recipe).toEqual(recipe);
    const old = result.body.post;
    result = await request(app)
      .patch(`/api/v1/community/posts/${postId}`)
      .set(as(bob.token))
      .send({
        title: old.title,
        content: old.content,
        images: [],
        visibility: 'PUBLIC',
        expectedUpdatedAt: old.updatedAt,
      })
      .expect(200);
    expect(result.body.post.recipe).toEqual(recipe);
    await request(app)
      .post('/api/v1/posts')
      .set(as(bob.token))
      .send({ title: 'Invalid recipe', content: 'Test', recipe: { ...recipe, servings: 0 } })
      .expect(400);
    await request(app)
      .post('/api/v1/posts')
      .set(as(bob.token))
      .send({
        title: 'Invalid amount',
        content: 'Test',
        recipe: { ...recipe, ingredients: [{ name: 'rice', quantity: -1, unit: 'g' }] },
      })
      .expect(400);
  });
  it('saves idempotently, paginates privately and rechecks visibility after saving', async () => {
    for (let i = 0; i < 2; i++)
      await request(app).put(`/api/v1/library/saved/${postId}`).set(as(alice.token)).expect(200);
    const saved = await request(app)
      .get('/api/v1/library/saved?page=1&limit=1')
      .set(as(alice.token))
      .expect(200);
    expect(saved.body.pagination.total).toBe(1);
    expect(saved.body.data[0].savedByCurrentUser).toBe(true);
    const bobSaved = await request(app).get('/api/v1/library/saved').set(as(bob.token)).expect(200);
    expect(bobSaved.body.data).toEqual([]);
    await db.post.update({ where: { id: postId }, data: { visibility: 'PRIVATE' } });
    const hidden = await request(app).get('/api/v1/library/saved').set(as(alice.token)).expect(200);
    expect(hidden.body.data).toEqual([]);
    await request(app).put(`/api/v1/library/saved/${postId}`).set(as(alice.token)).expect(404);
    await request(app).delete(`/api/v1/library/saved/${postId}`).set(as(alice.token)).expect(200);
    await db.post.update({ where: { id: postId }, data: { visibility: 'PUBLIC' } });
    await request(app).get('/api/v1/library/saved').expect(401);
  });
  it('keeps shopping lists private and persists checked items', async () => {
    const result = await request(app)
      .post('/api/v1/library/shopping-lists')
      .set(as(alice.token))
      .send({ title: 'Dinner', items: [{ name: 'ဆန်', quantity: '200 g' }] })
      .expect(201);
    const { id, items } = result.body.list;
    await request(app)
      .patch(`/api/v1/library/shopping-lists/${id}/items/${items[0].id}`)
      .set(as(bob.token))
      .send({ checked: true })
      .expect(404);
    await request(app).get(`/api/v1/library/shopping-lists/${id}`).set(as(bob.token)).expect(404);
    await request(app)
      .delete(`/api/v1/library/shopping-lists/${id}`)
      .set(as(bob.token))
      .expect(404);
    await request(app)
      .patch(`/api/v1/library/shopping-lists/${id}/items/${items[0].id}`)
      .set(as(alice.token))
      .send({ checked: true })
      .expect(200);
    const checked = await request(app)
      .get(`/api/v1/library/shopping-lists/${id}`)
      .set(as(alice.token))
      .expect(200);
    expect(checked.body.list.items[0].checked).toBe(true);
    await request(app)
      .post('/api/v1/library/shopping-lists')
      .set(as(alice.token))
      .send({ title: 'Empty', items: [] })
      .expect(400);
    await request(app)
      .delete(`/api/v1/library/shopping-lists/${id}`)
      .set(as(alice.token))
      .expect(204);
  });
  it('mutes feed posts and notifications while retaining direct profile access', async () => {
    await request(app)
      .put(`/api/v1/social/users/${alice.id}/follow`)
      .set(as(bob.token))
      .expect(200);
    await request(app)
      .put(`/api/v1/library/filters/${bob.id}/MUTE`)
      .set(as(alice.token))
      .expect(200);
    const feed = await request(app)
      .get('/api/v1/posts/feed?limit=50')
      .set(as(alice.token))
      .expect(200);
    expect(feed.body.data.some((p: { id: string }) => p.id === postId)).toBe(false);
    await request(app).get(`/api/v1/community/users/${bob.id}`).set(as(alice.token)).expect(200);
    const inbox = await request(app)
      .get('/api/v1/community/notifications')
      .set(as(alice.token))
      .expect(200);
    expect(inbox.body.data.some((n: { actorId: string }) => n.actorId === bob.id)).toBe(false);
    await request(app)
      .delete(`/api/v1/library/filters/${bob.id}/MUTE`)
      .set(as(alice.token))
      .expect(200);
  });
  it('blocks both directions, removes follows and prevents direct interaction or discovery', async () => {
    await request(app)
      .put(`/api/v1/social/users/${bob.id}/follow`)
      .set(as(alice.token))
      .expect(200);
    await request(app)
      .put(`/api/v1/library/filters/${bob.id}/BLOCK`)
      .set(as(alice.token))
      .expect(200);
    expect(
      await db.follow.count({
        where: {
          OR: [
            { followerId: alice.id, followingId: bob.id },
            { followerId: bob.id, followingId: alice.id },
          ],
        },
      }),
    ).toBe(0);
    await request(app).get(`/api/v1/community/posts/${postId}`).set(as(alice.token)).expect(404);
    await request(app).get(`/api/v1/community/users/${alice.id}`).set(as(bob.token)).expect(404);
    await request(app)
      .get(`/api/v1/social/users/${alice.id}/followers`)
      .set(as(bob.token))
      .expect(404);
    await request(app)
      .put(`/api/v1/social/users/${alice.id}/follow`)
      .set(as(bob.token))
      .expect(403);
    await request(app).put(`/api/v1/posts/${postId}/likes`).set(as(alice.token)).expect(404);
    await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set(as(alice.token))
      .send({ content: 'test' })
      .expect(404);
    const search = await request(app)
      .get('/api/v1/community/search/posts')
      .query({ q: prefix })
      .set(as(alice.token))
      .expect(200);
    expect(search.body.data).toEqual([]);
    const users = await request(app)
      .get('/api/v1/community/users')
      .query({ q: 'Library Bob' })
      .set(as(alice.token))
      .expect(200);
    expect(users.body.data).toEqual([]);
    const blocked = await request(app)
      .get('/api/v1/library/filters?kind=BLOCK')
      .set(as(alice.token))
      .expect(200);
    expect(blocked.body.data[0].id).toBe(bob.id);
    await request(app)
      .put(`/api/v1/library/filters/${alice.id}/BLOCK`)
      .set(as(alice.token))
      .expect(400);
    await request(app)
      .delete(`/api/v1/library/filters/${bob.id}/BLOCK`)
      .set(as(alice.token))
      .expect(200);
    await request(app).get(`/api/v1/community/users/${bob.id}`).set(as(alice.token)).expect(200);
  });
  it('registers push devices, queues once, checks receipts and skips revoked sessions', async () => {
    const token = `ExpoPushToken[test_${randomUUID().replaceAll('-', '')}]`;
    await request(app)
      .post('/api/v1/library/push-devices')
      .set(as(alice.token))
      .send({ token: 'not-a-token' })
      .expect(400);
    const registration = await request(app)
      .post('/api/v1/library/push-devices')
      .set(as(alice.token))
      .send({ token })
      .expect(201);
    const deviceId = registration.body.id;
    await db.pushDevice.update({
      where: { id: deviceId },
      data: { createdAt: new Date(Date.now() - 60000) },
    });
    const notification = await db.notification.create({
      data: {
        userId: alice.id,
        actorId: bob.id,
        type: 'LIKE',
        title: 'New like',
        message: 'Bob liked your recipe.',
        data: { actor: { id: bob.id }, postId },
      },
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ data: { status: 'ok', id: 'test-ticket' } }));
    const worker = new PushWorker(db, pino({ level: 'silent' }), undefined, fetcher);
    await Promise.all([worker.run(), worker.run()]);
    expect(fetcher).toHaveBeenCalled();
    const sent = await db.pushDelivery.findFirstOrThrow({
      where: { notificationId: notification.id, deviceId },
    });
    expect(sent.status).toBe('TICKET');
    await db.pushDelivery.update({ where: { id: sent.id }, data: { availableAt: new Date(0) } });
    fetcher.mockResolvedValueOnce(Response.json({ data: { 'test-ticket': { status: 'ok' } } }));
    await worker.run();
    expect((await db.pushDelivery.findUniqueOrThrow({ where: { id: sent.id } })).status).toBe(
      'DELIVERED',
    );
    const retryNotification = await db.notification.create({
      data: {
        userId: alice.id,
        actorId: bob.id,
        type: 'FOLLOW',
        title: 'Retry',
        message: 'New follower',
      },
    });
    fetcher.mockResolvedValueOnce(new Response('temporary outage', { status: 503 }));
    await worker.run();
    const retry = await db.pushDelivery.findFirstOrThrow({
      where: { notificationId: retryNotification.id },
    });
    expect(retry.status).toBe('PENDING');
    expect(retry.lastError).toBe('RETRY_PROVIDER');
    await db.pushDelivery.update({ where: { id: retry.id }, data: { availableAt: new Date(0) } });
    await worker.run();
    expect((await db.pushDelivery.findUniqueOrThrow({ where: { id: retry.id } })).status).toBe(
      'TICKET',
    );
    const before = fetcher.mock.calls.length;
    const second = await db.notification.create({
      data: {
        userId: alice.id,
        actorId: bob.id,
        type: 'FOLLOW',
        title: 'Follow',
        message: 'New follower',
      },
    });
    const device = await db.pushDevice.findUniqueOrThrow({ where: { id: deviceId } });
    await db.authSession.update({
      where: { id: device.sessionId },
      data: { revokedAt: new Date() },
    });
    await worker.run();
    expect(fetcher.mock.calls.length).toBe(before);
    expect(await db.pushDelivery.count({ where: { notificationId: second.id } })).toBe(0);
  });
  it('removes devices rejected by the Expo service instead of retrying forever', async () => {
    const token = `ExpoPushToken[expired_${randomUUID().replaceAll('-', '')}]`;
    const registered = await request(app)
      .post('/api/v1/library/push-devices')
      .set(as(bob.token))
      .send({ token })
      .expect(201);
    const id = registered.body.id;
    await db.pushDevice.update({ where: { id }, data: { createdAt: new Date(Date.now() - 1000) } });
    await db.notification.create({
      data: {
        userId: bob.id,
        actorId: alice.id,
        type: 'FOLLOW',
        title: 'Follower',
        message: 'Test',
      },
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }),
      );
    await new PushWorker(db, pino({ level: 'silent' }), undefined, fetcher).run();
    expect(fetcher).toHaveBeenCalled();
    expect(await db.pushDevice.findUnique({ where: { id } })).toBeNull();
  });
});
