const STANDARD_ONLY_PRESET_KEYS = new Set([
  'enhance_listing_quality',
  'lighting_boost',
  'declutter_light',
  'declutter_medium',
  'combined_listing_refresh',
]);

const PRO_PRESET_KEYS = new Set([
  'paint_warm_neutral',
  'paint_bright_white',
  'paint_soft_greige',
]);

const PREMIUM_PRESET_KEYS = new Set([
  'remove_furniture',
  'cleanup_empty_room',
  'floor_light_wood',
  'floor_medium_wood',
  'floor_dark_hardwood',
  'floor_lvp_neutral',
  'floor_tile_stone',
  'kitchen_white_cabinets_granite',
  'kitchen_white_cabinets_quartz',
  'kitchen_green_cabinets_granite',
  'kitchen_green_cabinets_quartz',
  'exterior_curb_appeal_refresh',
  'backyard_entertaining_refresh',
  'backyard_pool_preview',
]);

export const VISION_PLAN_VALUES = ['standard', 'pro', 'premium'];
const REMOVE_FURNITURE_MAX_EXECUTION_TIME_MS = 180_000;
const REMOVE_FURNITURE_BASIC_PROVIDER_TIMEOUT_MS = 120_000;
const REMOVE_FURNITURE_ADVANCED_PROVIDER_TIMEOUT_MS = 120_000;
const CLEANUP_ENHANCEMENT_MAX_EXECUTION_TIME_MS = 180_000;
export const PAINT_STRENGTH_MIN_COLOR_SHIFT = 0.12;
export const PAINT_STRENGTH_MIN_LUMINANCE_DELTA = 0.08;
export const PAINT_STRENGTH_MIN_PERCEPTIBILITY = 0.35;
export const PAINT_STRENGTH_MIN_ACCEPTABLE_SCORE = 5.5;
export const PAINT_STRENGTH_MIN_USABLE_SCORE = 4;
export const PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY = 0.25;

export function getPaintOutsideMaskLimit(candidate = {}, presetKey = '') {
  const normalizedPresetKey = String(presetKey || '');
  if (!normalizedPresetKey.startsWith('paint_')) {
    return 0.3;
  }

  const windowCoverageRatio = Math.max(
    Number(candidate.windowCoverageRatio || 0),
    Number(candidate.windowRejectionCoverageRatio || 0),
  );
  const windowBrightPixelRatio = Number(candidate.windowBrightPixelRatio || 0);
  const windowStructuredPixelRatio = Number(candidate.windowStructuredPixelRatio || 0);
  const averageBrightness = Number(candidate.averageBrightness || 0);
  const isWindowHeavyRoom =
    windowCoverageRatio > 0.25 ||
    averageBrightness > 0.6 ||
    (windowBrightPixelRatio > 0.4 && windowStructuredPixelRatio > 0.16);

  if (isWindowHeavyRoom) {
    return 0.6;
  }

  if (windowCoverageRatio > 0.1) {
    return 0.45;
  }

  return 0.3;
}

function resolvePaintStrengthThresholds(presetKey) {
  if (presetKey === 'paint_warm_neutral') {
    return {
      minColorShift: 0.11,
      minLuminanceDelta: PAINT_STRENGTH_MIN_LUMINANCE_DELTA,
      minPerceptibility: PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY,
      minAcceptableScore: 5,
    };
  }

  return {
    minColorShift: PAINT_STRENGTH_MIN_COLOR_SHIFT,
    minLuminanceDelta: PAINT_STRENGTH_MIN_LUMINANCE_DELTA,
    minPerceptibility: PAINT_STRENGTH_MIN_PERCEPTIBILITY,
    minAcceptableScore: PAINT_STRENGTH_MIN_ACCEPTABLE_SCORE,
  };
}

export function resolveVisionUserPlan({ preset, userPlan } = {}) {
  const normalizedUserPlan = String(userPlan || '').trim().toLowerCase();
  if (VISION_PLAN_VALUES.includes(normalizedUserPlan)) {
    return normalizedUserPlan;
  }

  if (PREMIUM_PRESET_KEYS.has(preset?.key) || preset?.upgradeTier === 'premium') {
    return 'premium';
  }

  if (PRO_PRESET_KEYS.has(preset?.key) || preset?.category === 'concept_preview') {
    return 'pro';
  }

  return 'standard';
}

export function isListingSafePreset(presetKey = '') {
  return [
    'enhance_listing_quality',
    'lighting_boost',
    'combined_listing_refresh',
  ].includes(String(presetKey || ''));
}

export function isConceptStudioPreset(presetKey = '') {
  const key = String(presetKey || '');
  return (
    key === 'remove_furniture' ||
    key === 'cleanup_empty_room' ||
    key.startsWith('paint_') ||
    key.startsWith('floor_') ||
    key.startsWith('kitchen_') ||
    key.startsWith('exterior_') ||
    key.startsWith('backyard_')
  );
}

export function isCleanupEnhancementPreset(presetKey = '') {
  return ['declutter_light', 'declutter_medium'].includes(String(presetKey || ''));
}

export function resolveVisionPipelineMode(presetKey = '') {
  if (isListingSafePreset(presetKey)) {
    return 'listing_safe';
  }

  if (isCleanupEnhancementPreset(presetKey)) {
    return 'cleanup_enhancement';
  }

  if (isConceptStudioPreset(presetKey)) {
    return 'concept_studio';
  }

  return 'enhancement';
}

export function buildProviderChain({ preset, userPlan, openAiAvailable = false } = {}) {
  const key = String(preset?.key || '');
  const isPaintPreset = key.startsWith('paint_');
  const isFloorPreset = key.startsWith('floor_');

  if (isListingSafePreset(key)) {
    return ['local_sharp'];
  }

  if (key === 'remove_furniture' || key === 'cleanup_empty_room') {
    return openAiAvailable
      ? ['replicate_basic', 'replicate_advanced', 'openai_edit']
      : ['replicate_basic', 'replicate_advanced'];
  }

  if (key === 'declutter_medium') {
    return openAiAvailable
      ? ['replicate_basic', 'replicate_advanced', 'openai_edit']
      : ['replicate_basic', 'replicate_advanced'];
  }

  if (key === 'declutter_light') {
    return ['replicate_basic', 'replicate_advanced'];
  }

  if (isFloorPreset) {
    if (key === 'floor_tile_stone') {
      return openAiAvailable
        ? ['replicate_basic', 'replicate_advanced', 'openai_edit', 'local_sharp']
        : ['replicate_basic', 'replicate_advanced', 'local_sharp'];
    }

    return ['local_sharp'];
  }

  if (isPaintPreset) {
    return ['local_sharp'];
  }

  if (preset?.providerPreference === 'local_sharp_only') {
    return ['local_sharp'];
  }

  if (key === 'remove_furniture') {
    return ['replicate_basic'];
  }

  if (STANDARD_ONLY_PRESET_KEYS.has(key)) {
    return ['replicate_basic'];
  }

  if (isConceptStudioPreset(key)) {
    return openAiAvailable
      ? ['replicate_basic', 'replicate_advanced', 'openai_edit']
      : ['replicate_basic', 'replicate_advanced'];
  }

  if (PREMIUM_PRESET_KEYS.has(key) && userPlan === 'premium' && openAiAvailable) {
    return ['replicate_basic', 'replicate_advanced', 'openai_edit'];
  }

  if (
    PREMIUM_PRESET_KEYS.has(key) ||
    PRO_PRESET_KEYS.has(key) ||
    preset?.category === 'concept_preview'
  ) {
    return ['replicate_basic', 'replicate_advanced'];
  }

  return ['replicate_basic'];
}

