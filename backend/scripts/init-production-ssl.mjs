import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';

const { values: args } = parseArgs({
  options: { 'env-file': { type: 'string' }, email: { type: 'string' } },
});
const backend = resolve(import.meta.dirname, '..');
const envFile = args['env-file'] ? resolve(args['env-file']) : resolve(backend, '.env.production');
const config = dotenv.parse(await readFile(envFile, 'utf8'));
const domain = config.API_DOMAIN ?? '';
const email = args.email ?? config.LETSENCRYPT_EMAIL ?? '';
if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
  throw new Error(
    'Set API_DOMAIN to your public backend hostname before requesting a certificate.',
  );
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error(
    'Set LETSENCRYPT_EMAIL in .env.production or pass --email for certificate notices.',
  );
}

const compose = [
  'compose',
  '--env-file',
  envFile,
  '-f',
  resolve(backend, 'compose.production.yaml'),
];
function run(command) {
  const result = spawnSync('docker', [...compose, ...command], {
    cwd: backend,
    stdio: 'inherit',
    env: { ...process.env, API_DOMAIN: domain },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['up', '--build', '-d', '--wait', 'nginx']);
run([
  'run',
  '--rm',
  '--no-deps',
  '--entrypoint',
  'certbot',
  'certbot',
  'certonly',
  '--non-interactive',
  '--agree-tos',
  '--email',
  email,
  '--webroot',
  '-w',
  '/var/www/certbot',
  '--cert-name',
  'socialrecipe-api',
  '-d',
  domain,
  '--keep-until-expiring',
  '--deploy-hook',
  'touch /var/www/certbot/.reload-nginx',
]);
run(['up', '-d', '--no-deps', 'certbot']);
console.info(
  'Certificate setup finished. Nginx loads successfully issued certificates within 5 seconds.',
);
