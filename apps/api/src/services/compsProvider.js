import { demoDashboard } from '../data/demoData.js';
import {
  buildCompCacheKey,
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
      const pricing = calculatePricingFromComps(scoredComps, subject);
      const summary = summarizePricingStrengths(pricing.selectedComps);

      return {
        source: 'rentcast',
        usedLiveData: true,
        avm: rentcastResult.avm,
        normalizedComps,
        filteredComps,
        selectedComps: pricing.selectedComps,
        pricing,
        strengths: summary.strengths,
        risks: summary.risks,
      };
    }
  } catch (error) {
    console.error('[api] RentCast comps lookup failed, using demo comps instead.', {
      message: error.message,
    });
  }

  return buildDemoPricingAnalysis(subject);
}
