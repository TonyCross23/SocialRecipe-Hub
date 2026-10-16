import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export function createMonitoring(metricsToken?: string) {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'socialrecipe_' });

  const requestCount = new Counter({
    name: 'socialrecipe_http_requests_total',
    help: 'Total completed HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });
  const requestDuration = new Histogram({
    name: 'socialrecipe_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  const activeRequests = new Gauge({
    name: 'socialrecipe_http_active_requests',
    help: 'HTTP requests currently being processed',
    registers: [registry],
  });
  let activeRequestCount = 0;
  let totalRequests = 0;
  let errorRequests = 0;
  let totalDurationMs = 0;
  const minuteBuckets = new Map<number, { requests: number; errors: number; durationMs: number }>();

  const middleware: RequestHandler = (request, response, next) => {
    if (request.path === '/metrics') {
      next();
      return;
    }

    activeRequests.inc();
    activeRequestCount += 1;
    const startedAt = performance.now();
    const endTimer = requestDuration.startTimer();
    response.once('finish', () => {
      const labels = {
        method: request.method,
        route: getRouteLabel(request),
        status_code: String(response.statusCode),
      };
      activeRequests.dec();
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      requestCount.inc(labels);
      endTimer(labels);
      const durationMs = performance.now() - startedAt;
      totalRequests += 1;
      totalDurationMs += durationMs;
      if (response.statusCode >= 500) errorRequests += 1;
      recordMinute(response.statusCode, durationMs);
    });
    next();
  };

  const endpoint: RequestHandler = async (request, response) => {
    if (!metricsToken || !tokenMatches(readToken(request.headers.authorization), metricsToken)) {
      response.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'A valid metrics token is required' },
      });
      return;
    }

    response.setHeader('Content-Type', registry.contentType);
    response.send(await registry.metrics());
  };

  function recordMinute(statusCode: number, durationMs: number) {
    const minute = Math.floor(Date.now() / 60_000) * 60_000;
    const bucket = minuteBuckets.get(minute) ?? { requests: 0, errors: 0, durationMs: 0 };
    bucket.requests += 1;
    bucket.durationMs += durationMs;
    if (statusCode >= 500) bucket.errors += 1;
    minuteBuckets.set(minute, bucket);
    const cutoff = minute - 29 * 60_000;
    for (const key of minuteBuckets.keys()) if (key < cutoff) minuteBuckets.delete(key);
  }

  function getSnapshot() {
    const memory = process.memoryUsage();
    const currentMinute = Math.floor(Date.now() / 60_000) * 60_000;
    const timeline = Array.from({ length: 12 }, (_, index) => {
      const timestamp = currentMinute - (11 - index) * 60_000;
      const bucket = minuteBuckets.get(timestamp) ?? { requests: 0, errors: 0, durationMs: 0 };
      return {
        timestamp: new Date(timestamp),
        requests: bucket.requests,
        errors: bucket.errors,
        averageLatencyMs: bucket.requests ? Math.round(bucket.durationMs / bucket.requests) : 0,
      };
    });
    return {
      status: 'healthy' as const,
      uptimeSeconds: Math.floor(process.uptime()),
      activeRequests: activeRequestCount,
      totalRequests,
      errorRatePercent: totalRequests
        ? Number(((errorRequests / totalRequests) * 100).toFixed(2))
        : 0,
      averageLatencyMs: totalRequests ? Math.round(totalDurationMs / totalRequests) : 0,
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
      },
      timeline,
      generatedAt: new Date(),
    };
  }

  return { middleware, endpoint, getSnapshot };
}

export type MonitoringSnapshot = ReturnType<ReturnType<typeof createMonitoring>['getSnapshot']>;

function getRouteLabel(request: Parameters<RequestHandler>[0]) {
  const routePath = request.route?.path as string | undefined;
  return routePath ? `${request.baseUrl}${routePath}` : 'unmatched';
}

function readToken(authorization?: string) {
  return /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
}

function tokenMatches(candidate: string | undefined, expected: string) {
  if (!candidate) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}
