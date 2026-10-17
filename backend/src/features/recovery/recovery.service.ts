import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Config } from '../../config.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError, notFound, unauthorized } from '../../errors.js';
import { ArgonPasswordService } from '../auth/services/password.service.js';
export interface ResetMailer {
  send(to: string, code: string, language: 'en' | 'my'): Promise<void>;
}
export function createResetMailer(
  config: Config,
  purpose: 'reset' | 'registration' = 'reset',
): ResetMailer {
  const transport = config.SMTP_HOST
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        requireTLS: config.SMTP_REQUIRE_TLS,
        connectionTimeout: 10000,
        socketTimeout: 10000,
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
        disableFileAccess: true,
        disableUrlAccess: true,
      })
    : undefined;
  return {
    async send(to, code) {
      if (!transport) throw new Error('MAIL_NOT_CONFIGURED');
      await transport.sendMail({
        from: config.SMTP_FROM,
        to,
        subject:
          purpose === 'registration'
            ? 'Verify your SocialRecipe email'
            : 'SocialRecipe password reset',
        text:
          purpose === 'registration'
            ? `Your SocialRecipe email verification code is: ${code}\n\nEnter it in the app within 15 minutes to finish creating your account. Do not share this code. If you did not request this, ignore this email. No account will be created without verification.`
            : `Your SocialRecipe password reset code is: ${code}\n\nEnter it in the app within 15 minutes. Do not share it. If you did not request this, ignore this email.`,
      });
    },
  };
}
export class RecoveryService {
  private passwords = new ArgonPasswordService();
  constructor(
    private readonly db: PrismaClient,
    private readonly mail: ResetMailer,
    private readonly secret: string,
  ) {}
  private digest(id: string, code: string) {
    return createHmac('sha256', this.secret).update(`${id}:${code}`).digest('hex');
  }
  async forgot(email: string, language: 'en' | 'my') {
    const requestId = randomUUID();
    const account = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (account) {
      const code = randomInt(0, 1000000).toString().padStart(6, '0');
      const created = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${account.id}::uuid FOR UPDATE`;
        if (
          (await tx.passwordReset.count({
            where: { userId: account.id, createdAt: { gt: new Date(Date.now() - 15 * 60000) } },
          })) >= 3
        )
          return false;
        await tx.passwordReset.updateMany({
          where: { userId: account.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.passwordReset.create({
          data: {
            id: requestId,
            userId: account.id,
            codeHash: this.digest(requestId, code),
            expiresAt: new Date(Date.now() + 15 * 60000),
          },
        });
        return true;
      });
      if (created)
        try {
          await this.mail.send(email, code, language);
        } catch {
          // Do not expose account existence, codes, SMTP credentials or mailbox failures.
          await this.db.passwordReset.updateMany({
            where: { id: requestId },
            data: { usedAt: new Date() },
          });
        }
    }
    return { requestId, message: 'If the account exists, a reset code has been sent.' };
  }
  async reset(id: string, code: string, newPassword: string) {
    const record = await this.db.passwordReset.findUnique({
      where: { id },
      select: { userId: true },
    });
    let success = false;
    if (record)
      success = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${record.userId}::uuid FOR UPDATE`;
        const reset = await tx.passwordReset.findUnique({ where: { id } });
        if (!reset || reset.usedAt || reset.attempts >= 5 || reset.expiresAt <= new Date())
          return false;
        await tx.passwordReset.update({ where: { id }, data: { attempts: { increment: 1 } } });
        if (
          !timingSafeEqual(
            Buffer.from(reset.codeHash, 'hex'),
            Buffer.from(this.digest(id, code), 'hex'),
          )
        )
          return false;
        const passwordHash = await this.passwords.hash(newPassword);
        await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
        await tx.passwordReset.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.authSession.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return true;
      });
    if (!success)
      throw new AppError(
        400,
        'RESET_CODE_INVALID',
        'The code is invalid or expired. Request a new code.',
      );
  }
  private async owner(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) {
      await this.passwords.dummyVerify(password);
      throw unauthorized();
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) throw unauthorized();
    return user;
  }
  async submitAppeal(email: string, password: string, message: string) {
    const account = await this.owner(email, password);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${account.id}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: account.id } });
      if (user.status !== 'BANNED' || !user.bannedAt)
        throw new AppError(
          409,
          'ACCOUNT_NOT_BANNED',
          'This account is not banned. You can sign in.',
        );
      const pending = await tx.banAppeal.findFirst({
        where: { userId: user.id, status: 'PENDING' },
      });
      if (pending && pending.bannedAt.getTime() === user.bannedAt.getTime())
        return { appeal: pending };
      if (pending)
        await tx.banAppeal.update({ where: { id: pending.id }, data: { status: 'STALE' } });
      if (
        (await tx.banAppeal.count({
          where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 86400000) } },
        })) >= 3
      )
        throw new AppError(429, 'APPEAL_LIMIT', 'Wait before submitting another appeal.');
      const appeal = await tx.banAppeal.create({
        data: { userId: user.id, bannedAt: user.bannedAt, message },
      });
      const admins = await tx.user.findMany({
        where: {
          status: 'ACTIVE',
          role: { permissions: { some: { permission: { name: 'user:ban' } } } },
        },
        select: { id: true },
      });
      if (admins.length)
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: 'BAN_APPEAL',
            title: 'Account appeal',
            message: `${user.name} requested a ban review.`,
            data: { appealId: appeal.id },
          })),
        });
      return { appeal };
    });
  }
  async appealStatus(email: string, password: string) {
    const user = await this.owner(email, password);
    const appeal = await this.db.banAppeal.findFirst({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { status: user.status, bannedReason: user.bannedReason, appeal };
  }
  async appeals(page: number, limit: number, status: string) {
    const where = status === 'ALL' ? {} : { status };
    const [data, total] = await this.db.$transaction([
      this.db.banAppeal.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, status: true, bannedReason: true } },
          reviewer: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.banAppeal.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async reviewAppeal(
    id: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REJECTED',
    response: string,
  ) {
    const initial = await this.db.banAppeal.findUnique({ where: { id } });
    if (!initial) throw notFound('Appeal');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${initial.userId}::uuid FOR UPDATE`;
      const appeal = await tx.banAppeal.findUniqueOrThrow({ where: { id } });
      if (appeal.status !== 'PENDING')
        throw new AppError(409, 'APPEAL_REVIEWED', 'This appeal has already been reviewed.');
      const user = await tx.user.findUniqueOrThrow({ where: { id: appeal.userId } });
      const stale =
        user.status !== 'BANNED' || user.bannedAt?.getTime() !== appeal.bannedAt.getTime();
      if (!stale && decision === 'APPROVED')
        await tx.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE', bannedAt: null, bannedReason: null },
        });
      return {
        appeal: await tx.banAppeal.update({
          where: { id },
          data: {
            status: stale ? 'STALE' : decision,
            response,
            reviewerId,
            reviewedAt: new Date(),
          },
        }),
      };
    });
  }
}
