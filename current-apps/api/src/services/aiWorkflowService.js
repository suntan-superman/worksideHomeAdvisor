import {
  buildDocumentPrompt,
  buildImprovementPrompt,
  buildMarketingPrompt,
  buildPricingPrompt,
  buildTimingPrompt,
} from '@workside/prompts';

import { demoDashboard } from '../data/demoData.js';
import { buildPricingNarrative } from './pricingNarrative.js';
import { generateStructuredJson, isOpenAiConfigured } from './openaiClient.js';

const pricingSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    pricingStrategy: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: ['summary', 'strengths', 'risks', 'pricingStrategy', 'disclaimer'],
  additionalProperties: false,
};

const improvementSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          priority: { type: 'string' },
          rationale: { type: 'string' },
          estimatedImpact: { type: 'string' },
        },
        required: ['title', 'priority', 'rationale', 'estimatedImpact'],
        additionalProperties: false,
      },
    },
    disclaimer: { type: 'string' },
  },
  required: ['summary', 'recommendations', 'disclaimer'],
  additionalProperties: false,
};

const marketingSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    shortDescription: { type: 'string' },
    featureHighlights: { type: 'array', items: { type: 'string' } },
    photoSuggestions: { type: 'array', items: { type: 'string' } },
    disclaimer: { type: 'string' },
  },
  required: [
    'headline',
    'shortDescription',
    'featureHighlights',
    'photoSuggestions',
    'disclaimer',
  ],
  additionalProperties: false,
};

const documentSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    unresolvedQuestions: { type: 'array', items: { type: 'string' } },
    reviewWarnings: { type: 'array', items: { type: 'string' } },
    disclaimer: { type: 'string' },
  },
  required: ['title', 'body', 'unresolvedQuestions', 'reviewWarnings', 'disclaimer'],
  additionalProperties: false,
};

const timingSchema = {
  type: 'object',
  properties: {
    bestDays: { type: 'array', items: { type: 'string' } },
    bestWindow: { type: 'string' },
    rationale: { type: 'string' },
    confidence: { type: 'number' },
    disclaimer: { type: 'string' },
  },
  required: ['bestDays', 'bestWindow', 'rationale', 'confidence', 'disclaimer'],
  additionalProperties: false,
};

function stringifyPromptInput(input) {
  return JSON.stringify(input, null, 2);
}

export async function generatePricingInsights({
  property,
  pricingAnalysis,
  sellerGoals = ['maximize-profit'],
}) {
  const prompt = buildPricingPrompt({
    property,
    comps: pricingAnalysis.selectedComps,
    sellerGoals,
  });
  const fallbackNarrative = buildPricingNarrative(pricingAnalysis);
  const fallback = {
    summary: fallbackNarrative.summary,
    strengths: pricingAnalysis.strengths,
    risks: pricingAnalysis.risks,
    pricingStrategy: fallbackNarrative.pricingStrategy,
    disclaimer: 'Pricing guidance only. Not an appraisal.',
    source: 'fallback',
  };

  if (!isOpenAiConfigured()) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'pricing_insights',
      schema: pricingSchema,
      systemPrompt: prompt.system,
      userPrompt: stringifyPromptInput({
        input: prompt.input,
        computedPriceBand: pricingAnalysis.pricing.range,
        confidence: pricingAnalysis.pricing.confidence,
        medianPricePerSqft: pricingAnalysis.pricing.medianPricePerSqft,
        strengths: pricingAnalysis.strengths,
        risks: pricingAnalysis.risks,
      }),
    });

    return {
      ...result,
      source: 'openai',
    };
  } catch (error) {
    return {
      ...fallback,
      warning: error.message,
    };
  }
}

