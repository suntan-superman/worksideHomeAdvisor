import { propertySchema } from '@workside/validation';
import mongoose from 'mongoose';
import { z } from 'zod';

import { createProperty, getPropertyById, listProperties } from './property.service.js';

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
}
