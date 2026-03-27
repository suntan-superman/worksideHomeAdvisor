import { z } from 'zod';

import { generatePropertyFlyer, getLatestPropertyFlyer } from './flyer.service.js';

const flyerRequestSchema = z.object({
  flyerType: z.enum(['sale', 'rental']).default('sale'),
});

export async function documentsRoutes(fastify) {
  fastify.post('/:propertyId/flyer/generate', async (request, reply) => {
    try {
      const payload = flyerRequestSchema.parse(request.body || {});
      const flyer = await generatePropertyFlyer({
        propertyId: request.params.propertyId,
        flyerType: payload.flyerType,
      });

      return reply.code(201).send({ flyer });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/flyer/latest', async (request, reply) => {
    try {
      const flyer = await getLatestPropertyFlyer(request.params.propertyId);
      return reply.send({ flyer });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
