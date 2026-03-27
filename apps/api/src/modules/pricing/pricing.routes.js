import { z } from 'zod';

import { getPropertyById } from '../properties/property.service.js';
import {
  enforceAnalysisRequest,
  finalizeCachedAnalysisReturn,
  finalizeFreshAnalysisRun,
  releaseAnalysisLock,
} from '../usage/usage-enforcement.service.js';
import { analyzePropertyPricing, getLatestPricingAnalysis } from './pricing.service.js';

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

export async function pricingRoutes(fastify) {
  fastify.post('/:propertyId/pricing/analyze', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const property = await getPropertyById(propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const latestAnalysis = await getLatestPricingAnalysis(propertyId);
      const decision = await enforceAnalysisRequest({
        userId: property.ownerUserId,
        propertyId,
        analysisType: 'pricing',
        featureKey: 'pricing.full',
        latestResult: latestAnalysis,
        resultTimestamp: latestAnalysis?.createdAt,
        cooldownHours: 24,
        inputSignature: {
          propertyId,
          updatedAt: property.updatedAt,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          squareFeet: property.squareFeet,
        },
      });

      if (decision.action === 'RETURN_CACHED_RESULT') {
        await finalizeCachedAnalysisReturn({
          userId: property.ownerUserId,
          propertyId,
          analysisType: 'pricing',
          usageContext: decision.context,
        });
        return reply.send({
          analysis: decision.cachedResult,
          metadata: {
            servedFromCache: true,
            cacheReason: decision.cacheReason,
            cachedAt: decision.cachedAt,
          },
        });
      }

      if (decision.action === 'DENY_UPGRADE_REQUIRED') {
        return reply.code(402).send({
          message: 'Plan limit reached or feature not included.',
          ...decision,
        });
      }

      if (decision.action === 'DENY_RATE_LIMIT') {
        return reply
          .code(429)
          .header('Retry-After', String(decision.retryAfterSeconds))
          .send({
            message: 'Too many pricing requests in a short time.',
            ...decision,
          });
      }

      let analysis;
      try {
        analysis = await analyzePropertyPricing(propertyId);
        await finalizeFreshAnalysisRun({
          userId: property.ownerUserId,
          propertyId,
          analysisType: 'pricing',
          usageContext: decision.context,
          inputHash: decision.inputHash,
        });
      } catch (error) {
        await releaseAnalysisLock({
          userId: property.ownerUserId,
          propertyId,
          analysisType: 'pricing',
          inputHash: decision.inputHash,
        });
        throw error;
      }

      return reply.code(201).send({
        analysis,
        metadata: {
          servedFromCache: false,
        },
      });
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
