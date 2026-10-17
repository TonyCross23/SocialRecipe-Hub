import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import type { ApplicationServices } from '../src/container.js';
import { testConfig } from './config.js';

function setup() {
  const createPost = vi.fn(async (_userId: string, data: unknown) => ({
    id: 'test-post',
    ...(data as object),
  }));
  const services = {
    auth: {
      authenticate: vi.fn(async () => ({
        sessionId: 'test',
        user: { id: 'test-user', permissions: ['post:create'] },
      })),
    },
    posts: { createPost },
  } as unknown as ApplicationServices;
  const app = createApp(services, testConfig, pino({ level: 'silent' }), async () => {});
  return { app, createPost };
}

describe('post JSON body limits', () => {
  it.each(['/api/v1/posts', '/api/v1/posts/'])(
    'accepts valid Burmese content exceeding 32 KiB at %s',
    async (path) => {
      const { app, createPost } = setup();
      const data = {
        title: 'မြန်မာ ဟင်းချက်နည်း',
        content: 'က'.repeat(18000),
        images: [],
        visibility: 'PRIVATE',
      };
      expect(Buffer.byteLength(JSON.stringify(data))).toBeGreaterThan(32768);
      await request(app).post(path).set('Authorization', 'Bearer test').send(data).expect(201);
      expect(createPost).toHaveBeenCalledWith('test-user', data);
    },
  );
  it('retains field validation and rejects genuinely oversized post bodies', async () => {
    const { app, createPost } = setup();
    const data = { title: 'Recipe', images: [], visibility: 'PRIVATE' };
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer test')
      .send({ ...data, content: 'a'.repeat(20001) })
      .expect(400);
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer test')
      .send({ ...data, content: 'a'.repeat(600000) })
      .expect(413);
    expect(createPost).not.toHaveBeenCalled();
  });
  it('preserves the smaller 32 KiB limit for authentication requests', async () => {
    const { app } = setup();
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a'.repeat(40000) })
      .expect(413);
  });
});
