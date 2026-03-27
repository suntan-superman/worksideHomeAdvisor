import cors from '@fastify/cors';
import Fastify from 'fastify';

import { authRoutes } from './modules/auth/auth.routes.js';
import { billingRoutes } from './modules/billing/billing.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { documentsRoutes } from './modules/documents/documents.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { propertyRoutes } from './modules/properties/property.routes.js';
import { pricingRoutes } from './modules/pricing/pricing.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 15 * 1024 * 1024,
  });

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'workside-api',
    timestamp: new Date().toISOString(),
  }));

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(billingRoutes, { prefix: '/api/v1/billing' });
  app.register(propertyRoutes, { prefix: '/api/v1/properties' });
  app.register(mediaRoutes, { prefix: '/api/v1' });
  app.register(pricingRoutes, { prefix: '/api/v1/properties' });
  app.register(dashboardRoutes, { prefix: '/api/v1/properties' });
  app.register(documentsRoutes, { prefix: '/api/v1/properties' });
  app.register(aiRoutes, { prefix: '/api/v1/ai' });

  return app;
}
