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
