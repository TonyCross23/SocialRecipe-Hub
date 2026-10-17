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
  throw new Error('Requires isolated test DB');
describe.skipIf(!databaseUrl)('profile editing', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const app = createApp(
    createApplicationServices(db, testConfig, { registrationMailer }),
    testConfig,
    pino({ level: 'silent' }),
    async () => {},
  );
  const prefix = `profile-edit-${randomUUID()}`;
  let alice: { id: string; token: string; email: string };
  let bob: typeof alice;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const input = {
    name: 'မြန်မာ စားဖိုမှူး',
    dob: '1998-05-12',
    image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  };
  async function member(name: string) {
    const email = `${prefix}-${name}@example.test`;
    const result = await registerVerified(app, {
      name,
      email,
      password: 'profile test password 123!',
      dob: '2000-01-01',
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'profile test password 123!' })
      .expect(200);
    return { id: result.body.user.id as string, token: login.body.accessToken as string, email };
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
  it('updates only the authenticated member and keeps email/role/password unchanged', async () => {
    await request(app).patch('/api/v1/auth/me').send(input).expect(401);
    const result = await request(app)
      .patch('/api/v1/auth/me')
      .set(as(alice.token))
      .send(input)
      .expect(200);
    expect(result.body.user).toMatchObject({
      ...input,
      id: alice.id,
      email: alice.email.toLowerCase(),
      role: 'member',
    });
    expect(result.body.user).not.toHaveProperty('passwordHash');
    const other = await request(app).get('/api/v1/auth/me').set(as(bob.token)).expect(200);
    expect(other.body.user.name).toBe('Bob');
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: alice.email, password: 'profile test password 123!' })
      .expect(200);
  });
  it('reflects new author details while keeping birthday/email private on public profiles', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set(as(alice.token))
      .send({ title: 'Profile recipe test', content: 'My recipe', visibility: 'PUBLIC' })
      .expect(201);
    const post = await request(app)
      .get(`/api/v1/community/posts/${created.body.post.id}`)
      .set(as(bob.token))
      .expect(200);
    expect(post.body.post.author).toMatchObject({ name: input.name, image: input.image });
    const profile = await request(app)
      .get(`/api/v1/community/users/${alice.id}`)
      .set(as(bob.token))
      .expect(200);
    expect(profile.body.user).not.toHaveProperty('dob');
    expect(profile.body.user).not.toHaveProperty('email');
  });
  it('rejects invalid values and attempts to modify another account or privileged fields', async () => {
    for (const invalid of [
      { ...input, name: 'x' },
      { ...input, dob: '2999-01-01' },
      { ...input, image: 'http://example.test/photo.jpg' },
      { ...input, userId: bob.id },
      { ...input, roleId: randomUUID() },
      { ...input, email: bob.email },
    ]) {
      await request(app).patch('/api/v1/auth/me').set(as(alice.token)).send(invalid).expect(400);
    }
    await request(app)
      .patch('/api/v1/auth/me')
      .set(as(alice.token))
      .send({ ...input, image: null })
      .expect(200);
    const me = await request(app).get('/api/v1/auth/me').set(as(alice.token)).expect(200);
    expect(me.body.user.image).toBeNull();
  });
});
