import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { URL } from 'node:url';
import dotenv from 'dotenv';

const { values: args } = parseArgs({
  options: {
    source: { type: 'string' },
    output: { type: 'string' },
    domain: { type: 'string' },
    email: { type: 'string' },
    'frontend-origin': { type: 'string', multiple: true },
  },
});
const backend = resolve(import.meta.dirname, '..');
const target = args.output ? resolve(args.output) : resolve(backend, '.env.production');
let contents = await readFile(
  existsSync(target) ? target : resolve(backend, '.env.production.example'),
  'utf8',
);
const current = dotenv.parse(contents);

function put(name, value) {
  if (/[\r\n]/.test(value)) throw new Error(`${name} must fit on one line`);
  const line = `${name}='${value.replace(/'/g, "\\'")}'`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  contents = pattern.test(contents)
    ? contents.replace(pattern, () => line)
    : `${contents.trimEnd()}\n${line}\n`;
  current[name] = value;
}

// Import service credentials only when explicitly requested. Production database
// and signing secrets are generated independently from the development stack.
if (args.source) {
  const source = dotenv.parse(await readFile(resolve(args.source), 'utf8'));
  const imported = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'GROQ_API_KEY',
    'GROQ_CHAT_MODEL',
    'AI_CHAT_LANGUAGE',
    'OPENAI_API_KEY',
    'OPENAI_MODERATION_MODEL',
    'MODERATION_WORKER_INTERVAL_MS',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_REQUIRE_TLS',
    'SMTP_FROM',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'PUSH_ENABLED',
    'EXPO_PUSH_ACCESS_TOKEN',
    'SEED_ADMIN_EMAIL',
    'SEED_ADMIN_PASSWORD',
    'SEED_ADMIN_NAME',
    'SEED_ADMIN_DOB',
  ];
  for (const key of imported) {
    // On first creation import configured services, including model/language.
    // On later runs preserve every existing value in the production file.
    if ((!existsSync(target) || !current[key]) && source[key]) put(key, source[key]);
  }
}

if (args.domain !== undefined) {
  const domain = args.domain.trim().toLowerCase();
  if (
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    /\.(localhost|local|internal|test|invalid)$/.test(domain)
  ) {
    throw new Error('--domain must be a public hostname such as api.example.com');
  }
  put('API_DOMAIN', domain);
}

if (args['frontend-origin']) {
  const origins = args['frontend-origin'].map((input) => {
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error('--frontend-origin must be an HTTPS origin without a path');
    }
    return url.origin;
  });
  put('CORS_ORIGINS', [...new Set(origins)].join(','));
}

if (args.email !== undefined) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
    throw new Error('--email must be a valid email address for certificate notices');
  }
  put('LETSENCRYPT_EMAIL', args.email);
}

for (const key of [
  'POSTGRES_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'METRICS_TOKEN',
]) {
  if (!current[key]) put(key, randomBytes(48).toString('hex'));
}
if (!/^[A-Za-z0-9_-]{32,128}$/.test(current.POSTGRES_PASSWORD)) {
  throw new Error(
    'POSTGRES_PASSWORD must have 32–128 URL-safe letters, digits, underscores or hyphens; existing values were not changed',
  );
}
if (
  current.JWT_ACCESS_SECRET.length < 48 ||
  current.JWT_REFRESH_SECRET.length < 48 ||
  current.JWT_ACCESS_SECRET === current.JWT_REFRESH_SECRET ||
  current.METRICS_TOKEN.length < 32
) {
  throw new Error('Existing JWT/metrics secrets are invalid; existing values were not changed');
}

const temporary = `${target}.${randomBytes(6).toString('hex')}.tmp`;
await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' });
await chmod(temporary, 0o600);
await rename(temporary, target);
console.info(
  'Production environment saved with private file permissions. Existing secrets were preserved.',
);
if (!current.API_DOMAIN || !current.CORS_ORIGINS) {
  console.info('Set API_DOMAIN and CORS_ORIGINS before starting the production stack.');
}
