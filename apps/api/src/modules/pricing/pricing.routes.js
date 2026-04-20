import { z } from 'zod';

import { assertPropertyEditableById } from '../properties/property.service.js';
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

function resolveUpgradeRequiredMessage(reason) {
  if (reason === 'FREE_PRICING_STARTER_USED') {
    return 'Free access includes one starter pricing analysis. Upgrade to run additional live pricing refreshes and unlock the full workflow.';
  }

  return 'Plan limit reached or feature not included.';
}

export async function pricingRoutes(fastify) {
  fastify.post('/:propertyId/pricing/analyze', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const property = await assertPropertyEditableById(propertyId);
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
        cooldownHours: 0,
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
            policy: decision.policy || null,
          },
        });
      }

      if (decision.action === 'DENY_UPGRADE_REQUIRED') {
        return reply.code(402).send({
          message: resolveUpgradeRequiredMessage(decision.reason),
          ...decision,
        });
      }

      if (decision.action === 'DENY_PROPERTY_QUERY_LIMIT') {
        return reply
          .code(429)
          .header('Retry-After', String(decision.retryAfterSeconds))
          .send({
            message: 'The pricing query limit for this property has been reached.',
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
      let finalizeResult;
      try {
        analysis = await analyzePropertyPricing(propertyId);
        finalizeResult = await finalizeFreshAnalysisRun({
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
          cacheReason: null,
          cachedAt: null,
          policy: decision.policy
            ? {
                ...decision.policy,
                runsUsedForProperty:
                  finalizeResult?.pricingPropertyUsage?.freshRunsTotal ??
                  decision.policy.runsUsedForProperty,
                runsRemainingForProperty:
                  decision.policy.maxRunsPerPropertyPerUser > 0
                    ? Math.max(
                        0,
                        decision.policy.maxRunsPerPropertyPerUser -
                          (finalizeResult?.pricingPropertyUsage?.freshRunsTotal ??
                            decision.policy.runsUsedForProperty),
                      )
                    : null,
                lastFreshRunAt:
                  finalizeResult?.pricingPropertyUsage?.lastFreshRunAt ||
                  analysis?.createdAt ||
                  decision.policy.lastFreshRunAt ||
                  null,
              }
            : null,
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
