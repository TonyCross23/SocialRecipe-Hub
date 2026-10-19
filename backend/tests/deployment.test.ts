import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const generator = resolve('scripts/create-production-env.mjs');
const vercelValidator = resolve('../frontend/scripts/validate-deploy-env.mjs');
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);

describe('production deployment configuration', () => {
  it('generates independent secrets, explicitly imports services, and preserves existing values', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'socialrecipe-production-'));
    directories.push(directory);
    const output = resolve(directory, '.env.production');
    const source = resolve(directory, '.env.local');
    writeFileSync(
      source,
      'SMTP_HOST=smtp.gmail.com\nSMTP_PASSWORD=literal$dollar\nGROQ_CHAT_MODEL=test-model\nJWT_ACCESS_SECRET=development-secret\n',
    );
    const args = [
      generator,
      '--output',
      output,
      '--source',
      source,
      '--domain',
      'api.example.com',
      '--email',
      'deploy@example.com',
      '--frontend-origin',
      'https://admin.example.com',
    ];
    execFileSync(process.execPath, args);
    const first = readFileSync(output, 'utf8');
    const env = dotenv.parse(first);
    expect(env.API_DOMAIN).toBe('api.example.com');
    expect(env.LETSENCRYPT_EMAIL).toBe('deploy@example.com');
    expect(env.CORS_ORIGINS).toBe('https://admin.example.com');
    expect(env.SMTP_PASSWORD).toBe('literal$dollar');
    expect(env.GROQ_CHAT_MODEL).toBe('test-model');
    expect(env.JWT_ACCESS_SECRET).toHaveLength(96);
    expect(env.JWT_ACCESS_SECRET).not.toBe(env.JWT_REFRESH_SECRET);
    expect(env.POSTGRES_PASSWORD).toMatch(/^[a-f0-9]{96}$/);
    expect(statSync(output).mode & 0o777).toBe(0o600);
    writeFileSync(source, 'SMTP_PASSWORD=changed-source\n');
    execFileSync(process.execPath, args);
    expect(readFileSync(output, 'utf8')).toBe(first);
    const invalid = spawnSync(process.execPath, [
      generator,
      '--output',
      output,
      '--domain',
      'https://bad.example.com',
    ]);
    expect(invalid.status).not.toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(first);
  });

  it('requires an HTTPS API URL for Vercel and keeps local proxy builds supported', () => {
    const run = (vercel: string, url: string) =>
      spawnSync(process.execPath, [vercelValidator], {
        env: { ...process.env, VERCEL: vercel, VITE_API_URL: url },
        encoding: 'utf8',
      });
    expect(run('1', '').status).not.toBe(0);
    expect(run('1', 'http://api.example.com/api/v1').status).not.toBe(0);
    expect(run('1', 'https://api.example.com').status).not.toBe(0);
    expect(run('1', 'https://api.example.com/api/v1?token=bad').status).not.toBe(0);
    expect(run('1', 'https://api.example.com/api/v1').status).toBe(0);
    expect(run('0', '').status).toBe(0);
  });

  it('boots the HTTP proxy before requesting a certificate and rejects missing certificate email', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'socialrecipe-ssl-'));
    directories.push(directory);
    const envFile = resolve(directory, '.env.production');
    const log = resolve(directory, 'commands.log');
    writeFileSync(envFile, 'API_DOMAIN=api.example.com\nLETSENCRYPT_EMAIL=deploy@example.com\n');
    writeFileSync(
      resolve(directory, 'docker'),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DEPLOY_COMMAND_LOG"\n',
      { mode: 0o700 },
    );
    const options = {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, DEPLOY_COMMAND_LOG: log },
    };
    execFileSync(
      process.execPath,
      [resolve('scripts/init-production-ssl.mjs'), '--env-file', envFile],
      options,
    );
    const commands = readFileSync(log, 'utf8').trim().split('\n');
    expect(commands).toHaveLength(3);
    expect(commands[0]).toContain('up --build -d --wait nginx');
    expect(commands[1]).toContain('--entrypoint certbot certbot certonly');
    expect(commands[1]).toContain('--cert-name socialrecipe-api -d api.example.com');
    expect(commands[1]).toContain('--deploy-hook touch /var/www/certbot/.reload-nginx');
    expect(commands[2]).toContain('up -d --no-deps certbot');
    writeFileSync(envFile, 'API_DOMAIN=api.example.com\n');
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/init-production-ssl.mjs'), '--env-file', envFile],
      options,
    );
    expect(result.status).not.toBe(0);
    expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(3);
  });
});
