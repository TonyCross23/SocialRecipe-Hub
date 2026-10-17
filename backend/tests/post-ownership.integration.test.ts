import { registrationMailer, registerVerified } from './fixtures/registration.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createApplicationServices } from '../src/container.js';
import { createDatabase } from '../src/database.js';
import { PrismaModerationJobRepository } from '../src/features/moderation/infrastructure/prisma-moderation-job.repository.js';
import { testConfig } from './config.js';
const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith('/socialrecipe_test'))
  throw new Error('Use isolated socialrecipe_test');
describe.skipIf(!url)('post ownership, edits and deletion', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const app = createApp(
    createApplicationServices(db, testConfig, { registrationMailer }),
    testConfig,
    pino({ level: 'silent' }),
    async () => {},
  );
  const prefix = `owner-${randomUUID()}`;
  let owner: { id: string; token: string };
  let other: typeof owner;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  async function member(label: string) {
    const body = {
      name: label,
      email: `${prefix}-${label}@example.test`,
      password: 'ownership test password 123!',
      dob: '2000-01-01',
    };
    const r = await registerVerified(app, body);
    const l = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);
    return { id: r.body.user.id, token: l.body.accessToken };
  }
  async function post() {
    return (
      await request(app)
        .post('/api/v1/posts')
        .set(auth(owner.token))
        .send({ title: 'Recipe update', content: 'Cook rice', visibility: 'PUBLIC' })
        .expect(201)
    ).body.post;
  }
  const body = (p: {
    title: string;
    content: string;
    images: string[];
    visibility: string;
    updatedAt: string;
  }) => ({
    title: p.title,
    content: p.content,
    images: p.images,
    visibility: p.visibility,
    expectedUpdatedAt: p.updatedAt,
  });
  beforeAll(async () => {
    await db.$connect();
    owner = await member('Owner');
    other = await member('Other');
  });
  afterAll(async () => {
    await db.policySetting.update({
      where: { key: 'moderation.bannedKeywords' },
      data: { value: [] },
    });
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });
  it('rejects edits/deletes by other users and validates the full update DTO', async () => {
    const p = await post();
    await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(other.token))
      .send(body(p))
      .expect(404);
    await request(app).delete(`/api/v1/community/posts/${p.id}`).set(auth(other.token)).expect(404);
    await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send({ ...body(p), userId: other.id })
      .expect(400);
    await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send({ ...body(p), content: '', images: [] })
      .expect(400);
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('PUBLISHED');
  });
  it('edits Burmese text, photos and audience, and rejects stale edits', async () => {
    const p = await post();
    const edited = await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send({
        ...body(p),
        content: 'က'.repeat(18000),
        images: ['https://example.test/recipe.jpg'],
        visibility: 'PRIVATE',
      })
      .expect(200);
    expect(edited.body.post.content.length).toBe(18000);
    expect(edited.body.post.images).toEqual(['https://example.test/recipe.jpg']);
    expect(edited.body.post.updatedAt).not.toBe(p.updatedAt);
    await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send(body(p))
      .expect(409);
    await request(app).get(`/api/v1/community/posts/${p.id}`).set(auth(other.token)).expect(404);
    await request(app).get(`/api/v1/posts/${p.id}/comments`).set(auth(other.token)).expect(404);
    await request(app)
      .post(`/api/v1/posts/${p.id}/comments`)
      .set(auth(other.token))
      .send({ content: 'not allowed' })
      .expect(404);
  });
  it('applies keyword moderation and preserves an existing review hold', async () => {
    const p = await post();
    await db.policySetting.update({
      where: { key: 'moderation.bannedKeywords' },
      data: { value: ['blocked-owner-edit'] },
    });
    const edited = await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send({ ...body(p), content: 'blocked-owner-edit' })
      .expect(200);
    expect(edited.body.post.status).toBe('FLAGGED');
    const clean = await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send({ ...body(edited.body.post), content: 'clean recipe' })
      .expect(200);
    expect(clean.body.post.status).toBe('FLAGGED');
    await db.post.update({ where: { id: p.id }, data: { status: 'BANNED' } });
    await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send(body(clean.body.post))
      .expect(409);
    await db.policySetting.update({
      where: { key: 'moderation.bannedKeywords' },
      data: { value: [] },
    });
  });
  it('ignores in-flight moderation results for superseded edits and deleted posts', async () => {
    const p = await post();
    const worker = new PrismaModerationJobRepository(db);
    const job = await db.moderationJob.create({
      data: { postId: p.id, status: 'PROCESSING', attempts: 1 },
    });
    const claimed = {
      id: job.id,
      targetType: 'post' as const,
      targetId: p.id,
      text: 'old content',
      attempts: 1,
    };
    const edited = await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send({ ...body(p), content: 'new content' })
      .expect(200);
    await worker.complete(claimed, true, ['test']);
    await worker.fail(claimed, new Error('stale failure'));
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('PUBLISHED');
    expect((await db.moderationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      'FAILED',
    );
    const nextJob = await db.moderationJob.create({
      data: { postId: p.id, status: 'PROCESSING', attempts: 1 },
    });
    await request(app).delete(`/api/v1/community/posts/${p.id}`).set(auth(owner.token)).expect(204);
    await worker.complete({ ...claimed, id: nextJob.id }, true, ['test']);
    expect((await db.post.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('DELETED');
    await request(app).get(`/api/v1/community/posts/${p.id}`).set(auth(owner.token)).expect(404);
    await request(app)
      .patch(`/api/v1/community/posts/${p.id}`)
      .set(auth(owner.token))
      .send(body(edited.body.post))
      .expect(404);
    await request(app).delete(`/api/v1/community/posts/${p.id}`).set(auth(owner.token)).expect(204);
  });
  it('keeps shared posts attributed after edits and hides originals after deletion', async () => {
    const p = await post();
    const shared = await request(app)
      .post(`/api/v1/community/posts/${p.id}/share`)
      .set(auth(other.token))
      .send({})
      .expect(201);
    const sharedPost = (
      await request(app)
        .get(`/api/v1/community/posts/${shared.body.post.id}`)
        .set(auth(other.token))
        .expect(200)
    ).body.post;
    await request(app)
      .patch(`/api/v1/community/posts/${sharedPost.id}`)
      .set(auth(other.token))
      .send({
        ...body(sharedPost),
        content: 'my caption',
        images: ['https://example.test/image.jpg'],
      })
      .expect(400);
    await request(app)
      .patch(`/api/v1/community/posts/${sharedPost.id}`)
      .set(auth(other.token))
      .send({ ...body(sharedPost), content: 'my caption', images: [] })
      .expect(200);
    await request(app).delete(`/api/v1/community/posts/${p.id}`).set(auth(owner.token)).expect(204);
    const read = await request(app)
      .get(`/api/v1/community/posts/${sharedPost.id}`)
      .set(auth(other.token))
      .expect(200);
    expect(read.body.post).toMatchObject({
      content: 'my caption',
      isRepost: true,
      sharedPost: null,
    });
  });
  it('returns newest comments first when requested', async () => {
    const p = await post();
    const first = await request(app)
      .post(`/api/v1/posts/${p.id}/comments`)
      .set(auth(owner.token))
      .send({ content: 'first' })
      .expect(201);
    const second = await request(app)
      .post(`/api/v1/posts/${p.id}/comments`)
      .set(auth(owner.token))
      .send({ content: 'second' })
      .expect(201);
    await db.comment.update({
      where: { id: first.body.comment.id },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    const result = await request(app)
      .get(`/api/v1/posts/${p.id}/comments?sort=newest`)
      .set(auth(owner.token))
      .expect(200);
    expect(result.body.data.map((item: { id: string }) => item.id)).toEqual([
      second.body.comment.id,
      first.body.comment.id,
    ]);
  });
});
