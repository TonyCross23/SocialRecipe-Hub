import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);
function temporary() {
  const directory = mkdtempSync(resolve(tmpdir(), 'socialrecipe-cicd-'));
  directories.push(directory);
  return directory;
}
function executable(path: string, contents: string) {
  writeFileSync(path, `#!/usr/bin/env bash\nset -eu\n${contents}\n`, { mode: 0o700 });
}

describe('CI/CD deployment boundary', () => {
  it('packages backend source without environment files, dependencies or generated code and verifies the SSH host', () => {
    const directory = temporary();
    const backend = resolve(directory, 'workspace/backend');
    const binaries = resolve(directory, 'bin');
    mkdirSync(resolve(backend, 'deploy'), { recursive: true });
    mkdirSync(resolve(backend, 'src/generated'), { recursive: true });
    mkdirSync(resolve(backend, 'node_modules'), { recursive: true });
    mkdirSync(binaries);
    writeFileSync(resolve(backend, 'src/server.ts'), 'application source');
    writeFileSync(resolve(backend, 'src/generated/client.ts'), 'generated');
    writeFileSync(resolve(backend, 'node_modules/dependency'), 'dependency');
    writeFileSync(resolve(backend, '.env'), 'PRIVATE_LOCAL_VALUE=secret');
    writeFileSync(resolve(backend, '.env.production'), 'PRIVATE_PRODUCTION_VALUE=secret');
    writeFileSync(resolve(backend, 'deploy/deploy-release.sh'), 'echo deployment');
    executable(
      resolve(binaries, 'ssh'),
      'printf "%s\\n" "$*" >> "$COMMAND_LOG"\nif [[ "$*" == *"bash -s --"* ]]; then cat > /dev/null; fi',
    );
    executable(
      resolve(binaries, 'scp'),
      'printf "%s\\n" "$*" >> "$COMMAND_LOG"\ncp -- "${@: -2:1}" "$CAPTURE_ARCHIVE"',
    );
    const log = resolve(directory, 'commands');
    const archive = resolve(directory, 'captured.tar.gz');
    const env = {
      ...process.env,
      PATH: `${binaries}:${process.env.PATH}`,
      AWS_HOST: 'api.example.com',
      AWS_USER: 'ubuntu',
      AWS_DEPLOY_PATH: '/opt/socialrecipe',
      AWS_SSH_PORT: '22',
      AWS_SSH_PRIVATE_KEY: 'synthetic-test-key',
      AWS_SSH_KNOWN_HOSTS: 'synthetic-host-key',
      GITHUB_SHA: 'a'.repeat(40),
      GITHUB_RUN_ID: '1',
      GITHUB_RUN_ATTEMPT: '1',
      RUNNER_TEMP: directory,
      GITHUB_WORKSPACE: resolve(directory, 'workspace'),
      COMMAND_LOG: log,
      CAPTURE_ARCHIVE: archive,
    };
    execFileSync('bash', [resolve('deploy/github-deploy.sh')], { env });
    const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
    expect(names).toContain('./src/server.ts');
    expect(names).not.toContain('.env');
    expect(names).not.toContain('node_modules');
    expect(names).not.toContain('src/generated');
    const commands = readFileSync(log, 'utf8');
    expect(commands).toContain('StrictHostKeyChecking=yes');
    expect(commands).not.toContain('synthetic-test-key');
    const bad = spawnSync('bash', [resolve('deploy/github-deploy.sh')], {
      env: { ...env, AWS_HOST: 'bad;host' },
    });
    expect(bad.status).not.toBe(0);
    for (const path of ['/', '/.', '/opt/../', '/opt/./application', '//opt/application']) {
      const invalidPath = spawnSync('bash', [resolve('deploy/github-deploy.sh')], {
        env: { ...env, AWS_DEPLOY_PATH: path },
      });
      expect(invalidPath.status).not.toBe(0);
    }
    expect(readFileSync(log, 'utf8')).toBe(commands);
  });

  it('backs up before migration, promotes only after HTTPS readiness, and refuses a corrupt release', () => {
    const directory = temporary();
    const root = resolve(directory, 'application');
    const fixture = resolve(directory, 'source');
    const binaries = resolve(directory, 'bin');
    mkdirSync(resolve(root, 'shared'), { recursive: true });
    mkdirSync(resolve(root, 'incoming'));
    mkdirSync(fixture);
    mkdirSync(binaries);
    const environment = resolve(root, 'shared/.env.production');
    writeFileSync(environment, 'POSTGRES_PASSWORD=synthetic-only\n', { mode: 0o600 });
    writeFileSync(resolve(fixture, 'compose.production.yaml'), 'services: {}\n');
    executable(
      resolve(binaries, 'docker'),
      `
printf "%s\\n" "$*" >> "$COMMAND_LOG"
if [[ "$*" == *"exec -T postgres pg_dump"* ]]; then
  if [[ "\u0024{FAIL_BACKUP:-}" == 1 ]]; then exit 1; fi
  printf 'test database backup\\n'
elif [[ "$*" == *"exec -T nginx printenv API_DOMAIN"* ]]; then
  printf 'api.example.com\\n'
fi`,
    );
    executable(
      resolve(binaries, 'curl'),
      'printf "%s\\n" "$*" >> "$COMMAND_LOG"\nif [[ "${FAIL_HEALTH:-}" == 1 ]]; then exit 22; fi',
    );
    const log = resolve(directory, 'commands');
    const env = { ...process.env, PATH: `${binaries}:${process.env.PATH}`, COMMAND_LOG: log };
    function release(number: number) {
      const id = `${'b'.repeat(40)}-${number}-1`;
      const archive = resolve(root, `incoming/${id}.tar.gz`);
      execFileSync('tar', ['-czf', archive, '-C', fixture, '.']);
      const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
      return { id, checksum };
    }
    const script = resolve('deploy/deploy-release.sh');
    const first = release(1);
    execFileSync('bash', [script, root, first.id, first.checksum], { env });
    expect(readlinkSync(resolve(root, 'current'))).toBe(`releases/${first.id}`);
    expect(readlinkSync(resolve(root, `releases/${first.id}/.env.production`))).toBe(environment);
    expect(readFileSync(environment, 'utf8')).toBe('POSTGRES_PASSWORD=synthetic-only\n');
    const backup = readFileSync(resolve(root, `shared/backups/${first.id}.sql.gz`));
    expect(gunzipSync(backup).toString()).toBe('test database backup\n');
    const commands = readFileSync(log, 'utf8');
    expect(commands.indexOf('pg_dump')).toBeLessThan(
      commands.indexOf('up -d --wait --wait-timeout 180'),
    );
    expect(commands).toContain('https://api.example.com/health/ready');

    const failed = release(2);
    const unhealthy = spawnSync('bash', [script, root, failed.id, failed.checksum], {
      env: { ...env, FAIL_HEALTH: '1' },
    });
    expect(unhealthy.status).not.toBe(0);
    expect(readlinkSync(resolve(root, 'current'))).toBe(`releases/${first.id}`);
    expect(existsSync(resolve(root, `releases/${failed.id}/DEPLOYED_RELEASE`))).toBe(false);

    writeFileSync(log, '');
    const noBackup = release(3);
    const backupFailure = spawnSync('bash', [script, root, noBackup.id, noBackup.checksum], {
      env: { ...env, FAIL_BACKUP: '1' },
    });
    expect(backupFailure.status).not.toBe(0);
    expect(readFileSync(log, 'utf8')).not.toContain('up -d --wait --wait-timeout 180');
    expect(existsSync(resolve(root, `shared/backups/${noBackup.id}.sql.gz`))).toBe(false);

    const corrupt = release(4);
    const rejected = spawnSync('bash', [script, root, corrupt.id, '0'.repeat(64)], { env });
    expect(rejected.status).not.toBe(0);
    expect(existsSync(resolve(root, `releases/${corrupt.id}`))).toBe(false);
  });
});
