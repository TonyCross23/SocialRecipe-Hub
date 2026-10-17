import { describe, expect, it, vi } from 'vitest';
import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { createMediaRouter } from '../src/features/media/media.routes.js';
import { MAX_IMAGE_BYTES, MediaService } from '../src/features/media/media.service.js';
import { AppError } from '../src/errors.js';
import type { AuthUseCases } from '../src/features/auth/use-cases/auth.use-cases.js';

const output = {
  url: 'https://res.cloudinary.com/test/image/upload/photo.webp',
  publicId: 'socialrecipe/user/photo',
  width: 2,
  height: 2,
};
async function fixture() {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: '#267451' } })
    .png()
    .toBuffer();
}
function setup(configured = true, permission = true) {
  const upload = vi.fn(async (_data: Buffer, _owner: string) => output);
  const media = new MediaService(configured ? { upload } : undefined);
  const auth = {
    authenticate: vi.fn(async (token: string) => {
      if (token !== 'valid') throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
      return {
        sessionId: 'session',
        user: { id: 'user', permissions: permission ? ['post:create'] : [] },
      };
    }),
  } as unknown as AuthUseCases;
  const app = express();
  app.use('/api/v1/media', createMediaRouter(auth, media));
  const errors: ErrorRequestHandler = (error, _request, response, _next) => {
    response
      .status(error instanceof AppError ? error.status : 500)
      .json({ error: { code: error.code, message: error.message } });
  };
  app.use(errors);
  return { app, media, upload };
}

describe('Cloudinary image upload boundary', () => {
  it('decodes an image, strips input encoding and uploads WebP', async () => {
    const { media, upload } = setup();
    expect(await media.upload(await fixture(), 'user')).toEqual(output);
    const buffer = upload.mock.calls[0]?.[0];
    expect((await sharp(buffer).metadata()).format).toBe('webp');
  });
  it('rejects non-images, SVG, corrupt pixels and oversized buffers before storage', async () => {
    const { media, upload } = setup();
    for (const data of [
      Buffer.from('not an image'),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>'),
      (await fixture()).subarray(0, 45),
    ]) {
      await expect(media.upload(data, 'user')).rejects.toMatchObject({ status: 415 });
    }
    await expect(media.upload(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'user')).rejects.toMatchObject({
      status: 413,
    });
    expect(upload).not.toHaveBeenCalled();
  });
  it('returns a recoverable unavailable state without Cloudinary credentials', async () => {
    const { app } = setup(false);
    const result = await request(app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .attach('file', await fixture(), 'photo.png')
      .expect(503);
    expect(result.body.error.code).toBe('UPLOAD_NOT_CONFIGURED');
  });
  it('authenticates and checks permissions before parsing uploads', async () => {
    const { app, upload } = setup();
    await request(app)
      .post('/api/v1/media/images')
      .attach('file', await fixture(), 'photo.png')
      .expect(401);
    await request(setup(true, false).app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .attach('file', await fixture(), 'photo.png')
      .expect(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it('accepts one multipart file and returns the URL expected by the mobile app', async () => {
    const { app } = setup();
    const result = await request(app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .attach('file', await fixture(), { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);
    expect(result.body).toEqual(output);
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('rejects missing, duplicate and incorrectly named file parts', async () => {
    const { app, upload } = setup();
    await request(app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .expect(400);
    await request(app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .attach('photo', await fixture(), 'photo.png')
      .expect(400);
    await request(app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .attach('file', await fixture(), 'one.png')
      .attach('file', await fixture(), 'two.png')
      .expect(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it('supports bounded profile uploads before authentication', async () => {
    const { app, upload } = setup();
    await request(app)
      .post('/api/v1/media/registration-images')
      .attach('file', await fixture(), 'profile.png')
      .expect(201);
    expect(upload).toHaveBeenCalledWith(expect.any(Buffer), 'registration');
  });
  it('enforces multipart size and anonymous registration rate limits', async () => {
    const { app } = setup();
    await request(app)
      .post('/api/v1/media/images')
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.alloc(MAX_IMAGE_BYTES + 1), 'large.png')
      .expect(413);
    const image = await fixture();
    for (let count = 0; count < 5; count++) {
      await request(app)
        .post('/api/v1/media/registration-images')
        .attach('file', image, 'profile.png')
        .expect(201);
    }
    await request(app)
      .post('/api/v1/media/registration-images')
      .attach('file', image, 'profile.png')
      .expect(429);
  });
});
