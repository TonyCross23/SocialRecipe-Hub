import type { Config } from '../src/config.js';

export const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 4000,
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://unused:unused@localhost/socialrecipe_test',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  JWT_ISSUER: 'socialrecipe-test',
  JWT_AUDIENCE: 'test-client',
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 604800,
  SESSION_TTL_SECONDS: 2592000,
  CORS_ORIGINS: ['http://localhost:3000'],
  TRUST_PROXY_HOPS: 0,
  LOG_LEVEL: 'silent',
  OPENAI_MODERATION_MODEL: 'omni-moderation-latest',
  MODERATION_WORKER_INTERVAL_MS: 5000,
  METRICS_TOKEN: 'm'.repeat(48),
};
