import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
describe.skipIf(!databaseUrl)('email verified registration', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const prefix = `verification-${randomUUID()}`;
  const mail: { email: string; code: string; language: string }[] = [];
  let failMail = false;
  function application() {
    const services = createApplicationServices(db, testConfig, {
      registrationMailer: {
        async send(email, code, language) {
          if (failMail) throw new Error('private SMTP failure');
          mail.push({ email, code, language });
        },
      },
    });
    return createApp(services, testConfig, pino({ level: 'silent' }), async () => {});
  }
  let app = application();
  const input = (label: string) => ({
    email: `${prefix}-${label}@example.test`,
    name: 'A Cook',
    password: 'verified registration password!',
    dob: '2000-01-01',
  });
  async function start(label: string) {
    const body = input(label);
    const response = await request(app).post('/api/v1/auth/register').send(body).expect(202);
    return {
      requestId: response.body.requestId as string,
      code: mail.at(-1)!.code,
      body,
      response,
    };
  }
  const verify = (challenge: { requestId: string; code: string }) =>
    request(app)
      .post('/api/v1/auth/register/verify')
      .send({ requestId: challenge.requestId, code: challenge.code });
  beforeAll(() => db.$connect());
  beforeEach(() => {
    failMail = false;
    app = application();
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });
  it('creates no account or session until the email code is verified, then consumes it', async () => {
    const item = await start('success');
    expect(item.response.body).not.toHaveProperty('code');
    expect(item.response.body).not.toHaveProperty('user');
    expect(item.response.headers['cache-control']).toBe('no-store');
    expect(await db.user.count({ where: { email: item.body.email } })).toBe(0);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: item.body.email, password: item.body.password })
      .expect(401);
    const pending = await db.pendingRegistration.findUniqueOrThrow({
      where: { id: item.requestId },
    });
    expect(pending.passwordHash).toMatch(/^\$argon2id\$/);
    expect(pending.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(pending.codeHash).not.toBe(item.code);
    expect(mail.at(-1)!.language).toBe('en');
    const result = await verify(item).expect(201);
    expect(result.body.user.role).toBe('member');
    expect(result.body.user.image).toBeNull();
    expect(result.body).not.toHaveProperty('accessToken');
    expect(result.body.user).not.toHaveProperty('passwordHash');
    const user = await db.user.findUniqueOrThrow({ where: { email: item.body.email } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await db.authSession.count({ where: { userId: user.id } })).toBe(0);
    expect(
      (await db.pendingRegistration.findUniqueOrThrow({ where: { id: item.requestId } }))
        .passwordHash,
    ).toBe('');
    await verify(item).expect(400);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: item.body.email, password: item.body.password })
      .expect(200);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...item.body, email: item.body.email.toUpperCase() })
      .expect(409);
  });
  it('expires codes and persists five wrong attempts without creating an account', async () => {
    const expired = await start('expired');
    await db.pendingRegistration.update({
      where: { id: expired.requestId },
      data: { expiresAt: new Date(0) },
    });
    await verify(expired).expect(400);
    const item = await start('attempts');
    const wrong = item.code === '000000' ? '111111' : '000000';
    for (let n = 0; n < 5; n++) await verify({ ...item, code: wrong }).expect(400);
    await verify(item).expect(400);
    expect(
      (await db.pendingRegistration.findUniqueOrThrow({ where: { id: item.requestId } })).attempts,
    ).toBe(5);
    expect(await db.user.count({ where: { email: item.body.email } })).toBe(0);
  });
  it('resends only after cooldown, invalidates the old code and limits emails per address', async () => {
    const item = await start('resend');
    const resend = () =>
      request(app).post('/api/v1/auth/register/resend').send({ requestId: item.requestId });
    await resend().expect(429);
    await db.pendingRegistration.update({
      where: { id: item.requestId },
      data: { lastSentAt: new Date(Date.now() - 61000) },
    });
    await resend().expect(200);
    const newCode = mail.at(-1)!.code;
    if (newCode !== item.code) await verify(item).expect(400);
    await db.pendingRegistration.update({
      where: { id: item.requestId },
      data: { lastSentAt: new Date(Date.now() - 61000) },
    });
    await resend().expect(200);
    const finalCode = mail.at(-1)!.code;
    await db.pendingRegistration.update({
      where: { id: item.requestId },
      data: { lastSentAt: new Date(Date.now() - 61000) },
    });
    await resend().expect(429);
    await request(app).post('/api/v1/auth/register').send(item.body).expect(429);
    await verify({ ...item, code: finalCode }).expect(201);
    await resend().expect(400);
  });
  it('serializes simultaneous consumption of the same code', async () => {
    const item = await start('concurrent');
    const results = await Promise.all([verify(item), verify(item)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await db.user.count({ where: { email: item.body.email } })).toBe(1);
  });
  it('allows only one account across independent pending challenges for one address', async () => {
    const first = await start('duplicates');
    const second = await start('duplicates');
    const results = await Promise.all([verify(first), verify(second)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await db.user.count({ where: { email: first.body.email } })).toBe(1);
  });
  it('fails closed on SMTP failure without exposing private details or creating a user', async () => {
    failMail = true;
    const body = input('smtp');
    const result = await request(app).post('/api/v1/auth/register').send(body).expect(503);
    expect(result.body.error.code).toBe('VERIFICATION_MAIL_FAILED');
    expect(JSON.stringify(result.body)).not.toContain('private SMTP');
    expect(await db.user.count({ where: { email: body.email } })).toBe(0);
    const pending = await db.pendingRegistration.findFirstOrThrow({ where: { email: body.email } });
    expect(pending.usedAt).not.toBeNull();
    expect(pending.passwordHash).toBe('');
  });
  it('rejects invalid DTOs, privilege fields and photo fields before sending email', async () => {
    const before = mail.length;
    for (const extra of [
      { role: 'admin' },
      { image: 'https://example.com/image.jpg' },
      { dob: '2999-01-01' },
      { email: 'invalid' },
    ]) {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ ...input('invalid'), ...extra })
        .expect(400);
    }
    expect(mail.length).toBe(before);
    await verify({ requestId: randomUUID(), code: '123456' }).expect(400);
  });
});
