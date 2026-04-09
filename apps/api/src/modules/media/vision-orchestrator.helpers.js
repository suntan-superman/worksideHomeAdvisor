const STANDARD_ONLY_PRESET_KEYS = new Set([
  'enhance_listing_quality',
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
const REMOVE_FURNITURE_MAX_EXECUTION_TIME_MS = 150_000;

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

export function buildProviderChain({ preset, userPlan, openAiAvailable = false } = {}) {
  const key = String(preset?.key || '');

  if (preset?.providerPreference === 'local_sharp') {
    return ['local_sharp'];
  }

  if (STANDARD_ONLY_PRESET_KEYS.has(key)) {
    return ['replicate_basic'];
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

  if (providerKey === 'replicate_advanced') {
    const strongerRemovalPreset = new Set(['remove_furniture', 'declutter_medium']);
    const advancedStrength = strongerRemovalPreset.has(preset.key)
      ? Math.min(0.98, baseStrength + 0.05)
      : Math.max(0.2, Math.min(0.9, baseStrength - 0.06));

    if (isRemoveFurniture) {
      return {
        model: preset.replicateModel,
        outputCount: Math.min(2, Math.max(1, baseOutputCount)),
        guidanceScale: Math.min(10, Number((baseGuidanceScale + 0.35).toFixed(2))),
        numInferenceSteps: baseInferenceSteps + 4,
        strength: Number(Math.min(0.98, baseStrength + 0.03).toFixed(2)),
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
    outputCount: isRemoveFurniture ? Math.min(2, Math.max(1, baseOutputCount)) : baseOutputCount,
    guidanceScale: baseGuidanceScale,
    numInferenceSteps: baseInferenceSteps,
    strength: baseStrength,
    scheduler: preset.scheduler,
    negativePrompt: preset.negativePrompt,
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

export function getVisionExecutionTimeBudgetMs(presetKey) {
  if (presetKey === 'remove_furniture') {
    return REMOVE_FURNITURE_MAX_EXECUTION_TIME_MS;
  }

  return 120_000;
}

export function isHighConfidenceEarlyExitCandidate(candidate, presetKey) {
  if (!candidate) {
    return false;
  }

  if (presetKey !== 'remove_furniture') {
    return true;
  }

  const totalMajorComponentCount = Number(candidate.totalMajorComponentCount || 0);
  const clearedMajorComponentCount = Number(candidate.clearedMajorComponentCount || 0);
  const clearanceRatio =
    totalMajorComponentCount > 0 ? clearedMajorComponentCount / totalMajorComponentCount : 1;

  return (
    Number(candidate.objectRemovalScore || 0) >= 0.3 &&
    Number(candidate.focusRegionChangeRatio || 0) >= 0.18 &&
    Number(candidate.maskedChangeRatio || 0) >= 0.26 &&
    Number(candidate.topHalfChangeRatio || 1) <= 0.14 &&
    Number(candidate.outsideMaskChangeRatio || 1) <= 0.24 &&
    Number(candidate.remainingFurnitureOverlapRatio ?? 1) <= 0.14 &&
    Number(candidate.largestComponentPersistenceRatio ?? 1) <= 0.24 &&
    Number(candidate.newFurnitureAdditionRatio ?? 1) <= 0.05 &&
    clearanceRatio >= 0.6
  );
}

export function isCandidateSufficient(candidate, presetKey) {
  if (!candidate) {
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

  if (String(presetKey || '').startsWith('floor_')) {
    return Number(candidate.focusRegionChangeRatio || 0) >= 0.08;
  }

  if (String(presetKey || '').startsWith('paint_')) {
    return Number(candidate.visualChangeRatio || 0) >= 0.06;
  }

  return Number(candidate.overallScore || 0) >= 62;
}

export function rankCandidates(candidates = [], presetKey) {
  return [...candidates].sort((left, right) => {
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

    if (Number(left?.overallScore || 0) !== Number(right?.overallScore || 0)) {
      return Number(right?.overallScore || 0) - Number(left?.overallScore || 0);
    }

    return 0;
  });
}
