import { pino } from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createApplicationServices } from './container.js';
import { createDatabase } from './database.js';
import { PrismaModerationJobRepository } from './features/moderation/infrastructure/prisma-moderation-job.repository.js';
import { ModerationWorker } from './features/moderation/moderation.worker.js';
import { OpenAiModerationService } from './features/moderation/services/ai-moderation.service.js';

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });
const database = createDatabase(config.DATABASE_URL);
await database.$connect();

const services = createApplicationServices(database, config);
const app = createApp(services, config, logger, async () => {
  await database.$queryRaw`SELECT 1`;
});
const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'API listening');
});

const moderationWorker = config.OPENAI_API_KEY
  ? new ModerationWorker(
      new PrismaModerationJobRepository(database),
      new OpenAiModerationService(config.OPENAI_API_KEY, config.OPENAI_MODERATION_MODEL),
      logger,
      config.MODERATION_WORKER_INTERVAL_MS,
    )
  : undefined;
moderationWorker?.start();

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  moderationWorker?.stop();

  const deadline = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    void database.$disconnect().then(() => {
      clearTimeout(deadline);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
