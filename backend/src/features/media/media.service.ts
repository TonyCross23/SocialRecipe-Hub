import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
}
export interface ImageStorage {
  upload(data: Buffer, owner: string): Promise<UploadedImage>;
}

export class CloudinaryStorage implements ImageStorage {
  constructor(
    private readonly credentials: {
      cloudName: string;
      apiKey: string;
      apiSecret: string;
    },
  ) {}

  upload(data: Buffer, owner: string): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          cloud_name: this.credentials.cloudName,
          api_key: this.credentials.apiKey,
          api_secret: this.credentials.apiSecret,
          secure: true,
          resource_type: 'image',
          public_id: `socialrecipe/${owner}/${randomUUID()}`,
          overwrite: false,
          allowed_formats: ['webp'],
          tags:
            owner === 'registration' ? ['socialrecipe', 'registration-upload'] : ['socialrecipe'],
          timeout: 20_000,
        },
        (error, result) => {
          if (error || !result?.secure_url?.startsWith('https://')) {
            reject(
              new AppError(502, 'UPLOAD_FAILED', 'Image storage is unavailable. Please try again.'),
            );
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        },
      );
      stream.on('error', () =>
        reject(
          new AppError(502, 'UPLOAD_FAILED', 'Image storage is unavailable. Please try again.'),
        ),
      );
      stream.end(data);
    });
  }
}

export class MediaService {
  constructor(private readonly storage?: ImageStorage) {}

  ensureConfigured() {
    if (!this.storage)
      throw new AppError(503, 'UPLOAD_NOT_CONFIGURED', 'Photo uploads are not available yet.');
  }

  async upload(data: Buffer, owner: string) {
    this.ensureConfigured();
    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new AppError(413, 'IMAGE_TOO_LARGE', 'Choose an image under 10 MB.');
    }
    let normalized: Buffer;
    try {
      const image = sharp(data, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(metadata.format)) {
        throw new Error('Unsupported format');
      }
      // Decode actual pixels (not just MIME headers), orient and strip metadata.
      // Re-encoding also removes appended payloads; no client file paths are used.
      normalized = await image
        .rotate()
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppError(
        415,
        'INVALID_IMAGE',
        'Choose a valid JPEG, PNG, WebP or AVIF image (up to 40 megapixels).',
      );
    }
    return this.storage!.upload(normalized, owner);
  }
}

export function createMediaService(config: Config) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = config;
  return new MediaService(
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
      ? new CloudinaryStorage({
          cloudName: CLOUDINARY_CLOUD_NAME,
          apiKey: CLOUDINARY_API_KEY,
          apiSecret: CLOUDINARY_API_SECRET,
        })
      : undefined,
  );
}
