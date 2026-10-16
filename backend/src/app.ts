import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import type { ApplicationServices } from './container.js';
import { AppError } from './errors.js';
import { createDocsRouter } from './routes/docs.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createRootRouter } from './routes/root.routes.js';
import { createMonitoring } from './monitoring.js';

const bodyParserStatusByErrorType: Record<string, number> = {
  'entity.parse.failed': 400,
  'entity.too.large': 413,
  'encoding.unsupported': 415,
  'charset.unsupported': 415,
};

export function createApp(
  services: ApplicationServices,
  config: Config,
  logger: Logger,
  readiness: () => Promise<void>,
) {
  const app = express();
  const monitoring = createMonitoring(config.METRICS_TOKEN);
  app.disable('x-powered-by');

  if (config.TRUST_PROXY_HOPS > 0) app.set('trust proxy', config.TRUST_PROXY_HOPS);

  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      serializers: {
        req: (request) => ({
          id: request.id,
          method: request.method,
          url: String(request.url).split('?')[0],
        }),
        res: (response) => ({ statusCode: response.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(monitoring.middleware);
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: false,
    }),
  );
  app.use('/health', createHealthRouter(readiness));
  app.get('/metrics', monitoring.endpoint);
  app.use('/api-docs', createDocsRouter());
  app.use('/api/v1', createRootRouter(services, monitoring.getSnapshot));

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
  app.use(createErrorHandler());
  return app;
}

function createErrorHandler(): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    const requestId = request.id;

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          issues: error.issues.map(({ path, message }) => ({ path, message })),
          requestId,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message, requestId },
      });
      return;
    }

    const bodyParserStatus = getBodyParserErrorStatus(error);
    if (bodyParserStatus) {
      response.status(bodyParserStatus).json({
        error: {
          code: 'INVALID_BODY',
          message: 'Invalid or oversized JSON body',
          requestId,
        },
      });
      return;
    }

    request.log.error(
      { requestId, errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Request failed',
    );
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId },
    });
  };
}

function getBodyParserErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('type' in error)) return undefined;
  return typeof error.type === 'string' ? bodyParserStatusByErrorType[error.type] : undefined;
}
