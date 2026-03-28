import { z } from 'zod';

import {
  getAdminBillingSnapshot,
  getAdminOverview,
  getAdminUsageSnapshot,
  getAdminWorkerSnapshot,
  listAdminProperties,
  listAdminUsers,
} from './admin.service.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function adminRoutes(fastify) {
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
}