export async function generateImprovementInsights({
  property,
  rooms = [],
  budget = 5000,
  media = [],
}) {
  const prompt = buildImprovementPrompt({ property, rooms, budget, media });
  const fallback = {
    summary: 'Focus on cosmetic updates with strong photography payback before doing any major remodel work.',
    recommendations: demoDashboard.improvements.map((item) => ({
      title: item.title,
      priority: item.priority,
      rationale: item.impact,
      estimatedImpact: item.impact,
    })),
    disclaimer: 'Visual guidance only. Hidden conditions cannot be assessed from photos alone.',
    source: 'fallback',
  };

  if (!isOpenAiConfigured()) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'improvement_insights',
      schema: improvementSchema,
      systemPrompt: prompt.system,
      userPrompt: stringifyPromptInput({ input: prompt.input }),
    });

    return {
      ...result,
      source: 'openai',
    };
  } catch (error) {
    return {
      ...fallback,
      warning: error.message,
    };
  }
}

export async function generateMarketingInsights({ property, pricingAnalysis }) {
  const prompt = buildMarketingPrompt({
    property,
    pricing: pricingAnalysis?.pricing?.range,
    highlights: demoDashboard.marketing.heroHighlights,
  });
  const fallback = {
    headline: demoDashboard.marketing.suggestedHeadline,
    shortDescription:
      'Bright, spacious, and move-in ready with standout natural light, an updated kitchen, and backyard flexibility.',
    featureHighlights: demoDashboard.marketing.heroHighlights,
    photoSuggestions: [
      'Lead with the brightest kitchen angle.',
      'Show the backyard depth early in the photo order.',
      'Include one front elevation shot near golden hour.',
    ],
    disclaimer: 'Marketing copy should be reviewed for local compliance and fair housing rules.',
    source: 'fallback',
  };

  if (!isOpenAiConfigured()) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'marketing_insights',
      schema: marketingSchema,
      systemPrompt: prompt.system,
      userPrompt: stringifyPromptInput({ input: prompt.input }),
    });

    return {
      ...result,
      source: 'openai',
    };
  } catch (error) {
    return {
      ...fallback,
      warning: error.message,
    };
  }
}

export async function generateDocumentDraft({ property, pricingAnalysis, request }) {
  const prompt = buildDocumentPrompt({
    property,
    pricing: pricingAnalysis?.pricing?.range,
    request,
  });
  const fallback = {
    title: 'Pre-listing improvement plan',
    body:
      'This draft is for informational purposes only and should be reviewed by a licensed real estate professional or attorney.',
    unresolvedQuestions: ['Confirm jurisdiction-specific requirements before use.'],
    reviewWarnings: ['Not legal advice.', 'Review with licensed local professionals.'],
    disclaimer:
      'This draft was generated for informational purposes only. It is not legal advice and must be reviewed by licensed professionals.',
    source: 'fallback',
  };

  if (!isOpenAiConfigured()) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'document_draft',
      schema: documentSchema,
      systemPrompt: prompt.system,
      userPrompt: stringifyPromptInput({ input: prompt.input }),
    });

    return {
      ...result,
      source: 'openai',
    };
  } catch (error) {
    return {
      ...fallback,
      warning: error.message,
    };
  }
}

export async function generateTimingInsights({ property, pricingAnalysis }) {
  const prompt = buildTimingPrompt({
    property,
    pricing: pricingAnalysis?.pricing?.range,
    confidence: pricingAnalysis?.pricing?.confidence,
  });
  const fallback = {
    bestDays: ['Thursday', 'Friday'],
    bestWindow: 'List late in the week to maximize weekend attention.',
    rationale:
      'A late-week launch gives buyers a full weekend viewing window while preserving urgency.',
    confidence: pricingAnalysis?.pricing?.confidence || 0.58,
    disclaimer:
      'Timing guidance depends on local market conditions and should be treated as advisory only.',
    source: 'fallback',
  };

  if (!isOpenAiConfigured()) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'timing_insights',
      schema: timingSchema,
      systemPrompt: prompt.system,
      userPrompt: stringifyPromptInput({ input: prompt.input }),
    });

    return {
      ...result,
      source: 'openai',
    };
  } catch (error) {
    return {
      ...fallback,
      warning: error.message,
    };
  }
}
