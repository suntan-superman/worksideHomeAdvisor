import { z } from 'zod';

import { analyzePropertyPricing, getLatestPricingAnalysis } from './pricing.service.js';

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

export async function pricingRoutes(fastify) {
  fastify.post('/:propertyId/pricing/analyze', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const analysis = await analyzePropertyPricing(propertyId);
      return reply.code(201).send({ analysis });
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/pricing/latest', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const analysis = await getLatestPricingAnalysis(propertyId);

      if (!analysis) {
        return reply.code(404).send({ message: 'No pricing analysis found for this property.' });
      }

      return reply.send({ analysis });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
