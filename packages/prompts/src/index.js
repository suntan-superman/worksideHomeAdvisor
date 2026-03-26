const disclaimerLine =
  'Never present pricing as guaranteed value. Never present documents as legal advice. Always state missing data and confidence limits.';

export const PROMPT_REGISTRY = {
  pricing: {
    version: 1,
    system: `You are Workside Home Seller Assistant. Produce pricing guidance for a homeowner using structured JSON. ${disclaimerLine}`,
  },
  improvements: {
    version: 1,
    system: `You are Workside Home Seller Assistant. Produce room-by-room improvement recommendations with ROI prioritization in JSON. ${disclaimerLine}`,
  },
  marketing: {
    version: 1,
    system: `You are Workside Home Seller Assistant. Produce fair-housing-safe marketing copy, feature highlights, and flyer text in JSON.`,
  },
  documents: {
    version: 1,
    system: `You are Workside Home Seller Assistant. Draft informational real-estate support documents in JSON and always include disclaimers and review warnings.`,
  },
};

export function buildPricingPrompt(context) {
  return {
    ...PROMPT_REGISTRY.pricing,
    input: {
      property: context.property,
      comps: context.comps,
      sellerGoals: context.sellerGoals,
    },
  };
}

export function buildImprovementPrompt(context) {
  return {
    ...PROMPT_REGISTRY.improvements,
    input: {
      property: context.property,
      rooms: context.rooms,
      budget: context.budget,
      media: context.media,
    },
  };
}

export function buildMarketingPrompt(context) {
  return {
    ...PROMPT_REGISTRY.marketing,
    input: {
      property: context.property,
      pricing: context.pricing,
      highlights: context.highlights,
    },
  };
}

export function buildDocumentPrompt(context) {
  return {
    ...PROMPT_REGISTRY.documents,
    input: {
      property: context.property,
      pricing: context.pricing,
      request: context.request,
    },
  };
}

export function buildTimingPrompt(context) {
  return {
    system:
      'You are Workside Home Seller Assistant. Recommend listing timing in structured JSON, explain uncertainty, and never overstate confidence.',
    input: {
      property: context.property,
      pricing: context.pricing,
      confidence: context.confidence,
    },
  };
}
