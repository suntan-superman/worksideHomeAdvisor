import { demoDashboard } from '../../data/demoData.js';
import { getPropertyWorkspaceSnapshot } from '../properties/property-workspace.service.js';
import { summarizeChecklistAsImprovements } from '../tasks/tasks.service.js';

export async function dashboardRoutes(fastify) {
  fastify.get('/:propertyId/dashboard', async (request, reply) => {
    try {
      const snapshot = await getPropertyWorkspaceSnapshot(request.params.propertyId);
      const property = snapshot?.property || null;
      const latestPricing = snapshot?.pricingAnalyses?.latest || null;
      const checklist = snapshot?.checklist || null;

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
