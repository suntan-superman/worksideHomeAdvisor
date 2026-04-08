import { demoDashboard } from '../../data/demoData.js';
import {
  generateDocumentDraft,
  generateImprovementInsights,
  generateMarketingInsights,
  generatePricingInsights,
  generateTimingInsights,
} from '../../services/aiWorkflowService.js';
import { getComparableSalesForProperty } from '../../services/compsProvider.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';

const workflowHandlers = {
};

async function resolvePropertyContext(propertyId) {
  return (await getPropertyById(propertyId)) || demoDashboard.property;
}

export async function generateWorkflowResult(payload) {
  const property = await resolvePropertyContext(payload.propertyId);

  if (payload.workflow === 'pricing') {
    const latestPricing =
      (await getLatestPricingAnalysis(payload.propertyId)) ||
      (await getComparableSalesForProperty(property));
    const pricing =
      latestPricing.recommendedListLow !== undefined
        ? {
            pricing: {
              range: {
                low: latestPricing.recommendedListLow,
                mid: latestPricing.recommendedListMid,
                high: latestPricing.recommendedListHigh,
              },
              confidence: latestPricing.confidenceScore,
              medianPricePerSqft: latestPricing.medianPricePerSqft,
            },
            selectedComps: latestPricing.selectedComps || [],
            strengths: latestPricing.strengths || [],
            risks: latestPricing.risks || [],
            usedLiveData: latestPricing.usedLiveData,
          }
        : latestPricing;

    const result = await generatePricingInsights({
      property,
      pricingAnalysis: pricing,
      sellerGoals: property.sellerProfile?.goals || payload.payload.sellerGoals || ['maximize-profit'],
    });

    return {
      workflow: payload.workflow,
      propertyId: payload.propertyId,
      result: {
        ...result,
        priceBand: pricing.pricing.range,
        medianPricePerSqft: pricing.pricing.medianPricePerSqft,
        confidence: pricing.pricing.confidence,
        selectedCompCount: pricing.selectedComps.length,
        dataSource: pricing.usedLiveData ? 'RentCast AVM + sale listings' : 'Demo fallback',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  if (payload.workflow === 'improvements') {
    const result = await generateImprovementInsights({
      property,
      rooms: payload.payload.rooms || ['living room', 'primary bedroom', 'entry'],
      budget: payload.payload.budget || 5000,
      media: payload.payload.media || [],
    });

    return {
      workflow: payload.workflow,
      propertyId: payload.propertyId,
      result,
      generatedAt: new Date().toISOString(),
    };
  }

  if (payload.workflow === 'marketing') {
    const latestPricing = await getLatestPricingAnalysis(payload.propertyId);
    const result = await generateMarketingInsights({
      property,
      pricingAnalysis: latestPricing,
    });

    return {
      workflow: payload.workflow,
      propertyId: payload.propertyId,
      result,
      generatedAt: new Date().toISOString(),
    };
  }

  if (payload.workflow === 'documents') {
    const latestPricing = await getLatestPricingAnalysis(payload.propertyId);
    const result = await generateDocumentDraft({
      property,
      pricingAnalysis: latestPricing,
      request: payload.payload.request || 'Create a seller-ready informational draft.',
    });

    return {
      workflow: payload.workflow,
      propertyId: payload.propertyId,
      result,
      generatedAt: new Date().toISOString(),
    };
  }

  if (payload.workflow === 'timing') {
    const latestPricing = await getLatestPricingAnalysis(payload.propertyId);
    const result = await generateTimingInsights({
      property,
      pricingAnalysis: latestPricing,
    });

    return {
      workflow: payload.workflow,
      propertyId: payload.propertyId,
      result,
      generatedAt: new Date().toISOString(),
    };
  }

  throw new Error('Unsupported AI workflow.');
}
