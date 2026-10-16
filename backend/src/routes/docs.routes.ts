import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '../openapi.js';

const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
].join('; ');

export function createDocsRouter() {
  const router = Router();

  router.get('/openapi.json', (_request, response) => response.json(openApiDocument));
  router.use((_request, response, next) => {
    response.setHeader('Content-Security-Policy', contentSecurityPolicy);
    next();
  });
  router.use(swaggerUi.serve);
  router.get(
    '/',
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'SocialRecipe API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: { displayRequestDuration: true, filter: true, tryItOutEnabled: true },
    }),
  );

  return router;
}
