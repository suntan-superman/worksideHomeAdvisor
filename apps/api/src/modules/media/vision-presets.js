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
    providerPreference: 'local_sharp',
    promptVersion: 1,
    outputCount: 1,
    disclaimerType: 'truthful_enhancement',
    recommendedUse: ['brochure', 'report'],
    basePrompt:
      'Create a cleaner, more listing-ready version of this room by lightly reducing visible clutter, simplifying surfaces, and improving presentation quality. Keep the room realistic and truthful. Preserve architecture, major furniture, layout, and core finishes.',
    helperText:
      'Reduce small distractions and improve presentation while keeping the room believable.',
  },
  {
    key: 'declutter_medium',
    legacyKeys: [],
    displayName: 'Medium Declutter',
    shortLabel: 'Declutter+',
    category: 'enhancement',
    roomCompatibility: ['kitchen', 'living_room', 'bedroom', 'bathroom', 'unknown'],
    providerPreference: 'local_sharp',
    promptVersion: 1,
    outputCount: 1,
    disclaimerType: 'truthful_enhancement',
    recommendedUse: ['report'],
    basePrompt:
      'Create a significantly cleaner and more presentation-ready version of this room by reducing visual clutter, simplifying countertops and surfaces, and improving overall buyer appeal. Keep the room realistic and believable. Preserve the true room layout, major architecture, and essential permanent features.',
    helperText:
      'A stronger cleanup pass that pushes the room toward listing-readiness without restaging it.',
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

