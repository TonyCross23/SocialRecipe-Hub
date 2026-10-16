import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const targetPath = resolve(projectDirectory, '.env.docker');
const examplePath = resolve(projectDirectory, '.env.docker.example');
const sourcePath = existsSync(targetPath) ? targetPath : examplePath;

let contents = await readFile(sourcePath, 'utf8');
const generatedSecrets = [];

for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'METRICS_TOKEN']) {
  const linePattern = new RegExp(`^${name}=(.*)$`, 'm');
  const existingValue = contents.match(linePattern)?.[1]?.trim() ?? '';
  const needsSecret = existingValue.length < 48 || existingValue.startsWith('replace-');

  if (needsSecret) {
    const secretLine = `${name}=${randomBytes(48).toString('hex')}`;
    contents = linePattern.test(contents)
      ? contents.replace(linePattern, secretLine)
      : `${contents.trimEnd()}\n${secretLine}\n`;
    generatedSecrets.push(name);
  }
}

await writeFile(targetPath, contents, { encoding: 'utf8', mode: 0o600 });
await chmod(targetPath, 0o600);

if (generatedSecrets.length > 0) {
  console.info(`Generated ${generatedSecrets.join(' and ')} in .env.docker.`);
} else {
  console.info('.env.docker already contains valid-length secrets; nothing changed.');
}
