import { randomUUID } from 'node:crypto';
import { AppError, unauthorized } from '../../../errors.js';
import type {
  AuthRepository,
  PasswordService,
  RegisterInput,
  TokenClaims,
  TokenService,
} from '../auth.types.js';

export interface AuthOptions {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  sessionTtlSeconds: number;
}

export class AuthUseCases {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly options: AuthOptions,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async register(input: RegisterInput) {
    const { password, ...profile } = input;
    const passwordHash = await this.passwords.hash(password);
    const user = await this.repository.createMember({ ...profile, passwordHash });

    return { user };
  }

  async updateProfile(userId: string, input: { name: string; dob: string; image: string | null }) {
    return { user: await this.repository.updateProfile(userId, input) };
  }

  async login(input: { email: string; password: string }) {
    const account = await this.repository.findByEmail(input.email);

    if (!account) {
      await this.passwords.dummyVerify(input.password);
      throw unauthorized();
    }

    const passwordIsValid = await this.passwords.verify(account.passwordHash, input.password);
    if (!passwordIsValid) {
      throw unauthorized();
    }

    if (account.profile.status === 'BANNED') {
      throw new AppError(403, 'ACCOUNT_BANNED', account.profile.bannedReason ?? 'Account banned');
    }

    const now = this.clock();
    const session = {
      id: randomUUID(),
      userId: account.profile.id,
      expiresAt: new Date(now.getTime() + this.options.sessionTtlSeconds * 1000),
    };
    const tokenPair = await this.issueTokenPair(session.id, session.userId, session.expiresAt, now);

    await this.repository.createSession(session, tokenPair.record);

    return { user: account.profile, ...tokenPair.response };
  }

  async refresh(refreshToken: string) {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    const now = this.clock();
    const session = await this.repository.getActiveSession(claims.sessionId, claims.userId, now);

    if (!session) {
      throw unauthorized();
    }

    const tokenPair = await this.issueTokenPair(session.id, session.userId, session.expiresAt, now);
    const rotationResult = await this.repository.rotateToken(
      {
        id: claims.tokenId,
        tokenHash: this.tokens.digest(refreshToken),
        userId: claims.userId,
        sessionId: claims.sessionId,
        expiresAt: claims.expiresAt,
      },
      tokenPair.record,
      now,
    );

    if (rotationResult !== 'rotated') {
      throw unauthorized();
    }

    return tokenPair.response;
  }

  async authenticate(accessToken: string) {
    const claims = await this.tokens.verifyAccess(accessToken);
    const session = await this.repository.getActiveSession(
      claims.sessionId,
      claims.userId,
      this.clock(),
    );

    if (!session) {
      throw unauthorized();
    }

    const user = await this.repository.getProfile(claims.userId);
    if (!user) {
      throw unauthorized();
    }

    if (user.status === 'BANNED') {
      throw new AppError(403, 'ACCOUNT_BANNED', user.bannedReason ?? 'Account banned');
    }

    return { user, sessionId: claims.sessionId };
  }

  async changePassword(
    userId: string,
    email: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const account = await this.repository.findByEmail(email);
    if (
      !account ||
      account.profile.id !== userId ||
      !(await this.passwords.verify(account.passwordHash, currentPassword))
    )
      throw new AppError(400, 'INCORRECT_PASSWORD', 'Your current password is incorrect.');
    if (await this.passwords.verify(account.passwordHash, newPassword))
      throw new AppError(400, 'PASSWORD_UNCHANGED', 'Choose a different password.');
    const hash = await this.passwords.hash(newPassword);
    if (!(await this.repository.changePassword(userId, account.passwordHash, hash, this.clock())))
      throw new AppError(409, 'PASSWORD_CHANGED', 'Your password changed. Please sign in again.');
  }

  async logout(sessionId: string, userId: string) {
    await this.repository.revokeSession(sessionId, userId, this.clock());
  }

  private async issueTokenPair(
    sessionId: string,
    userId: string,
    sessionExpiresAt: Date,
    now: Date,
  ) {
    const refreshExpiresAt = new Date(
      Math.min(now.getTime() + this.options.refreshTtlSeconds * 1000, sessionExpiresAt.getTime()),
    );
    const refreshClaims: TokenClaims = { userId, sessionId, tokenId: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.issueAccess({ ...refreshClaims, tokenId: randomUUID() }),
      this.tokens.issueRefresh(refreshClaims, refreshExpiresAt),
    ]);

    return {
      record: {
        id: refreshClaims.tokenId,
        tokenHash: this.tokens.digest(refreshToken),
        userId,
        sessionId,
        expiresAt: refreshExpiresAt,
      },
      response: {
        tokenType: 'Bearer' as const,
        accessToken,
        refreshToken,
        expiresIn: this.options.accessTtlSeconds,
        refreshExpiresAt,
      },
    };
  }
}
