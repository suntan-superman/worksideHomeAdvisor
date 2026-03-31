import { propertySchema } from '@workside/validation';
import mongoose from 'mongoose';
import { z } from 'zod';

import {
  archiveProperty,
  createProperty,
  getPropertyById,
  listProperties,
  restoreProperty,
} from './property.service.js';

const querySchema = z.object({
  ownerUserId: z.string().optional(),
});

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

export async function propertyRoutes(fastify) {
  fastify.get('/', async (request, reply) => {
    try {
      const query = querySchema.parse(request.query ?? {});
      const properties = await listProperties(query.ownerUserId);
      return reply.send({ properties });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const payload = propertySchema.parse(request.body);
      const ownerUserId =
        request.headers['x-user-id'] || new mongoose.Types.ObjectId().toString();
      const property = await createProperty(ownerUserId, payload);
      return reply.code(201).send({ property });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const property = await getPropertyById(propertyId);

      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      return reply.send({ property });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/:propertyId/archive', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const actorUserId = String(request.headers['x-user-id'] || '');
      const property = await archiveProperty(propertyId, actorUserId);
      return reply.send({ property });
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.'
          ? 404
          : error.message.includes('permission')
            ? 403
            : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/:propertyId/restore', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const actorUserId = String(request.headers['x-user-id'] || '');
      const property = await restoreProperty(propertyId, actorUserId);
      return reply.send({ property });
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.'
          ? 404
          : error.message.includes('permission')
            ? 403
            : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });
}
