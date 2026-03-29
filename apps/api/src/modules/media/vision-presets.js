export const VISION_PRESETS = [
  {
    key: 'enhance_listing_quality',
    legacyKeys: [],
    displayName: 'Enhance for Listing',
    shortLabel: 'Enhanced',
    category: 'enhancement',
    roomCompatibility: ['kitchen', 'living_room', 'bedroom', 'bathroom', 'exterior', 'unknown'],
    providerPreference: 'local_sharp',
    promptVersion: 1,
    outputCount: 1,
    disclaimerType: 'truthful_enhancement',
    recommendedUse: ['brochure', 'report'],
    basePrompt:
      'Enhance this real estate photo for listing use. Improve brightness, clarity, and overall presentation while preserving the true structure, layout, and finishes of the room. Keep the image realistic, natural, and honest. Do not invent architectural features or remove major permanent elements.',
    helperText:
      'Improve brightness, clarity, and overall presentation while keeping the room realistic.',
  },
  {
    key: 'declutter_light',
    legacyKeys: ['declutter_preview'],
    displayName: 'Light Declutter',
    shortLabel: 'Declutter',
    category: 'enhancement',
    roomCompatibility: ['kitchen', 'living_room', 'bedroom', 'bathroom', 'unknown'],
    providerPreference: 'replicate',
    promptVersion: 1,
    outputCount: 2,
    disclaimerType: 'truthful_enhancement',
    recommendedUse: ['brochure', 'report'],
    basePrompt:
      'Clean up this residential interior photo for real estate listing use. Remove small clutter items, improve brightness and cleanliness. Keep all furniture and structure. Stay realistic.',
    helperText:
      'Reduce small distractions and improve presentation while keeping the room believable.',
    strength: 0.6,
    guidanceScale: 7.5,
    numInferenceSteps: 35,
    replicateModel: 'lucataco/sdxl-inpainting:latest',
  },
  {
    key: 'declutter_medium',
    legacyKeys: [],
    displayName: 'Medium Declutter',
    shortLabel: 'Declutter+',
    category: 'enhancement',
    roomCompatibility: ['kitchen', 'living_room', 'bedroom', 'bathroom', 'unknown'],
    providerPreference: 'replicate',
    promptVersion: 1,
    outputCount: 2,
    disclaimerType: 'truthful_enhancement',
    recommendedUse: ['report'],
    basePrompt:
      'Clean and simplify this residential interior photo. Reduce clutter and visual noise but preserve layout and furniture. Make the space feel open and tidy.',
    helperText:
      'A stronger cleanup pass that pushes the room toward listing-readiness without restaging it.',
    strength: 0.75,
    guidanceScale: 7.5,
    numInferenceSteps: 35,
    replicateModel: 'lucataco/sdxl-inpainting:latest',
  },
  {
    key: 'remove_furniture',
    legacyKeys: [],
    displayName: 'Remove Furniture',
    shortLabel: 'Empty Room',
    category: 'concept_preview',
    roomCompatibility: ['kitchen', 'living_room', 'bedroom', 'bathroom', 'exterior', 'unknown'],
    providerPreference: 'replicate',
    promptVersion: 1,
    outputCount: 2,
    disclaimerType: 'concept_preview',
    recommendedUse: ['report'],
    basePrompt:
      'Create a realistic version of this room with most movable furniture removed. Keep structure and layout intact. Make the room feel open and empty.',
    helperText:
      'Create a conceptual empty-room version for planning and persuasion, not direct listing replacement.',
    strength: 0.85,
    guidanceScale: 7.5,
    numInferenceSteps: 35,
    replicateModel: 'lucataco/sdxl-inpainting:latest',
  },
  {
    key: 'combined_listing_refresh',
    legacyKeys: [],
    displayName: 'Listing Refresh',
    shortLabel: 'Refresh',
    category: 'enhancement',
    roomCompatibility: ['kitchen', 'living_room', 'bedroom', 'bathroom', 'exterior', 'unknown'],
    providerPreference: 'local_sharp',
    promptVersion: 1,
    outputCount: 1,
    disclaimerType: 'truthful_enhancement',
    recommendedUse: ['brochure', 'report'],
    basePrompt:
      'Transform this room photo into a cleaner, brighter, more listing-ready version. Improve lighting, reduce clutter, and create a polished real-estate-photo feel while preserving the room’s true structure, layout, and finishes. Keep the image realistic and honest.',
    helperText:
      'Blend enhancement and cleanup into a more polished listing-ready image.',
  },
];

const LEGACY_PRESET_LOOKUP = new Map(
  VISION_PRESETS.flatMap((preset) =>
    [preset.key, ...(preset.legacyKeys || [])].map((lookupKey) => [lookupKey, preset]),
  ),
);

export function listVisionPresets() {
  return VISION_PRESETS.map((preset) => ({
    ...preset,
    legacyKeys: [...(preset.legacyKeys || [])],
    roomCompatibility: [...(preset.roomCompatibility || [])],
    recommendedUse: [...(preset.recommendedUse || [])],
  }));
}

export function resolveVisionPreset(presetKey = 'enhance_listing_quality') {
  return LEGACY_PRESET_LOOKUP.get(presetKey) || LEGACY_PRESET_LOOKUP.get('enhance_listing_quality');
}

export function getVisionPresetKeys() {
  return VISION_PRESETS.flatMap((preset) => [preset.key, ...(preset.legacyKeys || [])]);
}