export function getReplicateSettings(providerKey, preset = {}) {
  const baseStrength = Number(preset.strength || 0.7);
  const baseGuidanceScale = Number(preset.guidanceScale || 7.5);
  const baseInferenceSteps = Number(preset.numInferenceSteps || 35);
  const baseOutputCount = Number(preset.outputCount || 2);
  const isRemoveFurniture = preset.key === 'remove_furniture';
  const isFlooringPreset = String(preset.key || '').startsWith('floor_');
  const isWallPaintPreset = String(preset.key || '').startsWith('paint_');
  const isDarkHardwoodPreset = preset.key === 'floor_dark_hardwood';
  const isTileStonePreset = preset.key === 'floor_tile_stone';
  const isBrightWhitePreset = preset.key === 'paint_bright_white';

  if (providerKey === 'replicate_advanced') {
    const strongerRemovalPreset = new Set(['remove_furniture', 'declutter_medium']);
    const advancedStrength = strongerRemovalPreset.has(preset.key)
      ? Math.min(0.98, baseStrength + 0.05)
      : Math.max(0.2, Math.min(0.9, baseStrength - 0.06));

    if (isRemoveFurniture) {
      return {
        model: preset.replicateModel,
        outputCount: Math.max(3, baseOutputCount),
        guidanceScale: Math.min(8.5, Number((baseGuidanceScale + 0.3).toFixed(2))),
        numInferenceSteps: Math.max(38, baseInferenceSteps + 4),
        strength: Number(Math.min(0.86, baseStrength + 0.06).toFixed(2)),
        scheduler: preset.scheduler,
        negativePrompt: preset.negativePrompt,
        timeoutMs: REMOVE_FURNITURE_ADVANCED_PROVIDER_TIMEOUT_MS,
      };
    }

    if (isFlooringPreset) {
      if (isTileStonePreset) {
        return {
          model: preset.replicateModel,
          outputCount: Math.max(2, baseOutputCount),
          guidanceScale: Math.min(10, Number((baseGuidanceScale + 0.15).toFixed(2))),
          numInferenceSteps: baseInferenceSteps + 4,
          strength: Number(Math.min(0.72, baseStrength + 0.03).toFixed(2)),
          scheduler: preset.scheduler,
          negativePrompt: preset.negativePrompt,
        };
      }
      return {
        model: preset.replicateModel,
        outputCount: Math.max(isTileStonePreset ? 4 : 3, baseOutputCount),
        guidanceScale: Math.min(
          10,
          Number(
            (
              baseGuidanceScale +
              (isDarkHardwoodPreset ? 0.3 : isTileStonePreset ? 0.35 : 0.2)
            ).toFixed(2),
          ),
        ),
        numInferenceSteps: baseInferenceSteps + (isDarkHardwoodPreset ? 4 : isTileStonePreset ? 5 : 3),
        strength: Number(
          Math.min(0.98, baseStrength + (isDarkHardwoodPreset ? 0.02 : isTileStonePreset ? 0.03 : 0.01)).toFixed(2),
        ),
        scheduler: preset.scheduler,
        negativePrompt: preset.negativePrompt,
      };
    }

    if (isWallPaintPreset) {
      return {
        model: preset.replicateModel,
        outputCount: Math.min(4, Math.max(4, baseOutputCount)),
        guidanceScale: Math.min(
          10,
          Number((baseGuidanceScale + (isBrightWhitePreset ? 0.55 : 0.45)).toFixed(2)),
        ),
        numInferenceSteps: baseInferenceSteps + (isBrightWhitePreset ? 5 : 4),
        strength: Number(
          Math.min(isBrightWhitePreset ? 0.97 : 0.96, baseStrength + (isBrightWhitePreset ? 0.02 : 0.03)).toFixed(2),
        ),
        scheduler: preset.scheduler,
        negativePrompt: preset.negativePrompt,
      };
    }

    return {
      model: preset.replicateModel,
      outputCount: Math.max(3, baseOutputCount + 1),
      guidanceScale: Math.min(10, Number((baseGuidanceScale + 0.8).toFixed(2))),
      numInferenceSteps: baseInferenceSteps + 8,
      strength: Number(advancedStrength.toFixed(2)),
      scheduler: preset.scheduler,
      negativePrompt: preset.negativePrompt,
    };
  }

  return {
    model: preset.replicateModel,
    outputCount:
      isRemoveFurniture
        ? Math.max(3, baseOutputCount)
        : isTileStonePreset
          ? Math.max(2, baseOutputCount)
          : baseOutputCount,
    guidanceScale: baseGuidanceScale,
    numInferenceSteps: isRemoveFurniture ? Math.max(38, baseInferenceSteps) : baseInferenceSteps,
    strength: isRemoveFurniture ? Math.min(0.82, baseStrength) : baseStrength,
    scheduler: preset.scheduler,
    negativePrompt: preset.negativePrompt,
    timeoutMs: isRemoveFurniture ? REMOVE_FURNITURE_BASIC_PROVIDER_TIMEOUT_MS : 120_000,
  };
}

export function calculateObjectRemovalScore({
  visualChangeRatio = 0,
  focusRegionChangeRatio = 0,
  topHalfChangeRatio = 0,
  maskedChangeRatio = 0,
  maskedEdgeDensityDelta = 0,
  outsideMaskChangeRatio = 0,
  remainingFurnitureOverlapRatio = 0,
  largestComponentPersistenceRatio = 0,
  newFurnitureAdditionRatio = 0,
  clearedMajorComponentCount = 0,
  totalMajorComponentCount = 0,
}) {
  const subtractionReward =
    focusRegionChangeRatio * 0.42 +
    visualChangeRatio * 0.18 +
    maskedChangeRatio * 0.26 +
    Math.max(0, -maskedEdgeDensityDelta) * 3.5;
  const clearanceReward =
    totalMajorComponentCount > 0
      ? (clearedMajorComponentCount / totalMajorComponentCount) * 0.18
      : 0;
  const driftPenalty = topHalfChangeRatio * 0.15 + outsideMaskChangeRatio * 0.14;
  const persistencePenalty =
    remainingFurnitureOverlapRatio * 0.3 +
    largestComponentPersistenceRatio * 0.22 +
    newFurnitureAdditionRatio * 0.24;
  return Number(
    Math.max(0, subtractionReward + clearanceReward - driftPenalty - persistencePenalty).toFixed(4),
  );
}

export function calculatePerceptibilityScore(candidate = {}) {
  return Number(
    (
      Number(candidate.maskedChangeRatio || 0) * 0.5 +
      Number(candidate.maskedColorShiftRatio || 0) * 0.3 +
      Math.abs(Number(candidate.maskedLuminanceDelta || 0)) * 0.2
    ).toFixed(4),
  );
}

