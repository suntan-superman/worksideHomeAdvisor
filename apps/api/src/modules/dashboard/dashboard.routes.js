import { demoDashboard } from '../../data/demoData.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { getOrCreatePropertyChecklist, summarizeChecklistAsImprovements } from '../tasks/tasks.service.js';

export async function dashboardRoutes(fastify) {
  fastify.get('/:propertyId/dashboard', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      const latestPricing = await getLatestPricingAnalysis(request.params.propertyId);
      const checklist = await getOrCreatePropertyChecklist(request.params.propertyId);

      if (property) {
        return reply.send({
          propertyId: request.params.propertyId,
          property: {
            ...property,
            readinessScore: checklist?.summary?.progressPercent ?? property.readinessScore ?? 0,
          },
          pricing: latestPricing
            ? {
                low: latestPricing.recommendedListLow,
                mid: latestPricing.recommendedListMid,
                high: latestPricing.recommendedListHigh,
                confidence: latestPricing.confidenceScore,
                selected: property.selectedListPrice ?? null,
                selectedSource: property.selectedListPriceSource || '',
              }
            : null,
          pricingSummary: latestPricing?.summary || '',
          improvements:
            summarizeChecklistAsImprovements(checklist).length
              ? summarizeChecklistAsImprovements(checklist)
              : demoDashboard.improvements,
          marketing: demoDashboard.marketing,
          comps: latestPricing?.selectedComps || [],
          tasks: checklist?.items || [],
          checklist,
          generatedAt: new Date().toISOString(),
        });
      }

      return reply.send({
        propertyId: request.params.propertyId,
        ...demoDashboard,
        checklist,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
