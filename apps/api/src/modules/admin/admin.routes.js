import { z } from 'zod';

import {
  getAdminBillingSnapshot,
  getAdminMediaVariantSnapshot,
  getAdminOverview,
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
}
