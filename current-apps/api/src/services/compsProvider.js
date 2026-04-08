import { demoDashboard } from '../data/demoData.js';
import {
  buildCompCacheKey,
  calculatePricingFromAvm,
  calculatePricingFromComps,
  filterComparableSales,
  normalizeComp,
  scoreComparableSales,
  summarizePricingStrengths,
} from './pricingEngine.js';
import { fetchRentcastPricingData } from './rentcastClient.js';

function buildDemoPricingAnalysis(subject) {
  const filtered = filterComparableSales(demoDashboard.comps, subject);
  const scored = scoreComparableSales(filtered, subject);
  const pricing = calculatePricingFromComps(scored, subject);
  const summary = summarizePricingStrengths(pricing.selectedComps);

  return {
    source: 'demo',
    usedLiveData: false,
    avm: null,
    normalizedComps: scored,
    filteredComps: filtered,
    selectedComps: pricing.selectedComps,
    pricing,
    strengths: summary.strengths,
    risks: summary.risks,
    warning: 'Using demo comps because live RentCast data is unavailable.',
  };
}

export async function getComparableSalesForProperty(property) {
  const subject = {
    ...property,
    bedrooms: Number(property.bedrooms || 0),
    bathrooms: Number(property.bathrooms || 0),
    squareFeet: Number(property.squareFeet || 0),
    propertyType: property.propertyType || 'Single Family',
  };

  try {
    const rentcastResult = await fetchRentcastPricingData({
      addressLine1: subject.addressLine1,
      city: subject.city,
      state: subject.state,
      zip: subject.zip,
      propertyType: subject.propertyType,
      bedrooms: subject.bedrooms,
      bathrooms: subject.bathrooms,
      squareFootage: subject.squareFeet,
      cacheKey: buildCompCacheKey(subject),
    });

    if (rentcastResult.usedLiveData) {
      const normalizedComps = rentcastResult.comparables.map((item) =>
        normalizeComp(item, subject),
      );
      const filteredComps = filterComparableSales(normalizedComps, subject);
      const scoredComps = scoreComparableSales(filteredComps, subject);
      const compPricing = calculatePricingFromComps(scoredComps, subject);
      const hasCompPricing =
        compPricing.selectedComps.length > 0 && compPricing.range.mid > 0;
      const pricing = hasCompPricing
        ? compPricing
        : calculatePricingFromAvm(rentcastResult.avm, subject);
      const summary = summarizePricingStrengths(compPricing.selectedComps);
      const risks = [...summary.risks];
      let warning = null;

      if (!hasCompPricing) {
        warning =
          pricing.range.mid > 0
            ? 'No sold comps survived the current filters, so the recommendation is using a lower-confidence RentCast AVM fallback.'
            : 'No usable sold comps or AVM estimate were available from RentCast for this property.';

        if (pricing.range.mid > 0) {
          risks.push(
            'The current price band is based on the RentCast AVM fallback because nearby sold comps were limited.',
          );
        }
      }

      return {
        source: 'rentcast',
        usedLiveData: true,
        avm: rentcastResult.avm,
        normalizedComps,
        filteredComps,
        selectedComps: pricing.selectedComps,
        pricing,
        strengths: summary.strengths,
        risks,
        warning,
      };
    }
  } catch (error) {
    console.error('[api] RentCast comps lookup failed, using demo comps instead.', {
      message: error.message,
    });
  }

  return buildDemoPricingAnalysis(subject);
}
