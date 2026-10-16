import { AppError } from '../../../errors.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type {
  AuthRepository,
  PublicUser,
  RegisterInput,
  SessionRecord,
  TokenRecord,
} from '../auth.types.js';

const profileInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof profileInclude }>;

interface StoredRefreshToken {
  id: string;
  tokenHash: string;
  sessionId: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly database: PrismaClient) {}

  async createMember(input: Omit<RegisterInput, 'password'> & { passwordHash: string }) {
    const memberRole = await this.database.role.findUnique({ where: { name: 'member' } });

    if (!memberRole) {
      throw new AppError(503, 'SETUP_REQUIRED', 'Default role is not configured');
    }

    try {
      const user = await this.database.user.create({
        data: {
          ...input,
          dob: new Date(`${input.dob}T00:00:00Z`),
          roleId: memberRole.id,
        },
        include: profileInclude,
      });

      return toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
      }

      throw error;
    }
  }

  async findByEmail(email: string) {
    const user = await this.database.user.findUnique({
      where: { email },
      include: profileInclude,
    });

    return user ? { profile: toPublicUser(user), passwordHash: user.passwordHash } : null;
  }

  async getProfile(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      include: profileInclude,
    });

    return user ? toPublicUser(user) : null;
  }

  async createSession(session: SessionRecord, token: TokenRecord) {
    await this.database.$transaction(async (transaction) => {
      await transaction.authSession.create({ data: session });
      await transaction.refreshToken.create({ data: token });
    });
  }

  getActiveSession(sessionId: string, userId: string, now: Date) {
    return this.database.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
  }

  async rotateToken(current: TokenRecord, next: TokenRecord, now: Date) {
    return this.database.$transaction(
      async (transaction) => {
        const sessions = await transaction.$queryRaw<
          Array<SessionRecord & { revokedAt: Date | null }>
        >`
          SELECT * FROM "AuthSession"
          WHERE "id" = ${current.sessionId}::uuid
            AND "userId" = ${current.userId}::uuid
          FOR UPDATE
        `;
        const session = sessions[0];

        if (!session || session.revokedAt || session.expiresAt <= now) {
          return 'invalid';
        }

        const storedToken = await transaction.refreshToken.findUnique({
          where: { id: current.id },
        });

        if (!tokenMatches(storedToken, current, session.id, now)) {
          return 'invalid';
        }

        if (storedToken.usedAt) {
          await transaction.authSession.update({
            where: { id: session.id },
            data: { revokedAt: now },
          });
          return 'reused';
        }

        await transaction.refreshToken.update({
          where: { id: storedToken.id },
          data: { usedAt: now },
        });
        await transaction.refreshToken.create({ data: next });

        return 'rotated';
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  async revokeSession(sessionId: string, userId: string, now: Date) {
    await this.database.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

function toPublicUser(user: UserWithRole): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    dob: user.dob.toISOString().slice(0, 10),
    createdAt: user.createdAt,
    role: user.role.name,
    permissions: user.role.permissions.map(({ permission }) => permission.name).sort(),
    status: user.status,
    bannedReason: user.bannedReason,
  };
}

function tokenMatches(
  stored: StoredRefreshToken | null,
  current: TokenRecord,
  sessionId: string,
  now: Date,
): stored is StoredRefreshToken {
  return (
    stored !== null &&
    stored.tokenHash === current.tokenHash &&
    stored.sessionId === sessionId &&
    stored.userId === current.userId &&
    stored.expiresAt > now
  );
}
