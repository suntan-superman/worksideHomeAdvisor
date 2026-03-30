import { z } from 'zod';

import {
  closeAdminProviderLeadAction,
  createAdminProvider,
  createAdminProviderCategoryAction,
  getAdminBillingSnapshot,
  getAdminMediaVariantSnapshot,
  getAdminOverview,
  getAdminProviderCategorySnapshot,
  getAdminProviderLeadSnapshot,
  getAdminProviderSnapshot,
  getAdminUsageSnapshot,
  getAdminWorkerSnapshot,
  listAdminProperties,
  listAdminUsers,
  resendAdminProviderLeadAction,
  runAdminMediaVariantCleanup,
  updateAdminProviderCategoryAction,
  updateAdminProviderReviewAction,
} from './admin.service.js';
import { requireAdminSession } from './admin-session.service.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createProviderSchema = z.object({
  businessName: z.string().trim().min(1).max(140),
  categoryKey: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  phone: z.string().trim().min(7).max(40),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(40),
  zipCodes: z.array(z.string().trim().min(3).max(12)).max(25).optional(),
  radiusMiles: z.number().int().min(5).max(1000).optional(),
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  yearsInBusiness: z.number().int().min(0).max(80).optional(),
  isVerified: z.boolean().optional(),
  isSponsored: z.boolean().optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  averageResponseMinutes: z.number().int().min(5).max(7 * 24 * 60).optional(),
  turnaroundLabel: z.string().trim().max(80).optional(),
  pricingSummary: z.string().trim().max(140).optional(),
  serviceHighlights: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
  approvalStatus: z.enum(['draft', 'review', 'approved', 'rejected']).optional(),
  licenseStatus: z.enum(['unverified', 'verified', 'not_required']).optional(),
  insuranceStatus: z.enum(['unverified', 'verified', 'not_required']).optional(),
  planCode: z.string().trim().max(60).optional(),
});

const createProviderCategorySchema = z.object({
  key: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  rolloutPhase: z.number().int().min(1).max(10).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

const updateProviderCategorySchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).optional(),
  rolloutPhase: z.number().int().min(1).max(10).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

const closeProviderLeadSchema = z.object({
  resolution: z.enum(['completed', 'cancelled']),
});

const updateProviderReviewSchema = z.object({
  approvalStatus: z.enum(['draft', 'review', 'approved', 'rejected']).optional(),
  licenseStatus: z.enum(['unverified', 'verified', 'not_required']).optional(),
  insuranceStatus: z.enum(['unverified', 'verified', 'not_required']).optional(),
  status: z.enum(['active', 'paused', 'pending', 'pending_billing', 'suspended']).optional(),
  isVerified: z.boolean().optional(),
  turnaroundLabel: z.string().trim().max(80).optional(),
  pricingSummary: z.string().trim().max(140).optional(),
  serviceHighlights: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
});

export async function adminRoutes(fastify) {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const adminContext = await requireAdminSession(request);
      request.adminContext = adminContext;
    } catch (error) {
      return reply.code(error.statusCode || 401).send({ message: error.message });
    }
  });

  fastify.get('/overview', async (_request, reply) => {
    try {
      return reply.send(await getAdminOverview());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/users', async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query || {});
      return reply.send(await listAdminUsers(query));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/properties', async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query || {});
      return reply.send(await listAdminProperties(query));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/billing', async (_request, reply) => {
    try {
      return reply.send(await getAdminBillingSnapshot());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/usage', async (_request, reply) => {
    try {
      return reply.send(await getAdminUsageSnapshot());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/workers', async (_request, reply) => {
    try {
      return reply.send(await getAdminWorkerSnapshot());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/media/variants', async (_request, reply) => {
    try {
      return reply.send(await getAdminMediaVariantSnapshot());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/media/cleanup-variants', async (_request, reply) => {
    try {
      return reply.send(await runAdminMediaVariantCleanup());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/providers', async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query || {});
      return reply.send(await getAdminProviderSnapshot(query));
    } catch (error) {
      request.log.error({ err: error }, 'admin providers snapshot failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/provider-categories', async (_request, reply) => {
    try {
      return reply.send(await getAdminProviderCategorySnapshot());
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/providers', async (request, reply) => {
    try {
      const payload = createProviderSchema.parse(request.body || {});
      return reply.code(201).send(await createAdminProvider(payload));
    } catch (error) {
      request.log.error({ err: error }, 'admin provider creation failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/provider-categories', async (request, reply) => {
    try {
      const payload = createProviderCategorySchema.parse(request.body || {});
      return reply.code(201).send(await createAdminProviderCategoryAction(payload));
    } catch (error) {
      request.log.error({ err: error }, 'admin provider category creation failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/provider-categories/:categoryKey', async (request, reply) => {
    try {
      const params = z.object({ categoryKey: z.string().trim().min(1) }).parse(request.params);
      const payload = updateProviderCategorySchema.parse(request.body || {});
      return reply.send(await updateAdminProviderCategoryAction(params.categoryKey, payload));
    } catch (error) {
      request.log.error({ err: error, categoryKey: request.params?.categoryKey }, 'admin provider category update failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/providers/:providerId/review', async (request, reply) => {
    try {
      const payload = updateProviderReviewSchema.parse(request.body || {});
      return reply.send(await updateAdminProviderReviewAction(request.params.providerId, payload));
    } catch (error) {
      request.log.error({ err: error, providerId: request.params?.providerId }, 'admin provider review update failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/provider-leads', async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query || {});
      return reply.send(await getAdminProviderLeadSnapshot(query));
    } catch (error) {
      request.log.error({ err: error }, 'admin provider leads snapshot failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/provider-leads/:leadRequestId/resend', async (request, reply) => {
    try {
      return reply.send(await resendAdminProviderLeadAction(request.params.leadRequestId));
    } catch (error) {
      request.log.error({ err: error, leadRequestId: request.params?.leadRequestId }, 'admin provider lead resend failed');
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/provider-leads/:leadRequestId/close', async (request, reply) => {
    try {
      const payload = closeProviderLeadSchema.parse(request.body || {});
      return reply.send(
        await closeAdminProviderLeadAction(request.params.leadRequestId, payload.resolution),
      );
    } catch (error) {
      request.log.error({ err: error, leadRequestId: request.params?.leadRequestId }, 'admin provider lead close failed');
      return reply.code(400).send({ message: error.message });
    }
  });
}
