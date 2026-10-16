import { Router } from 'express';

export function createHealthRouter(readiness: () => Promise<void>) {
  const router = Router();

  router.get('/live', (_request, response) => {
    response.json({ status: 'ok' });
  });

  router.get('/ready', async (_request, response) => {
    try {
      await readiness();
      response.json({ status: 'ready' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
