import type { Logger } from 'pino';
import type { PrismaModerationJobRepository } from './infrastructure/prisma-moderation-job.repository.js';
import type { AiModerationService } from './services/ai-moderation.service.js';

export class ModerationWorker {
  private timer?: NodeJS.Timeout;
  private stopped = true;

  constructor(
    private readonly jobs: PrismaModerationJobRepository,
    private readonly ai: AiModerationService,
    private readonly logger: Logger,
    private readonly intervalMs: number,
  ) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.poll();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async poll() {
    try {
      const job = await this.jobs.claimNext();
      if (job) {
        try {
          const result = await this.ai.check(job.text);
          await this.jobs.complete(job, result.flagged, result.categories);
        } catch (error) {
          await this.jobs.fail(job, error);
          this.logger.warn({ jobId: job.id, error }, 'AI moderation job failed');
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Moderation worker polling failed');
    } finally {
      if (!this.stopped) this.timer = setTimeout(() => void this.poll(), this.intervalMs);
    }
  }
}
