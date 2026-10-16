import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { Config } from '../../../config.js';
import { unauthorized } from '../../../errors.js';
import { z } from '../../../shared/zod.js';
import type { TokenClaims, TokenService } from '../auth.types.js';

const tokenClaimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  jti: z.uuid(),
  type: z.enum(['access', 'refresh']),
  exp: z.number().int(),
  iat: z.number().int(),
});

type TokenType = 'access' | 'refresh';

export class JwtTokenService implements TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(private readonly config: Config) {
    this.accessKey = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
    this.refreshKey = new TextEncoder().encode(config.JWT_REFRESH_SECRET);
  }

  digest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  issueAccess(claims: TokenClaims) {
    const expiration = Math.floor(Date.now() / 1000) + this.config.ACCESS_TOKEN_TTL_SECONDS;
    return this.sign(claims, 'access', this.accessKey, expiration);
  }

  issueRefresh(claims: TokenClaims, expiresAt: Date) {
    const expiration = Math.floor(expiresAt.getTime() / 1000);
    return this.sign(claims, 'refresh', this.refreshKey, expiration);
  }

  async verifyAccess(token: string) {
    return this.verify(token, 'access', this.accessKey);
  }

  async verifyRefresh(token: string) {
    return this.verify(token, 'refresh', this.refreshKey);
  }

  private sign(claims: TokenClaims, type: TokenType, key: Uint8Array, expiration: number) {
    return new SignJWT({ sid: claims.sessionId, type })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setJti(claims.tokenId)
      .setIssuedAt()
      .setExpirationTime(expiration)
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .sign(key);
  }

  private async verify(token: string, expectedType: TokenType, key: Uint8Array) {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: this.config.JWT_ISSUER,
        audience: this.config.JWT_AUDIENCE,
        requiredClaims: ['sub', 'sid', 'jti', 'type', 'exp', 'iat'],
      });

      const claims = tokenClaimsSchema.parse(payload);
      if (claims.type !== expectedType || protectedHeader.typ !== 'JWT') {
        throw unauthorized();
      }

      return {
        userId: claims.sub,
        sessionId: claims.sid,
        tokenId: claims.jti,
        expiresAt: new Date(claims.exp * 1000),
      };
    } catch {
      throw unauthorized();
    }
  }
}
