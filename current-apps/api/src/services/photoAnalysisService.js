import sharp from 'sharp';

import { generateStructuredJson, isOpenAiConfigured } from './openaiClient.js';

const photoAnalysisResponseSchema = {
  type: 'object',
  properties: {
    roomGuess: { type: 'string' },
    overallQualityScore: { type: 'number' },
    lightingScore: { type: 'number' },
    compositionScore: { type: 'number' },
    clarityScore: { type: 'number' },
    bestUse: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
    highlights: { type: 'array', items: { type: 'string' } },
    retakeRecommended: { type: 'boolean' },
    summary: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: [
    'roomGuess',
    'overallQualityScore',
    'lightingScore',
    'compositionScore',
    'clarityScore',
    'bestUse',
    'issues',
    'suggestions',
    'highlights',
    'retakeRecommended',
    'summary',
    'disclaimer',
  ],
  additionalProperties: false,
};

const visionVariantReviewSchema = {
  type: 'object',
  properties: {
    structuralIntegrityScore: { type: 'number' },
    artifactScore: { type: 'number' },
    listingAppealScore: { type: 'number' },
    issues: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    suggestedAction: { type: 'string' },
    shouldHideByDefault: { type: 'boolean' },
  },
  required: [
    'structuralIntegrityScore',
    'artifactScore',
    'listingAppealScore',
    'issues',
    'strengths',
    'summary',
    'suggestedAction',
    'shouldHideByDefault',
  ],
  additionalProperties: false,
};

function buildFallbackPhotoAnalysis(payload) {
  const resolution = (payload.width || 0) * (payload.height || 0);
  const likelyLowResolution = resolution > 0 && resolution < 900000;

  return {
    roomGuess: payload.roomLabel,
    overallQualityScore: likelyLowResolution ? 58 : 72,
    lightingScore: 68,
    compositionScore: 70,
    clarityScore: likelyLowResolution ? 55 : 76,
    bestUse: 'General room documentation',
    issues: likelyLowResolution
      ? ['Image resolution looks a bit low for a hero listing photo.']
      : ['Automated fallback analysis is limited without vision review.'],
    suggestions: [
      'Retake with the camera held level and slightly farther back if the room feels cramped.',
      'Open blinds and turn on lamps to improve brightness balance.',
      'Clear counters and floor clutter before the next capture.',
    ],
    highlights: ['Useful as a room reference shot for the seller workspace.'],
    retakeRecommended: likelyLowResolution,
    summary:
      'Fallback analysis suggests the photo is usable for documentation, but a brighter and cleaner retake may improve marketing value.',
    disclaimer:
      'Photo guidance is advisory only and may miss hidden issues or context outside the frame.',
    source: 'fallback',
  };
}

export async function analyzePropertyPhoto({
  property,
  roomLabel,
  mimeType,
  imageBase64,
  width,
  height,
}) {
  const fallback = buildFallbackPhotoAnalysis({
    roomLabel,
    width,
    height,
  });

  if (!isOpenAiConfigured()) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'photo_quality_analysis',
      schema: photoAnalysisResponseSchema,
      systemPrompt:
        'You are Workside Home Seller Assistant. Analyze a homeowner-supplied property photo for listing quality. Respond as strict JSON. Focus on visual quality, lighting, composition, cleanliness, staging, and whether the image should be retaken for marketing use. Never claim to detect hidden structural issues.',
      userPrompt: JSON.stringify(
        {
          property: {
            title: property?.title,
            addressLine1: property?.addressLine1,
            city: property?.city,
            state: property?.state,
          },
          roomLabel,
          mimeType,
          width,
          height,
          task:
            'Evaluate this image for real-estate marketing quality and give concise seller-friendly suggestions.',
        },
        null,
        2,
      ),
      inputContent: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  property: {
                    title: property?.title,
                    city: property?.city,
                    state: property?.state,
                  },
                  roomLabel,
                  mimeType,
                  width,
                  height,
                  instructions:
                    'Analyze the attached room photo and return structured quality guidance for a seller preparing listing photos.',
                },
                null,
                2,
              ),
            },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${imageBase64}`,
            },
          ],
        },
      ],
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

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function buildFallbackVisionVariantReview({
  variantImageBase64,
  sourceImageBase64,
  presetKey,
  variantCategory,
}) {
  const variantBuffer = Buffer.from(variantImageBase64, 'base64');
  const sourceBuffer = sourceImageBase64 ? Buffer.from(sourceImageBase64, 'base64') : null;
  const variantStats = await sharp(variantBuffer).rotate().stats();
  const sourceStats = sourceBuffer ? await sharp(sourceBuffer).rotate().stats() : null;
  const brightness =
    variantStats.channels.slice(0, 3).reduce((sum, channel) => sum + Number(channel.mean || 0), 0) / 3;
  const contrast =
    variantStats.channels.slice(0, 3).reduce((sum, channel) => sum + Number(channel.stdev || 0), 0) / 3;
  const sourceBrightness = sourceStats
    ? sourceStats.channels.slice(0, 3).reduce((sum, channel) => sum + Number(channel.mean || 0), 0) / 3
    : brightness;
  const brightnessShift = Math.abs(brightness - sourceBrightness);

  const structuralIntegrityScore = clampScore(
    84 - brightnessShift * 0.32 - (presetKey === 'remove_furniture' ? 6 : 0),
  );
  const artifactScore = clampScore(
    82 - brightnessShift * 0.28 - (contrast < 28 ? 12 : 0),
  );
  const listingAppealScore = clampScore(
    62 + (brightness > 90 && brightness < 180 ? 10 : 0) + (contrast > 32 ? 8 : 0) + (presetKey === 'declutter_medium' ? 4 : 0),
  );
  const shouldHideByDefault =
    structuralIntegrityScore < 62 || artifactScore < 58 || listingAppealScore < 60;

  return {
    structuralIntegrityScore,
    artifactScore,
    listingAppealScore,
    issues: shouldHideByDefault
      ? ['Potential realism or artifact risk detected in this generated variant.']
      : ['Automated fallback review is limited without AI vision scoring.'],
    strengths:
      variantCategory === 'concept_preview'
        ? ['Useful as a planning-oriented concept preview when paired with the original image.']
        : ['Appears suitable for seller-facing review and possible material selection.'],
    summary: shouldHideByDefault
      ? 'Fallback review suggests this variant may have visible realism or artifact issues.'
      : 'Fallback review suggests this variant is credible enough for seller-facing review.',
    suggestedAction:
      variantCategory === 'concept_preview'
        ? 'Use this as a before/after planning aid rather than a direct replacement listing photo.'
        : 'Review this against the original and use it only if it remains truthful to the room.',
    shouldHideByDefault,
  };
}

export async function reviewVisionVariant({
  property,
  roomLabel,
  presetKey,
  variantCategory,
  mimeType,
  sourceImageBase64,
  variantImageBase64,
}) {
  if (!isOpenAiConfigured()) {
    return buildFallbackVisionVariantReview({
      variantImageBase64,
      sourceImageBase64,
      presetKey,
      variantCategory,
    });
  }

  try {
    const result = await generateStructuredJson({
      schemaName: 'vision_variant_review',
      schema: visionVariantReviewSchema,
      systemPrompt:
        'You are Workside Home Seller Assistant reviewing an AI-generated real-estate image variant. Score the variant for structural realism, artifact severity, and listing appeal. Be strict about warped walls, distorted windows, broken edges, unrealistic shadows, smeared furniture remnants, or flooring distortions.',
      userPrompt: JSON.stringify(
        {
          property: {
            title: property?.title,
            city: property?.city,
            state: property?.state,
          },
          roomLabel,
          presetKey,
          variantCategory,
          instructions:
            'Compare the original photo and generated variant. Return strict JSON with quality scoring and whether the variant should be hidden by default.',
        },
        null,
        2,
      ),
      inputContent: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  roomLabel,
                  presetKey,
                  variantCategory,
                  task:
                    'Review this generated real-estate image variant for structural realism, artifact severity, and seller-facing listing appeal.',
                },
                null,
                2,
              ),
            },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${sourceImageBase64}`,
            },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${variantImageBase64}`,
            },
          ],
        },
      ],
    });

    return {
      ...result,
      structuralIntegrityScore: clampScore(result.structuralIntegrityScore),
      artifactScore: clampScore(result.artifactScore),
      listingAppealScore: clampScore(result.listingAppealScore),
      source: 'openai',
    };
  } catch (error) {
    const fallback = await buildFallbackVisionVariantReview({
      variantImageBase64,
      sourceImageBase64,
      presetKey,
      variantCategory,
    });
    return {
      ...fallback,
      warning: error.message,
    };
  }
}
