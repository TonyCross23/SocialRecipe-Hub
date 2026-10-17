import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';

export interface ModerationJobContent {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  text: string;
  attempts: number;
}

export class PrismaModerationJobRepository {
  constructor(private readonly database: PrismaClient) {}

  async claimNext(): Promise<ModerationJobContent | null> {
    return this.database.$transaction(async (transaction) => {
      const claimed = await transaction.$queryRaw<Array<{ id: string }>>`
        UPDATE "ModerationJob"
        SET "status" = 'PROCESSING', "lockedAt" = NOW(), "attempts" = "attempts" + 1,
            "updatedAt" = NOW()
        WHERE "id" = (
          SELECT "id"
          FROM "ModerationJob"
          WHERE "status" = 'PENDING' AND "availableAt" <= NOW()
          ORDER BY "availableAt", "id"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING "id"
      `;

      const jobId = claimed[0]?.id;
      if (!jobId) return null;

      const job = await transaction.moderationJob.findUniqueOrThrow({
        where: { id: jobId },
        include: {
          post: { select: { id: true, title: true, content: true, recipe: true } },
          comment: { select: { id: true, content: true } },
        },
      });

      if (job.post) {
        return {
          id: job.id,
          targetType: 'post',
          targetId: job.post.id,
          text: `${job.post.title}\n${job.post.content}\n${job.post.recipe ? JSON.stringify(job.post.recipe) : ''}`,
          attempts: job.attempts,
        };
      }
      if (job.comment) {
        return {
          id: job.id,
          targetType: 'comment',
          targetId: job.comment.id,
          text: job.comment.content,
          attempts: job.attempts,
        };
      }

      await transaction.moderationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', lastError: 'Moderation target no longer exists' },
      });
      return null;
    });
  }

  async complete(job: ModerationJobContent, flagged: boolean, categories: string[]) {
    await this.database.$transaction(async (transaction) => {
      // Lock content before the job, matching owner-edit/delete lock order.
      if (job.targetType === 'post')
        await transaction.$queryRaw`SELECT "id" FROM "Post" WHERE "id" = ${job.targetId}::uuid FOR UPDATE`;
      else
        await transaction.$queryRaw`SELECT "id" FROM "Comment" WHERE "id" = ${job.targetId}::uuid FOR UPDATE`;
      const completed = await transaction.moderationJob.updateMany({
        where: { id: job.id, status: 'PROCESSING' },
        data: {
          status: flagged ? 'FLAGGED' : 'APPROVED',
          result: { flagged, categories },
          lockedAt: null,
          lastError: null,
        },
      });

      if (!completed.count || !flagged) return;
      if (job.targetType === 'post') {
        await transaction.post.updateMany({
          where: { id: job.targetId, status: { in: ['PUBLISHED', 'FLAGGED'] } },
          data: { status: 'FLAGGED' },
        });
      } else {
        await transaction.comment.updateMany({
          where: { id: job.targetId, status: { in: ['PUBLISHED', 'FLAGGED'] } },
          data: { status: 'FLAGGED' },
        });
      }
    });
  }

  async fail(job: ModerationJobContent, error: unknown) {
    const retry = job.attempts < 3;
    const delaySeconds = Math.min(300, 2 ** job.attempts * 10);
    const message = error instanceof Error ? error.message : 'Unknown moderation error';

    const data: Prisma.ModerationJobUpdateInput = {
      status: retry ? 'PENDING' : 'FAILED',
      availableAt: retry ? new Date(Date.now() + delaySeconds * 1000) : new Date(),
      lockedAt: null,
      lastError: message.slice(0, 2000),
    };
    await this.database.moderationJob.updateMany({
      where: { id: job.id, status: 'PROCESSING' },
      data,
    });
  }
}
