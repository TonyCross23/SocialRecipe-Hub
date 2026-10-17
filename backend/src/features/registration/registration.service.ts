import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../errors.js';
import { ArgonPasswordService } from '../auth/services/password.service.js';
import { PrismaAuthRepository } from '../auth/infrastructure/prisma-auth.repository.js';
import type { ResetMailer } from '../recovery/recovery.service.js';

type RegistrationInput = { name: string; email: string; password: string; dob: string };
const invalid = () =>
  new AppError(
    400,
    'VERIFICATION_CODE_INVALID',
    'The code is invalid or expired. Request a new code.',
  );
export class RegistrationService {
  private passwords = new ArgonPasswordService();
  constructor(
    private readonly db: PrismaClient,
    private readonly mail: ResetMailer,
    private readonly secret: string,
  ) {}
  private code() {
    return randomInt(0, 1000000).toString().padStart(6, '0');
  }
  private digest(id: string, code: string) {
    return createHmac('sha256', this.secret).update(`registration:${id}:${code}`).digest('hex');
  }
  async start(input: RegistrationInput) {
    // Pending profiles are short-lived; prune old personal data on new requests.
    await this.db.pendingRegistration.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
    });
    const requestId = randomUUID();
    const code = this.code();
    // Persist only a password hash, never the plaintext password or verification code.
    const passwordHash = await this.passwords.hash(input.password);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.email}, 0))`;
      if (await tx.user.findUnique({ where: { email: input.email } }))
        throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
      const recent = await tx.pendingRegistration.findMany({
        where: { email: input.email, createdAt: { gt: new Date(Date.now() - 15 * 60000) } },
        select: { sends: true },
      });
      if (recent.reduce((total, row) => total + row.sends, 0) >= 3)
        throw new AppError(
          429,
          'VERIFICATION_LIMIT',
          'Too many codes requested. Try again in 15 minutes.',
        );
      await tx.pendingRegistration.create({
        data: {
          id: requestId,
          name: input.name,
          email: input.email,
          passwordHash,
          dob: new Date(`${input.dob}T00:00:00Z`),
          codeHash: this.digest(requestId, code),
          expiresAt: new Date(Date.now() + 15 * 60000),
        },
      });
    });
    await this.deliver(requestId, input.email, code);
    return { requestId, expiresIn: 900, resendAfter: 60 };
  }
  private async deliver(id: string, email: string, code: string) {
    try {
      await this.mail.send(email, code, 'en');
    } catch {
      await this.db.pendingRegistration.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: new Date(), passwordHash: '', codeHash: '0'.repeat(64) },
      });
      throw new AppError(
        503,
        'VERIFICATION_MAIL_FAILED',
        'Could not send the verification email. Please register again later.',
      );
    }
  }
  async resend(id: string) {
    const initial = await this.db.pendingRegistration.findUnique({ where: { id } });
    if (!initial) throw invalid();
    const code = this.code();
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${initial.email}, 0))`;
      const record = await tx.pendingRegistration.findUniqueOrThrow({ where: { id } });
      if (record.usedAt || record.createdAt < new Date(Date.now() - 15 * 60000)) throw invalid();
      const recent = await tx.pendingRegistration.findMany({
        where: { email: record.email, createdAt: { gt: new Date(Date.now() - 15 * 60000) } },
        select: { sends: true },
      });
      if (
        record.lastSentAt > new Date(Date.now() - 60000) ||
        recent.reduce((n, r) => n + r.sends, 0) >= 3
      )
        throw new AppError(429, 'VERIFICATION_LIMIT', 'Wait before requesting another code.');
      await tx.pendingRegistration.update({
        where: { id },
        data: {
          codeHash: this.digest(id, code),
          attempts: 0,
          sends: { increment: 1 },
          lastSentAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60000),
        },
      });
    });
    await this.deliver(id, initial.email, code);
    return { requestId: id, expiresIn: 900, resendAfter: 60 };
  }
  async verify(id: string, code: string) {
    const initial = await this.db.pendingRegistration.findUnique({
      where: { id },
      select: { email: true },
    });
    if (!initial) throw invalid();
    // Email lock serializes all challenges for this address, including duplicate verification.
    const userId = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${initial.email}, 0))`;
      const record = await tx.pendingRegistration.findUniqueOrThrow({ where: { id } });
      if (record.usedAt || record.attempts >= 5 || record.expiresAt <= new Date()) return null;
      await tx.pendingRegistration.update({ where: { id }, data: { attempts: { increment: 1 } } });
      if (
        !timingSafeEqual(
          Buffer.from(record.codeHash, 'hex'),
          Buffer.from(this.digest(id, code), 'hex'),
        )
      )
        return null;
      if (await tx.user.findUnique({ where: { email: record.email } })) return null;
      const role = await tx.role.findUnique({ where: { name: 'member' } });
      if (!role) throw new AppError(503, 'SETUP_REQUIRED', 'Default role is not configured');
      const user = await tx.user.create({
        data: {
          name: record.name,
          email: record.email,
          passwordHash: record.passwordHash,
          dob: record.dob,
          roleId: role.id,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.pendingRegistration.updateMany({
        where: { email: record.email, usedAt: null },
        data: { usedAt: new Date(), passwordHash: '', codeHash: '0'.repeat(64) },
      });
      return user.id;
    });
    if (!userId) throw invalid();
    return { user: await new PrismaAuthRepository(this.db).getProfile(userId) };
  }
}