export function calculateRealEstateTrustScore(candidate = {}, presetKey = '') {
  const normalizedPresetKey = String(presetKey || '');
  let score = 100;
  const windowIntegrityChangeRatio = Number(candidate.windowIntegrityChangeRatio || 0);
  const topHalfChangeRatio = Number(candidate.topHalfChangeRatio || 0);
  const outsideMaskChangeRatio = Number(candidate.outsideMaskChangeRatio || 0);
  const newFurnitureAdditionRatio = Number(candidate.newFurnitureAdditionRatio || 0);
  const furnitureCoverageIncreaseRatio = Number(candidate.furnitureCoverageIncreaseRatio || 0);
  const maskedEdgeDensityDelta = Number(candidate.maskedEdgeDensityDelta || 0);
  const remainingFurnitureOverlapRatio = Number(candidate.remainingFurnitureOverlapRatio || 0);
  const largestComponentPersistenceRatio = Number(candidate.largestComponentPersistenceRatio || 0);

  if (windowIntegrityChangeRatio > 0.015) {
    score -= Math.min(70, (windowIntegrityChangeRatio - 0.015) * 700);
  }

  const structuralLimit =
    normalizedPresetKey === 'remove_furniture' ||
    normalizedPresetKey === 'cleanup_empty_room'
      ? 0.12
      : isConceptStudioPreset(normalizedPresetKey)
        ? 0.1
        : 0.08;
  if (topHalfChangeRatio > structuralLimit) {
    score -= Math.min(36, (topHalfChangeRatio - structuralLimit) * 260);
  }

  const outsideLimit = normalizedPresetKey.startsWith('paint_')
    ? 0.16
    : normalizedPresetKey.startsWith('floor_')
      ? 0.14
      : normalizedPresetKey === 'remove_furniture'
        ? 0.18
        : 0.22;
  if (outsideMaskChangeRatio > outsideLimit) {
    score -= Math.min(28, (outsideMaskChangeRatio - outsideLimit) * 150);
  }

  if (newFurnitureAdditionRatio > 0.015) {
    score -= Math.min(32, (newFurnitureAdditionRatio - 0.015) * 180);
  }

  if (furnitureCoverageIncreaseRatio > 0.01) {
    score -= Math.min(28, (furnitureCoverageIncreaseRatio - 0.01) * 420);
  }

  if (normalizedPresetKey === 'remove_furniture') {
    if (remainingFurnitureOverlapRatio > 0.5) {
      score -= Math.min(24, (remainingFurnitureOverlapRatio - 0.5) * 80);
    }
    if (largestComponentPersistenceRatio > 0.65) {
      score -= Math.min(22, (largestComponentPersistenceRatio - 0.65) * 85);
    }
    if (maskedEdgeDensityDelta > 0.004) {
      score -= Math.min(18, maskedEdgeDensityDelta * 600);
    }
  }

  if (candidate.rejectionCategory === 'architectural_drift') {
    score -= 24;
  } else if (candidate.rejectionCategory === 'furniture_restaging') {
    score -= 22;
  } else if (candidate.rejectionCategory === 'wall_feature_addition') {
    score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getMinimumTrustThreshold(presetKey = '') {
  const normalizedPresetKey = String(presetKey || '');
  if (isListingSafePreset(normalizedPresetKey)) {
    return 78;
  }
  if (
    normalizedPresetKey === 'remove_furniture' ||
    normalizedPresetKey === 'cleanup_empty_room'
  ) {
    return 64;
  }
  if (normalizedPresetKey.startsWith('paint_') || normalizedPresetKey.startsWith('floor_')) {
    return 66;
  }
  return 64;
}

export function meetsMinimumTrustThreshold(candidate = {}, presetKey = '') {
  return calculateRealEstateTrustScore(candidate, presetKey) >= getMinimumTrustThreshold(presetKey);
}

export function calculateConceptUtilityScore(candidate = {}, presetKey = '') {
  const trust = calculateRealEstateTrustScore(candidate, presetKey) / 100;
  const visibleChange = Math.min(
    1,
    Number(candidate.focusRegionChangeRatio || candidate.maskedChangeRatio || 0) * 3,
  );
  const objectRemoval = Math.min(1, Number(candidate.objectRemovalScore || 0) * 2.2);
  const paintOrFloorChange = Math.min(
    1,
    Number(candidate.maskedChangeRatio || 0) * 1.8 +
      Math.abs(Number(candidate.maskedLuminanceDelta || 0)) * 1.2 +
      Number(candidate.maskedColorShiftRatio || 0) * 1.3,
  );
  const clutterReduction = Math.min(
    1,
    Number(candidate.maskedChangeRatio || 0) * 1.4 +
      Math.max(0, -Number(candidate.maskedEdgeDensityDelta || 0)) * 90,
  );

  let taskScore = visibleChange;

  if (presetKey === 'remove_furniture' || presetKey === 'cleanup_empty_room') {
    taskScore = Math.max(visibleChange, objectRemoval);
  } else if (isCleanupEnhancementPreset(presetKey)) {
    taskScore = Math.max(visibleChange * 0.7, clutterReduction);
  } else if (String(presetKey || '').startsWith('paint_') || String(presetKey || '').startsWith('floor_')) {
    taskScore = Math.max(visibleChange, paintOrFloorChange);
  }

  return Number((trust * 0.58 + taskScore * 0.42).toFixed(4));
}

export function scorePaintCandidate(candidate = {}, presetKey = '') {
  const normalizedPresetKey = String(presetKey || '');
  const perceptibilityScore = calculatePerceptibilityScore(candidate);
  const outsideMaskChangeRatio = Number(candidate.outsideMaskChangeRatio || 0);
  const penalties = Number(candidate.paintStrength?.penalties ?? 0);
  const outsideMaskLimit = getPaintOutsideMaskLimit(candidate, normalizedPresetKey);
  const strengthBoost =
    normalizedPresetKey === 'paint_bright_white'
      ? 1.08
      : normalizedPresetKey === 'paint_warm_neutral'
        ? 1.04
        : 1;
  const visualImpact = Number((perceptibilityScore * strengthBoost).toFixed(4));
  const spillPenalty = Math.max(0, outsideMaskChangeRatio - outsideMaskLimit);
  const penaltyMultiplier = Math.max(0.4, 1 - penalties * 0.08);
  const finalScore = Number(
    Math.max(0, visualImpact * penaltyMultiplier - spillPenalty).toFixed(4),
  );

  let classification = 'no-op';
  if (visualImpact >= 0.35 && perceptibilityScore >= 0.25) {
    classification = 'strong';
  } else if (visualImpact >= 0.2 && finalScore >= 0.06) {
    classification = 'weak';
  }

  return {
    visualImpact,
    spillPenalty: Number(spillPenalty.toFixed(4)),
    penaltyMultiplier: Number(penaltyMultiplier.toFixed(2)),
    finalScore,
    classification,
    shouldUse:
      classification === 'strong' ||
      (classification === 'weak' &&
        finalScore >= 0.08 &&
        outsideMaskChangeRatio <= Math.max(0.22, outsideMaskLimit)),
  };
}

export function normalizeVisionCandidateScore(candidate = {}, presetKey = '') {
  const overallScore = Number(candidate.overallScore || 0);
  if (!Number.isFinite(overallScore) || overallScore <= 0) {
    const perceptibilityScore = calculatePerceptibilityScore(candidate);
    const maskedChangeRatio = Number(candidate.maskedChangeRatio || 0);
    const focusRegionChangeRatio = Number(candidate.focusRegionChangeRatio || 0);
    const outsideMaskChangeRatio = Number(candidate.outsideMaskChangeRatio || 0);
    const outsideMaskLimit = getPaintOutsideMaskLimit(candidate, presetKey);
    const derivedScore =
      perceptibilityScore * 14 +
      maskedChangeRatio * 3 +
      focusRegionChangeRatio * 1.5 -
      Math.max(0, outsideMaskChangeRatio - outsideMaskLimit) * 4;
    return Number(Math.max(0, Math.min(10, derivedScore)).toFixed(2));
  }

  return Number((overallScore > 10 ? overallScore / 10 : overallScore).toFixed(2));
}

export function evaluatePaintStrength(candidate = {}, presetKey = '') {
  const maskedColorShiftRatio = Number(candidate.maskedColorShiftRatio || 0);
  const maskedLuminanceDelta = Math.abs(Number(candidate.maskedLuminanceDelta || 0));
  const perceptibilityScore = calculatePerceptibilityScore(candidate);
  const thresholds = resolvePaintStrengthThresholds(presetKey);
  let penalties = 0;

  if (maskedColorShiftRatio < thresholds.minColorShift) {
    penalties += 3;
  }

  if (maskedLuminanceDelta < thresholds.minLuminanceDelta) {
    penalties += 2;
  }

  if (perceptibilityScore < thresholds.minPerceptibility) {
    penalties += 2;
  }

  const baselineScore = normalizeVisionCandidateScore(candidate, presetKey);
  const finalScore = Number(Math.max(0, baselineScore - penalties).toFixed(2));

  return {
    baselineScore,
    finalScore,
    penalties,
    maskedColorShiftRatio,
    maskedLuminanceDelta,
    perceptibilityScore,
    minColorShift: thresholds.minColorShift,
    minLuminanceDelta: thresholds.minLuminanceDelta,
    minPerceptibility: thresholds.minPerceptibility,
    minAcceptableScore: thresholds.minAcceptableScore,
    passes: finalScore >= thresholds.minAcceptableScore,
  };
}

export function isUsablePaintStrength(paintStrength = {}) {
  return (
    Number(paintStrength.finalScore || 0) >= PAINT_STRENGTH_MIN_USABLE_SCORE &&
    Number(paintStrength.perceptibilityScore || 0) >= PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY
  );
}

export function getVisionExecutionTimeBudgetMs(presetKey) {
  if (presetKey === 'remove_furniture') {
    return REMOVE_FURNITURE_MAX_EXECUTION_TIME_MS;
  }
  if (isCleanupEnhancementPreset(presetKey)) {
    return CLEANUP_ENHANCEMENT_MAX_EXECUTION_TIME_MS;
  }

  return 120_000;
}

export function isHighConfidenceEarlyExitCandidate(candidate, presetKey) {
  if (!candidate) {
    return false;
  }

  const normalizedPresetKey = String(presetKey || '');

  if (normalizedPresetKey.startsWith('floor_')) {
    if (normalizedPresetKey === 'floor_tile_stone') {
      return (
        candidate.providerKey === 'local_sharp' &&
        Number(candidate.focusRegionChangeRatio || 0) >= 0.1 &&
        Number(candidate.maskedChangeRatio || 0) >= 0.14 &&
        (
          Number(candidate.maskedColorShiftRatio || 0) >= 0.08 ||
          (
            Number(candidate.maskedLuminanceDelta || 0) >= 0.018 &&
            Number(candidate.maskedEdgeDensityDelta || 0) >= 0.01
          )
        ) &&
        Number(candidate.maskedLuminanceDelta || 0) >= -0.005 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.1 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.05 &&
        Number(candidate.furnitureCoverageIncreaseRatio ?? 1) <= 0.004 &&
        Number(candidate.newFurnitureAdditionRatio || 0) <= 0.006
      );
    }

    if (normalizedPresetKey === 'floor_dark_hardwood') {
      return (
        Number(candidate.focusRegionChangeRatio || 0) >= 0.16 &&
        Number(candidate.maskedChangeRatio || 0) >= 0.18 &&
        Number(candidate.maskedLuminanceDelta || 0) <= -0.055 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.12 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.05 &&
        Number(candidate.furnitureCoverageIncreaseRatio ?? 1) <= 0.008
      );
    }

    return (
      Number(candidate.focusRegionChangeRatio || 0) >= 0.15 &&
      Number(candidate.maskedChangeRatio || 0) >= 0.16 &&
      Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.12 &&
      Number(candidate.topHalfChangeRatio ?? 1) <= 0.06 &&
      Number(candidate.furnitureCoverageIncreaseRatio ?? 1) <= 0.01
    );
  }

  if (normalizedPresetKey.startsWith('paint_')) {
    if (normalizedPresetKey === 'paint_dark_charcoal_test') {
      return (
        Number(candidate.maskedChangeRatio || 0) >= 0.12 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.16 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.08 &&
        Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.01 &&
        Number(candidate.furnitureCoverageIncreaseRatio ?? 1) <= 0.01
      );
    }

    const paintStrength = evaluatePaintStrength(candidate, normalizedPresetKey);

    if (normalizedPresetKey === 'paint_bright_white') {
      return (
        Number(candidate.maskedChangeRatio || 0) >= 0.16 &&
        paintStrength.passes &&
        Number(candidate.maskedColorShiftRatio || 0) >= paintStrength.minColorShift &&
        Number(candidate.maskedLuminanceDelta || 0) >= paintStrength.minLuminanceDelta &&
        Number(candidate.maskedEdgeDensityDelta ?? 1) <= 0.001 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.12 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.05 &&
        Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.01 &&
        Number(candidate.furnitureCoverageIncreaseRatio ?? 1) <= 0.008
      );
    }

    return (
      Number(candidate.maskedChangeRatio || 0) >= 0.14 &&
      paintStrength.passes &&
      Number(candidate.maskedColorShiftRatio || 0) >= paintStrength.minColorShift &&
      Math.abs(Number(candidate.maskedLuminanceDelta || 0)) >= paintStrength.minLuminanceDelta &&
      Number(candidate.maskedEdgeDensityDelta ?? 1) <= 0.001 &&
      Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.14 &&
      Number(candidate.topHalfChangeRatio ?? 1) <= 0.06 &&
      Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.015 &&
      Number(candidate.furnitureCoverageIncreaseRatio ?? 1) <= 0.01
    );
  }

  if (normalizedPresetKey !== 'remove_furniture') {
    return true;
  }

  const totalMajorComponentCount = Number(candidate.totalMajorComponentCount || 0);
  const clearedMajorComponentCount = Number(candidate.clearedMajorComponentCount || 0);
  const clearanceRatio =
    totalMajorComponentCount > 0 ? clearedMajorComponentCount / totalMajorComponentCount : 1;

  return (
    Number(candidate.objectRemovalScore || 0) >= 0.34 &&
    Number(candidate.focusRegionChangeRatio || 0) >= 0.2 &&
    Number(candidate.maskedChangeRatio || 0) >= 0.3 &&
    Number(candidate.topHalfChangeRatio ?? 1) <= 0.1 &&
    Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.2 &&
    Number(candidate.remainingFurnitureOverlapRatio ?? 1) <= 0.1 &&
    Number(candidate.largestComponentPersistenceRatio ?? 1) <= 0.18 &&
    Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.05 &&
    clearanceRatio >= 0.75
  );
}

export function isCandidateSufficient(candidate, presetKey) {
  if (!candidate) {
    return false;
  }

  if (!meetsMinimumTrustThreshold(candidate, presetKey)) {
    return false;
  }

  if (presetKey === 'remove_furniture') {
    return (
      (
        Number(candidate.objectRemovalScore || 0) >= 0.18 &&
        Number(candidate.remainingFurnitureOverlapRatio ?? 1) <= 0.5 &&
        Number(candidate.largestComponentPersistenceRatio ?? 1) <= 0.72 &&
        Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.22
      ) ||
      (
        Number(candidate.focusRegionChangeRatio || 0) >= 0.1 &&
        Number(candidate.maskedChangeRatio || 0) >= 0.18 &&
        Number(candidate.maskedEdgeDensityDelta || 0) <= -0.003 &&
        Number(candidate.remainingFurnitureOverlapRatio ?? 1) <= 0.55 &&
        Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.24
      )
    );
  }

  if (presetKey === 'declutter_light' || presetKey === 'declutter_medium') {
    const minimumMaskedChange = presetKey === 'declutter_medium' ? 0.11 : 0.06;
    const minimumFocusChange = presetKey === 'declutter_medium' ? 0.09 : 0.05;
    const minimumEdgeReduction = presetKey === 'declutter_medium' ? -0.0035 : -0.002;

    return (
      (
        Number(candidate.maskedChangeRatio || 0) >= minimumMaskedChange ||
        Number(candidate.focusRegionChangeRatio || 0) >= minimumFocusChange
      ) &&
      (
        Number(candidate.maskedEdgeDensityDelta || 0) <= minimumEdgeReduction ||
        Number(candidate.maskedChangeRatio || 0) >= (presetKey === 'declutter_medium' ? 0.18 : 0.1)
      ) &&
      Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.18 &&
      Number(candidate.topHalfChangeRatio ?? 1) <= 0.1 &&
      Number(candidate.windowIntegrityChangeRatio ?? 1) <= 0.025 &&
      Number(candidate.maskedEdgeDensityDelta ?? 0) <= 0.012
    );
  }

  if (String(presetKey || '').startsWith('floor_')) {
    if (presetKey === 'floor_tile_stone') {
      return (
        Number(candidate.focusRegionChangeRatio || 0) >= 0.07 &&
        Number(candidate.maskedChangeRatio || 0) >= 0.1 &&
        (
          Number(candidate.maskedColorShiftRatio || 0) >= 0.065 ||
          Number(candidate.maskedLuminanceDelta || 0) >= 0.015 ||
          Number(candidate.maskedEdgeDensityDelta || 0) >= 0.01
        ) &&
        Number(candidate.maskedLuminanceDelta || 0) >= -0.005 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.07 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= 0.12 &&
        Number(candidate.furnitureCoverageIncreaseRatio || 0) <= 0.006 &&
        Number(candidate.newFurnitureAdditionRatio || 0) <= 0.01
      );
    }

    if (presetKey === 'floor_dark_hardwood') {
      return (
        Number(candidate.focusRegionChangeRatio || 0) >= 0.12 &&
        Number(candidate.maskedChangeRatio || 0) >= 0.14 &&
        Number(candidate.maskedLuminanceDelta || 0) <= -0.035 &&
        Number(candidate.furnitureCoverageIncreaseRatio || 0) <= 0.018
      );
    }

    // Relaxed thresholds for subtle floor tone changes
    return (
      Number(candidate.focusRegionChangeRatio || 0) >= 0.05 &&
      Number(candidate.maskedChangeRatio || 0) >= 0.06 &&
      Number(candidate.furnitureCoverageIncreaseRatio || 0) <= 0.02
    );
  }

  if (String(presetKey || '').startsWith('paint_')) {
    const maskedColorShiftRatio = Number(candidate.maskedColorShiftRatio || 0);
    const maskedLuminanceDelta = Number(candidate.maskedLuminanceDelta || 0);
    const furnitureCoverageIncreaseRatio = Number(candidate.furnitureCoverageIncreaseRatio || 0);
    const newFurnitureAdditionRatio = Number(candidate.newFurnitureAdditionRatio || 0);
    const maskedEdgeDensityDelta = Number(candidate.maskedEdgeDensityDelta || 0);
    const outsideMaskLimit = getPaintOutsideMaskLimit(candidate, presetKey);

    if (presetKey === 'paint_dark_charcoal_test') {
      return (
        Number(candidate.maskedChangeRatio || 0) >= 0.12 &&
        maskedColorShiftRatio >= 0.08 &&
        Math.abs(maskedLuminanceDelta) >= 0.06 &&
        maskedEdgeDensityDelta <= 0.003 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.08 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= outsideMaskLimit &&
        furnitureCoverageIncreaseRatio <= 0.01 &&
        newFurnitureAdditionRatio <= 0.01
      );
    }

    const paintStrength = evaluatePaintStrength(candidate, presetKey);

    if (presetKey === 'paint_bright_white') {
      return (
        Number(candidate.maskedChangeRatio || 0) >= 0.12 &&
        maskedColorShiftRatio >= paintStrength.minColorShift &&
        maskedLuminanceDelta >= paintStrength.minLuminanceDelta &&
        paintStrength.perceptibilityScore >= PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY &&
        isUsablePaintStrength(paintStrength) &&
        maskedEdgeDensityDelta <= 0.0025 &&
        Number(candidate.topHalfChangeRatio ?? 1) <= 0.08 &&
        Number(candidate.outsideMaskChangeRatio ?? 1) <= outsideMaskLimit &&
        furnitureCoverageIncreaseRatio <= 0.01 &&
        newFurnitureAdditionRatio <= 0.01
      );
    }

    return (
      Number(candidate.maskedChangeRatio || 0) >= 0.12 &&
      maskedColorShiftRatio >= paintStrength.minColorShift &&
      Math.abs(maskedLuminanceDelta) >= paintStrength.minLuminanceDelta &&
      paintStrength.perceptibilityScore >= PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY &&
      isUsablePaintStrength(paintStrength) &&
      maskedEdgeDensityDelta <= 0.0025 &&
      Number(candidate.topHalfChangeRatio ?? 1) <= 0.08 &&
      Number(candidate.outsideMaskChangeRatio ?? 1) <= outsideMaskLimit &&
      furnitureCoverageIncreaseRatio <= 0.01 &&
      newFurnitureAdditionRatio <= 0.01
    );
  }

  return Number(candidate.overallScore || 0) >= 62;
}

function isPreferredFinishFallbackCandidate(candidate, presetKey) {
  if (!candidate) {
    return false;
  }

  const normalizedPresetKey = String(presetKey || '');
  const isPaintPreset = normalizedPresetKey.startsWith('paint_');
  const isFloorPreset = normalizedPresetKey.startsWith('floor_');
  if ((!isPaintPreset && !isFloorPreset) || candidate.providerKey !== 'local_sharp') {
    return false;
  }

  const maskedChangeRatio = Number(candidate.maskedChangeRatio || 0);
  const maskedColorShiftRatio = Number(candidate.maskedColorShiftRatio || 0);
  const maskedLuminanceDelta = Number(candidate.maskedLuminanceDelta || 0);
  const topHalfChangeRatio = Number(candidate.topHalfChangeRatio ?? 1);
  const outsideMaskChangeRatio = Number(candidate.outsideMaskChangeRatio ?? 1);
  const furnitureCoverageIncreaseRatio = Number(candidate.furnitureCoverageIncreaseRatio || 0);
  const newFurnitureAdditionRatio = Number(candidate.newFurnitureAdditionRatio || 0);
  const maskedEdgeDensityDelta = Number(candidate.maskedEdgeDensityDelta || 0);
  const focusRegionChangeRatio = Number(candidate.focusRegionChangeRatio || 0);
  const paintStrength = evaluatePaintStrength(candidate, normalizedPresetKey);
  const outsideMaskLimit = getPaintOutsideMaskLimit(candidate, normalizedPresetKey);

  if (isPaintPreset) {
    if (
      topHalfChangeRatio > 0.08 ||
      outsideMaskChangeRatio > outsideMaskLimit ||
      furnitureCoverageIncreaseRatio > 0.01 ||
      newFurnitureAdditionRatio > 0.01 ||
      maskedEdgeDensityDelta > 0.003
    ) {
      return false;
    }

    if (normalizedPresetKey === 'paint_bright_white') {
      return (
        maskedChangeRatio >= 0.1 &&
        maskedColorShiftRatio >= paintStrength.minColorShift &&
        maskedLuminanceDelta >= paintStrength.minLuminanceDelta &&
        paintStrength.perceptibilityScore >= PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY &&
        isUsablePaintStrength(paintStrength)
      );
    }

    if (normalizedPresetKey === 'paint_dark_charcoal_test') {
      return (
        maskedChangeRatio >= 0.1 &&
        maskedColorShiftRatio >= 0.08 &&
        Math.abs(maskedLuminanceDelta) >= 0.06
      );
    }

    return (
      maskedChangeRatio >= 0.1 &&
      maskedColorShiftRatio >= paintStrength.minColorShift &&
      Math.abs(maskedLuminanceDelta) >= paintStrength.minLuminanceDelta &&
      paintStrength.perceptibilityScore >= PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY &&
      isUsablePaintStrength(paintStrength)
    );
  }

  if (
    topHalfChangeRatio > 0.08 ||
    outsideMaskChangeRatio > 0.16 ||
    furnitureCoverageIncreaseRatio > 0.015
  ) {
    return false;
  }

  if (normalizedPresetKey === 'floor_tile_stone') {
    return (
      focusRegionChangeRatio >= 0.07 &&
      maskedChangeRatio >= 0.1 &&
      (
        maskedColorShiftRatio >= 0.065 ||
        maskedLuminanceDelta >= 0.015 ||
        maskedEdgeDensityDelta >= 0.01
      ) &&
      maskedLuminanceDelta >= -0.005 &&
      outsideMaskChangeRatio <= 0.12 &&
      topHalfChangeRatio <= 0.07 &&
      furnitureCoverageIncreaseRatio <= 0.006 &&
      newFurnitureAdditionRatio <= 0.01
    );
  }

  if (normalizedPresetKey === 'floor_dark_hardwood') {
    return (
      focusRegionChangeRatio >= 0.1 &&
      maskedChangeRatio >= 0.12 &&
      maskedLuminanceDelta <= -0.03
    );
  }

  return focusRegionChangeRatio >= 0.1 && maskedChangeRatio >= 0.12;
}

export function getPreferredFinishFallbackCandidates(candidates = [], presetKey) {
  const normalizedPresetKey = String(presetKey || '');
  if (
    !normalizedPresetKey.startsWith('paint_') &&
    !normalizedPresetKey.startsWith('floor_')
  ) {
    return [];
  }

  return rankCandidates(
    candidates.filter((candidate) =>
      isPreferredFinishFallbackCandidate(candidate, normalizedPresetKey),
    ),
    normalizedPresetKey,
  );
}

export function rankCandidates(candidates = [], presetKey) {
  return [...candidates].sort((left, right) => {
    if (
      (isConceptStudioPreset(presetKey) || isCleanupEnhancementPreset(presetKey)) &&
      !String(presetKey || '').startsWith('paint_') &&
      !String(presetKey || '').startsWith('floor_')
    ) {
      const leftUtilityScore = calculateConceptUtilityScore(left, presetKey);
      const rightUtilityScore = calculateConceptUtilityScore(right, presetKey);
      if (Math.abs(leftUtilityScore - rightUtilityScore) >= 0.015) {
        return rightUtilityScore - leftUtilityScore;
      }
    }

    const leftTrustScore = calculateRealEstateTrustScore(left, presetKey);
    const rightTrustScore = calculateRealEstateTrustScore(right, presetKey);
    if (Math.abs(leftTrustScore - rightTrustScore) >= 6) {
      return rightTrustScore - leftTrustScore;
    }

    if (presetKey === 'remove_furniture') {
      if (Number(left?.objectRemovalScore || 0) !== Number(right?.objectRemovalScore || 0)) {
        return Number(right?.objectRemovalScore || 0) - Number(left?.objectRemovalScore || 0);
      }
      if (
        Number(left?.remainingFurnitureOverlapRatio || 0) !==
        Number(right?.remainingFurnitureOverlapRatio || 0)
      ) {
        return (
          Number(left?.remainingFurnitureOverlapRatio || 0) -
          Number(right?.remainingFurnitureOverlapRatio || 0)
        );
      }
      if (
        Number(left?.largestComponentPersistenceRatio || 0) !==
        Number(right?.largestComponentPersistenceRatio || 0)
      ) {
        return (
          Number(left?.largestComponentPersistenceRatio || 0) -
          Number(right?.largestComponentPersistenceRatio || 0)
        );
      }
      if (
        Number(left?.newFurnitureAdditionRatio || 0) !==
        Number(right?.newFurnitureAdditionRatio || 0)
      ) {
        return (
          Number(left?.newFurnitureAdditionRatio || 0) -
          Number(right?.newFurnitureAdditionRatio || 0)
        );
      }
      if (Number(left?.maskedChangeRatio || 0) !== Number(right?.maskedChangeRatio || 0)) {
        return Number(right?.maskedChangeRatio || 0) - Number(left?.maskedChangeRatio || 0);
      }
      if (
        Number(left?.maskedEdgeDensityDelta || 0) !==
        Number(right?.maskedEdgeDensityDelta || 0)
      ) {
        return Number(left?.maskedEdgeDensityDelta || 0) - Number(right?.maskedEdgeDensityDelta || 0);
      }
      if (
        Number(left?.focusRegionChangeRatio || 0) !==
        Number(right?.focusRegionChangeRatio || 0)
      ) {
        return Number(right?.focusRegionChangeRatio || 0) - Number(left?.focusRegionChangeRatio || 0);
      }
    }

    if (String(presetKey || '').startsWith('floor_')) {
      if (
        Number(left?.furnitureCoverageIncreaseRatio || 0) !==
        Number(right?.furnitureCoverageIncreaseRatio || 0)
      ) {
        return (
          Number(left?.furnitureCoverageIncreaseRatio || 0) -
          Number(right?.furnitureCoverageIncreaseRatio || 0)
        );
      }
    if (presetKey === 'floor_tile_stone') {
      const leftLikelyNearOriginal =
        Number(left?.maskedChangeRatio || 0) < 0.1 &&
        Number(left?.maskedColorShiftRatio || 0) < 0.07 &&
        Number(left?.maskedEdgeDensityDelta || 0) < 0.005;
      const rightLikelyNearOriginal =
        Number(right?.maskedChangeRatio || 0) < 0.1 &&
        Number(right?.maskedColorShiftRatio || 0) < 0.07 &&
        Number(right?.maskedEdgeDensityDelta || 0) < 0.005;
      if (leftLikelyNearOriginal !== rightLikelyNearOriginal) {
        return leftLikelyNearOriginal ? 1 : -1;
      }

      const leftLikelyDarkWood =
        Number(left?.maskedLuminanceDelta || 0) <= -0.02 &&
        Number(left?.maskedColorShiftRatio || 0) < 0.08 &&
        Number(left?.maskedEdgeDensityDelta || 0) < 0.006;
      const rightLikelyDarkWood =
        Number(right?.maskedLuminanceDelta || 0) <= -0.02 &&
        Number(right?.maskedColorShiftRatio || 0) < 0.08 &&
        Number(right?.maskedEdgeDensityDelta || 0) < 0.006;
      if (leftLikelyDarkWood !== rightLikelyDarkWood) {
        return leftLikelyDarkWood ? 1 : -1;
      }

      const leftStrongTileSignal =
        Number(left?.maskedChangeRatio || 0) >= 0.12 &&
        (
          Number(left?.maskedEdgeDensityDelta || 0) >= 0.006 ||
          Number(left?.maskedColorShiftRatio || 0) >= 0.08
        ) &&
        Number(left?.maskedLuminanceDelta || 0) >= -0.005;
      const rightStrongTileSignal =
        Number(right?.maskedChangeRatio || 0) >= 0.12 &&
        (
          Number(right?.maskedEdgeDensityDelta || 0) >= 0.006 ||
          Number(right?.maskedColorShiftRatio || 0) >= 0.08
        ) &&
        Number(right?.maskedLuminanceDelta || 0) >= -0.005;
      if (leftStrongTileSignal !== rightStrongTileSignal) {
        return leftStrongTileSignal ? -1 : 1;
      }

      const leftPreferredLocal =
        leftStrongTileSignal && left?.providerKey === 'local_sharp';
      const rightPreferredLocal =
        rightStrongTileSignal && right?.providerKey === 'local_sharp';
      if (leftPreferredLocal !== rightPreferredLocal) {
        return leftPreferredLocal ? -1 : 1;
      }

      const leftMaterialSignal = Math.max(
        Number(left?.maskedColorShiftRatio || 0),
        Number(left?.maskedLuminanceDelta || 0),
        Number(left?.maskedEdgeDensityDelta || 0),
      );
      const rightMaterialSignal = Math.max(
        Number(right?.maskedColorShiftRatio || 0),
        Number(right?.maskedLuminanceDelta || 0),
        Number(right?.maskedEdgeDensityDelta || 0),
      );
      if (leftMaterialSignal !== rightMaterialSignal) {
        return rightMaterialSignal - leftMaterialSignal;
      }
      if (
        Number(left?.maskedColorShiftRatio || 0) !== Number(right?.maskedColorShiftRatio || 0)
      ) {
        return (
          Number(right?.maskedColorShiftRatio || 0) -
          Number(left?.maskedColorShiftRatio || 0)
        );
      }
      if (
        Number(left?.maskedLuminanceDelta || 0) !== Number(right?.maskedLuminanceDelta || 0)
      ) {
        return (
          Number(right?.maskedLuminanceDelta || 0) -
          Number(left?.maskedLuminanceDelta || 0)
        );
      }
      if (
        Number(left?.outsideMaskChangeRatio || 0) !== Number(right?.outsideMaskChangeRatio || 0)
      ) {
        return (
          Number(left?.outsideMaskChangeRatio || 0) -
            Number(right?.outsideMaskChangeRatio || 0)
          );
        }
        if (Number(left?.topHalfChangeRatio || 0) !== Number(right?.topHalfChangeRatio || 0)) {
          return Number(left?.topHalfChangeRatio || 0) - Number(right?.topHalfChangeRatio || 0);
        }
      }
      if (presetKey === 'floor_dark_hardwood') {
        if (
          Number(left?.maskedLuminanceDelta || 0) !== Number(right?.maskedLuminanceDelta || 0)
        ) {
          return (
            Number(left?.maskedLuminanceDelta || 0) - Number(right?.maskedLuminanceDelta || 0)
          );
        }
      }
      if (Number(left?.maskedChangeRatio || 0) !== Number(right?.maskedChangeRatio || 0)) {
        return Number(right?.maskedChangeRatio || 0) - Number(left?.maskedChangeRatio || 0);
      }
      if (
        Number(left?.focusRegionChangeRatio || 0) !==
        Number(right?.focusRegionChangeRatio || 0)
      ) {
        return Number(right?.focusRegionChangeRatio || 0) - Number(left?.focusRegionChangeRatio || 0);
      }
      if (
        Number(left?.outsideMaskChangeRatio || 0) !== Number(right?.outsideMaskChangeRatio || 0)
      ) {
        return (
          Number(left?.outsideMaskChangeRatio || 0) -
          Number(right?.outsideMaskChangeRatio || 0)
        );
      }
      if (Number(left?.topHalfChangeRatio || 0) !== Number(right?.topHalfChangeRatio || 0)) {
        return Number(left?.topHalfChangeRatio || 0) - Number(right?.topHalfChangeRatio || 0);
      }
    }

    if (String(presetKey || '').startsWith('paint_')) {
      const leftPerceptibilityScore = calculatePerceptibilityScore(left);
      const rightPerceptibilityScore = calculatePerceptibilityScore(right);
      const leftPaintStrength = evaluatePaintStrength(left, presetKey);
      const rightPaintStrength = evaluatePaintStrength(right, presetKey);
      const leftPaintScore = scorePaintCandidate(
        { ...left, paintStrength: leftPaintStrength },
        presetKey,
      );
      const rightPaintScore = scorePaintCandidate(
        { ...right, paintStrength: rightPaintStrength },
        presetKey,
      );
      if (
        Number(left?.newFurnitureAdditionRatio || 0) !==
        Number(right?.newFurnitureAdditionRatio || 0)
      ) {
        return (
          Number(left?.newFurnitureAdditionRatio || 0) -
          Number(right?.newFurnitureAdditionRatio || 0)
        );
      }
      if (
        Number(left?.furnitureCoverageIncreaseRatio || 0) !==
        Number(right?.furnitureCoverageIncreaseRatio || 0)
      ) {
        return (
          Number(left?.furnitureCoverageIncreaseRatio || 0) -
          Number(right?.furnitureCoverageIncreaseRatio || 0)
        );
      }
      if (Number(left?.topHalfChangeRatio || 0) !== Number(right?.topHalfChangeRatio || 0)) {
        return Number(left?.topHalfChangeRatio || 0) - Number(right?.topHalfChangeRatio || 0);
      }
      const leftHasWallFeatureAddition = Number(left?.maskedEdgeDensityDelta || 0) > 0.003;
      const rightHasWallFeatureAddition = Number(right?.maskedEdgeDensityDelta || 0) > 0.003;
      if (leftHasWallFeatureAddition !== rightHasWallFeatureAddition) {
        return leftHasWallFeatureAddition ? 1 : -1;
      }
      const leftClassificationRank =
        leftPaintScore.classification === 'strong'
          ? 2
          : leftPaintScore.classification === 'weak'
            ? 1
            : 0;
      const rightClassificationRank =
        rightPaintScore.classification === 'strong'
          ? 2
          : rightPaintScore.classification === 'weak'
            ? 1
            : 0;
      if (leftClassificationRank !== rightClassificationRank) {
        return rightClassificationRank - leftClassificationRank;
      }
      if (leftPaintScore.finalScore !== rightPaintScore.finalScore) {
        return rightPaintScore.finalScore - leftPaintScore.finalScore;
      }
      if (
        Number(left?.outsideMaskChangeRatio || 0) !== Number(right?.outsideMaskChangeRatio || 0)
      ) {
        return (
          Number(left?.outsideMaskChangeRatio || 0) -
          Number(right?.outsideMaskChangeRatio || 0)
        );
      }
      if (leftPaintStrength.finalScore !== rightPaintStrength.finalScore) {
        return rightPaintStrength.finalScore - leftPaintStrength.finalScore;
      }
      if (leftPerceptibilityScore !== rightPerceptibilityScore) {
        return rightPerceptibilityScore - leftPerceptibilityScore;
      }
      if (presetKey === 'paint_bright_white') {
        if (
          Number(left?.outsideMaskChangeRatio || 0) !== Number(right?.outsideMaskChangeRatio || 0)
        ) {
          return (
            Number(left?.outsideMaskChangeRatio || 0) -
            Number(right?.outsideMaskChangeRatio || 0)
          );
        }
        if (
          Number(left?.maskedLuminanceDelta || 0) !== Number(right?.maskedLuminanceDelta || 0)
        ) {
          return (
            Number(right?.maskedLuminanceDelta || 0) -
            Number(left?.maskedLuminanceDelta || 0)
          );
        }
      }
      if (
        Number(left?.maskedColorShiftRatio || 0) !== Number(right?.maskedColorShiftRatio || 0)
      ) {
        return (
          Number(right?.maskedColorShiftRatio || 0) -
          Number(left?.maskedColorShiftRatio || 0)
        );
      }
      if (Number(left?.maskedChangeRatio || 0) !== Number(right?.maskedChangeRatio || 0)) {
        return Number(right?.maskedChangeRatio || 0) - Number(left?.maskedChangeRatio || 0);
      }
      if (
        Number(left?.maskedEdgeDensityDelta || 0) !==
        Number(right?.maskedEdgeDensityDelta || 0)
      ) {
        return (
          Number(left?.maskedEdgeDensityDelta || 0) -
          Number(right?.maskedEdgeDensityDelta || 0)
        );
      }
      if (
        Number(left?.outsideMaskChangeRatio || 0) !== Number(right?.outsideMaskChangeRatio || 0)
      ) {
        return (
          Number(left?.outsideMaskChangeRatio || 0) -
          Number(right?.outsideMaskChangeRatio || 0)
        );
      }
    }

    if (Number(left?.overallScore || 0) !== Number(right?.overallScore || 0)) {
      return Number(right?.overallScore || 0) - Number(left?.overallScore || 0);
    }

    return 0;
  });
}

export function classifyQuality(candidate, presetKey = '') {
  if (!candidate) {
    return 'poor';
  }

  const normalizedQualityPresetKey = String(presetKey || '');
  if (!meetsMinimumTrustThreshold(candidate, normalizedQualityPresetKey)) {
    return 'poor';
  }
  const perceptibility = calculatePerceptibilityScore(candidate);
  const outsideMask = Number(candidate.outsideMaskChangeRatio || 0);
  const topHalfChangeRatio = Number(candidate.topHalfChangeRatio || 0);
  const furnitureCoverageIncreaseRatio = Number(candidate.furnitureCoverageIncreaseRatio || 0);
  const newFurnitureAdditionRatio = Number(candidate.newFurnitureAdditionRatio || 0);

  if (normalizedQualityPresetKey.startsWith('paint_')) {
    const paintStrength =
      candidate.paintStrength || evaluatePaintStrength(candidate, normalizedQualityPresetKey);

    if (
      isHighConfidenceEarlyExitCandidate(candidate, normalizedQualityPresetKey) ||
      (
        paintStrength.passes &&
        perceptibility >= 0.35 &&
        outsideMask <= 0.12 &&
        topHalfChangeRatio <= 0.08 &&
        furnitureCoverageIncreaseRatio <= 0.01 &&
        newFurnitureAdditionRatio <= 0.01
      )
    ) {
      return 'high';
    }

    if (
      candidate.isSufficient ||
      (
        paintStrength.finalScore >= 5 &&
        perceptibility >= 0.25 &&
        outsideMask <= 0.2 &&
        topHalfChangeRatio <= 0.16 &&
        furnitureCoverageIncreaseRatio <= 0.01 &&
        newFurnitureAdditionRatio <= 0.01
      )
    ) {
      return 'good';
    }

    if (perceptibility >= 0.15 && paintStrength.finalScore >= 3) {
      return 'concept';
    }

    return 'poor';
  }

  if (normalizedQualityPresetKey.startsWith('floor_')) {
    if (isHighConfidenceEarlyExitCandidate(candidate, normalizedQualityPresetKey)) {
      return 'high';
    }

    if (candidate.isSufficient) {
      return 'good';
    }

    if (
      Number(candidate.focusRegionChangeRatio || 0) >= 0.03 &&
      Number(candidate.maskedChangeRatio || 0) >= 0.04
    ) {
      return 'concept';
    }

    return 'poor';
  }

  if (isHighConfidenceEarlyExitCandidate(candidate, normalizedQualityPresetKey)) {
    return 'high';
  }

  if (candidate.isSufficient) {
    return 'good';
  }

  return Number(candidate.overallScore || 0) >= 5 ? 'concept' : 'poor';
}

export function selectReturnCandidate(candidates = [], presetKey = '') {
  const ranked = rankCandidates(candidates, presetKey);
  const bestCandidate =
    ranked.find((candidate) => meetsMinimumTrustThreshold(candidate, presetKey)) || null;

  return {
    variant: bestCandidate,
    quality: classifyQuality(bestCandidate, presetKey),
    stoppedEarlyReason: bestCandidate
      ? 'ranked_best_candidate'
      : ranked.length
        ? 'minimum_trust_threshold_not_met'
        : 'no_candidates_available',
    deliveryMode: bestCandidate ? 'trustworthy_best_candidate' : 'none',
  };
}
