import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import Fastify from 'fastify';

import { adminRoutes } from './modules/admin/admin.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { billingRoutes } from './modules/billing/billing.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { documentsRoutes } from './modules/documents/documents.routes.js';
import { reportsRoutes } from './modules/documents/reports.routes.js';
import { probePdfBrowserAvailability } from './modules/documents/html-pdf.service.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { jobsRoutes } from './modules/jobs/jobs.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { marketplaceSmsRoutes } from './modules/marketplace-sms/marketplace-sms.routes.js';
import { providersRoutes } from './modules/providers/providers.routes.js';
import { propertyRoutes } from './modules/properties/property.routes.js';
import { pricingRoutes } from './modules/pricing/pricing.routes.js';
import { publicRoutes } from './modules/public/public.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { workflowRoutes } from './modules/workflow/workflow.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 15 * 1024 * 1024,
  });

  app.register(cors, {
    origin: true,
    credentials: true,
  });
  app.register(formbody);

  app.get('/health', async () => ({
    ok: true,
    service: 'workside-api',
    timestamp: new Date().toISOString(),
  }));
  app.get('/health/pdf', async (_request, reply) => {
    const probe = await probePdfBrowserAvailability({
      timeoutMs: 12000,
    });

    if (!probe.ok) {
      return reply.code(503).send({
        ok: false,
        service: 'workside-api',
        subsystem: 'pdf_renderer',
        timestamp: new Date().toISOString(),
        ...probe,
      });
    }

    return {
      ok: true,
      service: 'workside-api',
      subsystem: 'pdf_renderer',
      timestamp: new Date().toISOString(),
      ...probe,
    };
  });

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(publicRoutes, { prefix: '/api/v1/public' });
  app.register(adminRoutes, { prefix: '/api/v1/admin' });
  app.register(billingRoutes, { prefix: '/api/v1/billing' });
  app.register(billingRoutes, { prefix: '/api/billing' });
  app.register(propertyRoutes, { prefix: '/api/v1/properties' });
  app.register(jobsRoutes, { prefix: '/api/v1' });
  app.register(mediaRoutes, { prefix: '/api/v1' });
  app.register(marketplaceSmsRoutes, { prefix: '/api/v1' });
  app.register(providersRoutes, { prefix: '/api/v1' });
  app.register(pricingRoutes, { prefix: '/api/v1/properties' });
  app.register(tasksRoutes, { prefix: '/api/v1' });
  app.register(workflowRoutes, { prefix: '/api/v1/properties' });
  app.register(dashboardRoutes, { prefix: '/api/v1/properties' });
  app.register(documentsRoutes, { prefix: '/api/v1/properties' });
  app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  app.register(aiRoutes, { prefix: '/api/v1/ai' });

  return app;
}
