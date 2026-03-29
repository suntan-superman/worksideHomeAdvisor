import { z } from 'zod';

import {
  createAdminProvider,
  getAdminBillingSnapshot,
  getAdminMediaVariantSnapshot,
  getAdminOverview,
  getAdminProviderLeadSnapshot,
  getAdminProviderSnapshot,
  getAdminUsageSnapshot,
  getAdminWorkerSnapshot,
  listAdminProperties,
  listAdminUsers,
  runAdminMediaVariantCleanup,
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
  radiusMiles: z.number().int().min(5).max(150).optional(),
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  yearsInBusiness: z.number().int().min(0).max(80).optional(),
  isVerified: z.boolean().optional(),
  isSponsored: z.boolean().optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  averageResponseMinutes: z.number().int().min(5).max(7 * 24 * 60).optional(),
  planCode: z.string().trim().max(60).optional(),
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
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/providers', async (request, reply) => {
    try {
      const payload = createProviderSchema.parse(request.body || {});
      return reply.code(201).send(await createAdminProvider(payload));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/provider-leads', async (request, reply) => {
    try {
      const query = listQuerySchema.parse(request.query || {});
      return reply.send(await getAdminProviderLeadSnapshot(query));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
