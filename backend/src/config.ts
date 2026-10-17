import 'dotenv/config';
import { z } from 'zod';

const jwtSecret = z
  .string()
  .min(48)
  .refine((value) => !value.startsWith('replace-'), 'Generate a random JWT secret');

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url().refine((url) => /^postgres(ql)?:/.test(url)),
    JWT_ACCESS_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtSecret,
    JWT_ISSUER: z.string().min(1).default('socialrecipe-api'),
    JWT_AUDIENCE: z.string().min(1).default('socialrecipe-clients'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(2592000).default(604800),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(7776000).default(2592000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    OPENAI_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(20).optional(),
    ),
    GROQ_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(20).optional(),
    ),
    SMTP_HOST: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SMTP_REQUIRE_TLS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SMTP_FROM: z.string().default('SocialRecipe <no-reply@socialrecipe.local>'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    PUSH_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    EXPO_PUSH_ACCESS_TOKEN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(20).optional(),
    ),
    GROQ_CHAT_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
    AI_CHAT_LANGUAGE: z.enum(['english', 'auto', 'burmese']).default('english'),
    OPENAI_MODERATION_MODEL: z.string().min(1).default('omni-moderation-latest'),
    MODERATION_WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
    METRICS_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32).optional(),
    ),
    CLOUDINARY_CLOUD_NAME: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .optional(),
    ),
    CLOUDINARY_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    CLOUDINARY_API_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
  })
  .refine((config) => {
    const present = [
      config.CLOUDINARY_CLOUD_NAME,
      config.CLOUDINARY_API_KEY,
      config.CLOUDINARY_API_SECRET,
    ].filter(Boolean).length;
    return present === 0 || present === 3;
  }, 'Set all three Cloudinary credentials together, or leave all three empty')
  .refine(
    (config) => config.JWT_ACCESS_SECRET !== config.JWT_REFRESH_SECRET,
    'Access and refresh secrets must differ',
  )
  .refine(
    (config) => config.SESSION_TTL_SECONDS >= config.REFRESH_TOKEN_TTL_SECONDS,
    'Session lifetime must cover refresh lifetime',
  );

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse(process.env);
}
