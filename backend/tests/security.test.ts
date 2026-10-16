import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { loginDto, registerDto } from '../src/features/auth/dto/auth.dto.js';
import { ArgonPasswordService } from '../src/features/auth/services/password.service.js';
import { JwtTokenService } from '../src/features/auth/services/token.service.js';
import { testConfig } from './config.js';

const input = {
  name: 'Recipe Chef',
  email: 'CHEF@example.com',
  password: 'secure passphrase 123!',
  dob: '1995-03-12',
};
describe('strict DTOs', () => {
  it('normalizes email and accepts optional HTTPS profile images', () => {
    expect(registerDto.parse(input).email).toBe('chef@example.com');
    expect(
      registerDto.parse({ ...input, image: 'https://example.com/profile.png' }).image,
    ).toBeDefined();
    expect(registerDto.parse({ ...input, image: null }).image).toBeNull();
  });
  it.each([
    { roleId: randomUUID() },
    { permissions: ['rbac:manage'] },
    { password: 'short' },
    { dob: '2025-02-30' },
    { dob: '2999-01-01' },
    { dob: '1800-01-01' },
    { image: 'javascript:alert(1)' },
    { image: 'http://example.com/image.png' },
    { name: ' ' },
  ])('rejects invalid or privileged registration fields: %j', (change) => {
    expect(registerDto.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('rejects unknown login fields', () => {
    expect(
      loginDto.safeParse({ email: input.email, password: input.password, admin: true }).success,
    ).toBe(false);
  });
});

describe('password hashing', () => {
  it('salts Argon2id hashes and verifies credentials', async () => {
    const hasher = new ArgonPasswordService();
    const hash = await hasher.hash(input.password);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await hasher.hash(input.password)).not.toBe(hash);
    expect(await hasher.verify(hash, input.password)).toBe(true);
    expect(await hasher.verify(hash, 'wrong password')).toBe(false);
    await hasher.dummyVerify('unknown account');
  });
});

describe('JWT boundaries', () => {
  const tokens = new JwtTokenService(testConfig);
  const claims = { userId: randomUUID(), sessionId: randomUUID(), tokenId: randomUUID() };
  it('verifies tokens and stores only deterministic digests', async () => {
    const token = await tokens.issueAccess(claims);
    expect(await tokens.verifyAccess(token)).toMatchObject(claims);
    expect(tokens.digest(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(tokens.digest(token)).not.toContain(token);
  });
  it('rejects refresh tokens at access endpoints and vice versa', async () => {
    const refresh = await tokens.issueRefresh(claims, new Date(Date.now() + 60000));
    expect(await tokens.verifyRefresh(refresh)).toMatchObject(claims);
    await expect(tokens.verifyAccess(refresh)).rejects.toMatchObject({ status: 401 });
    await expect(tokens.verifyRefresh(await tokens.issueAccess(claims))).rejects.toMatchObject({
      status: 401,
    });
  });
  it('rejects expired, tampered and wrong-audience tokens', async () => {
    await expect(
      tokens.verifyRefresh(await tokens.issueRefresh(claims, new Date(0))),
    ).rejects.toMatchObject({ status: 401 });
    const access = await tokens.issueAccess(claims);
    const parts = access.split('.');
    await expect(tokens.verifyAccess(`${parts[0]}.${parts[1]}.AAAA`)).rejects.toMatchObject({
      status: 401,
    });
    const wrongAudience = await new SignJWT({ sid: claims.sessionId, type: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setJti(claims.tokenId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer(testConfig.JWT_ISSUER)
      .setAudience('wrong-client')
      .sign(new TextEncoder().encode(testConfig.JWT_ACCESS_SECRET));
    await expect(tokens.verifyAccess(wrongAudience)).rejects.toMatchObject({ status: 401 });
  });
});
