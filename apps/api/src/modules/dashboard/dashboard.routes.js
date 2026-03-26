import { demoDashboard } from '../../data/demoData.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';

export async function dashboardRoutes(fastify) {
  fastify.get('/:propertyId/dashboard', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      const latestPricing = await getLatestPricingAnalysis(request.params.propertyId);

      if (property && latestPricing) {
        return reply.send({
          propertyId: request.params.propertyId,
          property,
          pricing: {
            low: latestPricing.recommendedListLow,
            mid: latestPricing.recommendedListMid,
            high: latestPricing.recommendedListHigh,
            confidence: latestPricing.confidenceScore,
          },
          pricingSummary: latestPricing.summary,
          improvements: demoDashboard.improvements,
          marketing: demoDashboard.marketing,
          comps: latestPricing.selectedComps,
          tasks: demoDashboard.tasks,
          generatedAt: new Date().toISOString(),
        });
      }

      return reply.send({
        propertyId: request.params.propertyId,
        ...demoDashboard,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
