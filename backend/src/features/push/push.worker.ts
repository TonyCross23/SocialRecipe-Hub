import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { visibleNotifications, visiblePosts } from '../posts/post-access.js';
import { z } from '../../shared/zod.js';
const resultDto = z.object({
  status: z.enum(['ok', 'error']),
  id: z.string().optional(),
  details: z.object({ error: z.string() }).optional(),
});
export class PushWorker {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly accessToken?: string,
    private readonly request: typeof fetch = fetch,
  ) {}
  start() {
    this.timer = setInterval(() => {
      void this.run();
    }, 5000);
    this.timer.unref();
    void this.run();
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  run() {
    if (this.active) return this.active;
    this.active = this.tick()
      .catch(() => {
        this.logger.warn('Push worker will retry after a temporary failure');
      })
      .finally(() => {
        this.active = undefined;
      });
    return this.active;
  }
  private async api(path: string, body: unknown) {
    const response = await this.request(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 429 || response.status >= 500
          ? 'RETRY_PROVIDER'
          : 'INVALID_PROVIDER_CONFIG',
      );
    return (await response.json()) as { data?: unknown };
  }
  private async tick() {
    const now = new Date();
    // Reclaim leases if a process stopped between sending and storing its result.
    await this.db.pushDelivery.updateMany({
      where: { status: 'SENDING', lockedAt: { lt: new Date(now.getTime() - 120000) } },
      data: { status: 'PENDING', lockedAt: null },
    });
    const notifications = await this.db.notification.findMany({
      where: { pushQueuedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    for (const item of notifications)
      await this.db.$transaction(async (tx) => {
        const claimed = await tx.notification.updateMany({
          where: { id: item.id, pushQueuedAt: null },
          data: { pushQueuedAt: now },
        });
        if (!claimed.count || item.readAt || now.getTime() - item.createdAt.getTime() > 86400000)
          return;
        const devices = await tx.pushDevice.findMany({
          where: {
            userId: item.userId,
            createdAt: { lte: item.createdAt },
            session: { revokedAt: null, expiresAt: { gt: now } },
            user: { status: 'ACTIVE' },
          },
          select: { id: true },
        });
        if (devices.length)
          await tx.pushDelivery.createMany({
            data: devices.map((d) => ({ notificationId: item.id, deviceId: d.id })),
            skipDuplicates: true,
          });
      });
    const pending = await this.db.pushDelivery.findMany({
      where: { status: 'PENDING', availableAt: { lte: new Date() } },
      take: 10,
      orderBy: { availableAt: 'asc' },
    });
    for (const candidate of pending) {
      const claimed = await this.db.pushDelivery.updateMany({
        where: { id: candidate.id, status: 'PENDING' },
        data: { status: 'SENDING', attempts: { increment: 1 }, lockedAt: new Date() },
      });
      if (!claimed.count) continue;
      const job = await this.db.pushDelivery.findUnique({
        where: { id: candidate.id },
        include: { device: { include: { session: true, user: true } }, notification: true },
      });
      if (!job) continue;
      const eligible =
        job.notification.userId === job.device.userId &&
        job.device.session.userId === job.device.userId &&
        !job.device.session.revokedAt &&
        job.device.session.expiresAt > new Date() &&
        job.device.user.status === 'ACTIVE' &&
        !job.notification.readAt &&
        (await this.db.notification.count({
          where: { AND: [{ id: job.notificationId }, visibleNotifications(job.device.userId)] },
        }));
      const payload = z
        .object({ postId: z.uuid().optional(), actor: z.object({ id: z.uuid() }).optional() })
        .safeParse(job.notification.data);
      const postId = payload.success ? payload.data.postId : undefined;
      if (
        !eligible ||
        (postId &&
          !(await this.db.post.count({
            where: { AND: [visiblePosts(job.device.userId), { id: postId }] },
          })))
      ) {
        await this.db.pushDelivery.updateMany({
          where: { id: job.id },
          data: { status: 'SKIPPED', lockedAt: null },
        });
        continue;
      }
      try {
        const response = await this.api('send', {
          to: job.device.token,
          title: job.notification.title,
          body: job.notification.message,
          sound: 'default',
          channelId: 'community',
          priority: 'high',
          ttl: 3600,
          data: {
            notificationId: job.notificationId,
            postId,
            actorId: payload.success ? payload.data.actor?.id : undefined,
          },
        });
        const ticket = resultDto.parse(response.data);
        if (ticket.status === 'error') {
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await this.db.pushDevice.deleteMany({
              where: { id: job.deviceId, token: job.device.token },
            });
            continue;
          }
          throw new Error(
            ticket.details?.error === 'MessageRateExceeded'
              ? 'RETRY_PROVIDER'
              : 'INVALID_PROVIDER_CONFIG',
          );
        }
        if (!ticket.id) throw new Error('INVALID_PROVIDER_RESPONSE');
        await this.db.pushDelivery.updateMany({
          where: { id: job.id },
          data: {
            status: 'TICKET',
            ticketId: ticket.id,
            availableAt: new Date(Date.now() + 15 * 60000),
            lockedAt: null,
          },
        });
      } catch (error) {
        const code =
          error instanceof Error &&
          ['INVALID_PROVIDER_CONFIG', 'RETRY_PROVIDER'].includes(error.message)
            ? error.message
            : 'PUSH_NETWORK_ERROR';
        await this.db.pushDelivery.updateMany({
          where: { id: job.id },
          data: {
            status: job.attempts >= 5 || code === 'INVALID_PROVIDER_CONFIG' ? 'FAILED' : 'PENDING',
            lastError: code,
            lockedAt: null,
            availableAt: new Date(Date.now() + Math.min(3600000, 15000 * 2 ** job.attempts)),
          },
        });
        this.logger.warn({ deliveryId: job.id, code }, 'Push delivery did not complete');
      }
    }
    const tickets = await this.db.pushDelivery.findMany({
      where: { status: 'TICKET', availableAt: { lte: new Date() } },
      take: 100,
      include: { notification: { select: { createdAt: true } } },
    });
    if (!tickets.length) return;
    const response = await this.api('getReceipts', { ids: tickets.map((t) => t.ticketId) });
    const receipts = z.record(z.string(), resultDto).parse(response.data);
    for (const job of tickets) {
      const receipt = job.ticketId ? receipts[job.ticketId] : undefined;
      if (!receipt) {
        // Receipts disappear after 24h: stop polling rather than growing an endless backlog.
        await this.db.pushDelivery.updateMany({
          where: { id: job.id, status: 'TICKET' },
          data: {
            status:
              job.notification.createdAt.getTime() < Date.now() - 23 * 3600000
                ? 'FAILED'
                : 'TICKET',
            availableAt: new Date(Date.now() + 15 * 60000),
            lastError: 'RECEIPT_PENDING',
          },
        });
      } else if (receipt.details?.error === 'DeviceNotRegistered') {
        await this.db.pushDevice.deleteMany({ where: { id: job.deviceId } });
      } else
        await this.db.pushDelivery.updateMany({
          where: { id: job.id, status: 'TICKET' },
          data: {
            status: receipt.status === 'ok' ? 'DELIVERED' : 'FAILED',
            lastError: receipt.details?.error?.slice(0, 100) ?? null,
          },
        });
    }
  }
}
