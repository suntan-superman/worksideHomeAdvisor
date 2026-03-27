export function buildPricingNarrative(pricingAnalysis) {
  const confidence = pricingAnalysis.pricing.confidence;
  const midpoint = pricingAnalysis.pricing.range?.mid || 0;

  if (!midpoint) {
    return {
      summary:
        'Comparable sales and AVM support were both too thin to produce a dependable pricing band for this property.',
      pricingStrategy:
        'Do not publish this estimate as-is. Broaden the search radius, refresh market data, or get a local agent or appraiser review before setting a list price.',
    };
  }

  return {
    summary:
      confidence < 0.6
        ? 'The initial pricing band is directionally useful, but the comp set is thinner or noisier than ideal.'
        : 'The comp set supports a focused pricing band, with the most value coming from interpretation rather than raw data alone.',
    pricingStrategy:
      confidence < 0.6
        ? 'Start within the conservative-to-mid band and refresh with new comps as more data arrives.'
        : 'Target the mid-band and let presentation upgrades justify testing the upper edge if launch materials are strong.',
  };
}
