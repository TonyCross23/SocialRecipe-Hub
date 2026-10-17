import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { authenticate, requirePermission } from '../auth/auth.middleware.js';
import type { AuthUseCases } from '../auth/use-cases/auth.use-cases.js';
import { AppError } from '../../errors.js';
import { MAX_IMAGE_BYTES, type MediaService } from './media.service.js';

export function createMediaRouter(auth: AuthUseCases, media: MediaService) {
  const router = Router();
  const multipart = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_BYTES,
      files: 1,
      fields: 0,
      parts: 1,
    },
  }).single('file');
  // Bound buffers and CPU work even when several clients upload simultaneously.
  let inFlight = 0;
  const available: RequestHandler = (_request, response, next) => {
    media.ensureConfigured();
    response.setHeader('Cache-Control', 'no-store');
    if (inFlight >= 4)
      throw new AppError(503, 'UPLOAD_BUSY', 'Uploads are busy. Please try again shortly.');
    inFlight++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        inFlight--;
      }
    };
    response.once('finish', release);
    response.once('close', release);
    next();
  };
  const parse: RequestHandler = (request, response, next) => {
    multipart(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          new AppError(
            error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
            'INVALID_UPLOAD',
            error.code === 'LIMIT_FILE_SIZE'
              ? 'Choose an image under 10 MB.'
              : 'Send exactly one image in the file field.',
          ),
        );
      } else if (error) {
        next(new AppError(400, 'INVALID_UPLOAD', 'Invalid multipart image upload.'));
      } else if (!request.file) {
        next(new AppError(400, 'IMAGE_REQUIRED', 'Send an image in the file field.'));
      } else next();
    });
  };
  const upload =
    (registration: boolean): RequestHandler =>
    async (request, response) => {
      const owner = registration ? 'registration' : response.locals.actor!.user.id;
      const result = await media.upload(request.file!.buffer, owner);
      response.status(201).json(result);
    };
  const rateOptions = {
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    message: {
      error: {
        code: 'UPLOAD_RATE_LIMITED',
        message: 'Too many image uploads. Please try again later.',
      },
    },
  };

  router.post(
    '/images',
    authenticate(auth),
    requirePermission('post:create'),
    rateLimit({
      ...rateOptions,
      windowMs: 15 * 60_000,
      limit: 30,
      keyGenerator: (_request, response) => response.locals.actor!.user.id,
    }),
    available,
    parse,
    upload(false),
  );

  // Registration precedes authentication: use much lower per-IP and global caps.
  router.post(
    '/registration-images',
    rateLimit({ ...rateOptions, windowMs: 60 * 60_000, limit: 5 }),
    rateLimit({
      ...rateOptions,
      windowMs: 24 * 60 * 60_000,
      limit: 50,
      keyGenerator: () => 'registration-global',
    }),
    available,
    parse,
    upload(true),
  );
  return router;
}
