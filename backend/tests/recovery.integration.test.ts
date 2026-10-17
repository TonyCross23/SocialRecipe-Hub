import { registrationMailer, registerVerified } from './fixtures/registration.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createApplicationServices } from '../src/container.js';
import { createDatabase } from '../src/database.js';
import { RecoveryService } from '../src/features/recovery/recovery.service.js';
import { testConfig } from './config.js';
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith('/socialrecipe_test'))
  throw new Error('Requires test DB');
describe.skipIf(!databaseUrl)('password recovery and ban appeals', () => {
  const db = createDatabase(testConfig.DATABASE_URL);
  const prefix = `recovery-${randomUUID()}`;
  const mail: { email: string; code: string }[] = [];
  const recovery = new RecoveryService(
    db,
    {
      send: async (email, code) => {
        mail.push({ email, code });
      },
    },
    testConfig.JWT_REFRESH_SECRET,
  );
  function application() {
    const services = createApplicationServices(db, testConfig, { registrationMailer });
    services.recovery = recovery;
    return createApp(services, testConfig, pino({ level: 'silent' }), async () => {});
  }
  let app = application();
  let member: { id: string; email: string; token: string; password: string };
  let admin: typeof member;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  async function account(label: string) {
    const body = {
      email: `${prefix}-${label}@example.test`,
      name: label,
      password: 'recovery original password!',
      dob: '2000-01-01',
    };
    const registered = await registerVerified(app, body);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);
    return {
      id: registered.body.user.id as string,
      email: body.email,
      password: body.password,
      token: login.body.accessToken as string,
    };
  }
  const credentials = () => ({ email: member.email, password: member.password });
  async function challenge() {
    // Each test is independent from the per-account issuance window.
    await db.passwordReset.updateMany({
      where: { userId: member.id },
      data: { createdAt: new Date(Date.now() - 86400000) },
    });
    const result = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: member.email, language: 'my' })
      .expect(200);
    return { requestId: result.body.requestId as string, code: mail.at(-1)!.code };
  }
  beforeAll(async () => {
    await db.$connect();
    member = await account('member');
    admin = await account('admin');
    const role = await db.role.findUniqueOrThrow({ where: { name: 'admin' } });
    await db.user.update({ where: { id: admin.id }, data: { roleId: role.id } });
  });
  beforeEach(() => {
    app = application();
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.pendingRegistration.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });
  it('returns a generic response, stores no raw code and consumes a valid code once', async () => {
    const { requestId, code } = await challenge();
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `${prefix}-missing@example.test` })
      .expect(200);
    expect(Object.keys(unknown.body).sort()).toEqual(['message', 'requestId']);
    expect(unknown.body).not.toHaveProperty('code');
    expect(
      (await db.passwordReset.findUniqueOrThrow({ where: { id: requestId } })).codeHash,
    ).not.toBe(code);
    const newPassword = 'recovery replacement password!';
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ requestId, code, newPassword })
      .expect(204);
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ requestId, code, newPassword: 'another replacement password!' })
      .expect(400);
    await request(app).get('/api/v1/auth/me').set(as(member.token)).expect(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: newPassword })
      .expect(200);
    member.password = newPassword;
    member.token = login.body.accessToken;
  });
  it('expires codes and locks a challenge after five wrong attempts', async () => {
    let item = await challenge();
    await db.passwordReset.update({
      where: { id: item.requestId },
      data: { expiresAt: new Date(0) },
    });
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ ...item, newPassword: 'replacement password 123!' })
      .expect(400);
    item = await challenge();
    const wrong = item.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ requestId: item.requestId, code: wrong, newPassword: 'replacement password 123!' })
        .expect(400);
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ ...item, newPassword: 'replacement password 123!' })
      .expect(400);
  });
  it('permits only one successful concurrent reset', async () => {
    const item = await challenge();
    const newPassword = 'concurrent password replacement!';
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post('/api/v1/auth/reset-password')
          .send({ ...item, newPassword }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
    member.password = newPassword;
  });
  it('authenticates banned owners, deduplicates pending appeals, notifies admins and approves atomically', async () => {
    await db.user.update({
      where: { id: member.id },
      data: { status: 'BANNED', bannedAt: new Date(), bannedReason: 'Community policy violation' },
    });
    await request(app)
      .post('/api/v1/auth/appeals')
      .send({ ...credentials(), password: 'wrong', message: 'Please review my banned account.' })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ ...credentials(), password: 'wrong' })
      .expect(401);
    await request(app).post('/api/v1/auth/login').send(credentials()).expect(403);
    const submitted = await request(app)
      .post('/api/v1/auth/appeals')
      .send({ ...credentials(), message: 'Please review my banned account.' })
      .expect(201);
    const again = await request(app)
      .post('/api/v1/auth/appeals')
      .send({ ...credentials(), message: 'Please review my banned account again.' })
      .expect(201);
    expect(again.body.appeal.id).toBe(submitted.body.appeal.id);
    expect(await db.notification.count({ where: { userId: admin.id, type: 'BAN_APPEAL' } })).toBe(
      1,
    );
    await request(app).get('/api/v1/admin/appeals').expect(401);
    const listed = await request(app).get('/api/v1/admin/appeals').set(as(admin.token)).expect(200);
    expect(listed.body.data.some((a: { id: string }) => a.id === submitted.body.appeal.id)).toBe(
      true,
    );
    await request(app)
      .patch(`/api/v1/admin/appeals/${submitted.body.appeal.id}`)
      .set(as(admin.token))
      .send({ decision: 'APPROVED', response: 'Your account has been restored.' })
      .expect(200);
    const status = await request(app)
      .post('/api/v1/auth/appeals/status')
      .send(credentials())
      .expect(200);
    expect(status.body.status).toBe('ACTIVE');
    expect(status.body.appeal.response).toBe('Your account has been restored.');
    await request(app)
      .patch(`/api/v1/admin/appeals/${submitted.body.appeal.id}`)
      .set(as(admin.token))
      .send({ decision: 'REJECTED', response: 'Second decision' })
      .expect(409);
  });
  it('rejects unauthorized reviewers and does not unban a newer ban', async () => {
    const login = await request(app).post('/api/v1/auth/login').send(credentials()).expect(200);
    member.token = login.body.accessToken;
    await request(app).get('/api/v1/admin/appeals').set(as(member.token)).expect(403);
    await db.user.update({
      where: { id: member.id },
      data: { status: 'BANNED', bannedAt: new Date(Date.now() - 1000), bannedReason: 'Old ban' },
    });
    const appeal = await request(app)
      .post('/api/v1/auth/appeals')
      .send({ ...credentials(), message: 'Please review this older ban.' })
      .expect(201);
    await db.user.update({
      where: { id: member.id },
      data: { bannedAt: new Date(), bannedReason: 'Newer ban' },
    });
    const reviewed = await request(app)
      .patch(`/api/v1/admin/appeals/${appeal.body.appeal.id}`)
      .set(as(admin.token))
      .send({ decision: 'APPROVED', response: 'Old appeal reviewed.' })
      .expect(200);
    expect(reviewed.body.appeal.status).toBe('STALE');
    expect((await db.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe('BANNED');
  });
  it('keeps a rejected account banned, including after password recovery', async () => {
    const submitted = await request(app)
      .post('/api/v1/auth/appeals')
      .send({ ...credentials(), message: 'Please review my current account restriction.' })
      .expect(201);
    await request(app)
      .patch(`/api/v1/admin/appeals/${submitted.body.appeal.id}`)
      .set(as(admin.token))
      .send({ decision: 'REJECTED', response: 'The restriction remains in place.' })
      .expect(200);
    const item = await challenge();
    const newPassword = 'banned account recovered password!';
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ ...item, newPassword })
      .expect(204);
    member.password = newPassword;
    expect((await db.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe('BANNED');
    const status = await request(app)
      .post('/api/v1/auth/appeals/status')
      .send(credentials())
      .expect(200);
    expect(status.body.appeal.status).toBe('REJECTED');
    expect(status.body.appeal.response).toBe('The restriction remains in place.');
    await request(app).post('/api/v1/auth/login').send(credentials()).expect(403);
  });
});
