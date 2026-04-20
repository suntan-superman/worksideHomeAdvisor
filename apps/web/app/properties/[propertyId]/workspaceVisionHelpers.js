export const VISION_WORKFLOW_STAGES = [
  {
    key: 'clean',
    label: '1. First Impression',
    title: 'First Impression',
    description:
      'Run the fast baseline pass first so the photo improves immediately and starts from a stronger, more trustworthy foundation.',
    nextKey: 'finish',
    groups: [
      {
        key: 'first_impression',
        label: 'Fast baseline',
        items: ['enhance_listing_quality'],
      },
    ],
    allowFreeform: false,
  },
  {
    key: 'finish',
    label: '2. Smart Enhancement',
    title: 'Smart Enhancement',
    description:
      'Apply targeted cleanup and selective buyer-friendly improvements before you run the stricter publish-confidence pass.',
    nextKey: 'style',
    groups: [
      {
        key: 'smart_cleanup',
        label: 'High-confidence cleanup',
        items: [
          'declutter_light',
          'declutter_medium',
          'lighting_boost',
          'remove_furniture',
          'cleanup_empty_room',
        ],
      },
      {
        key: 'finish_concepts',
        label: 'Optional concept directions',
        items: [
          'paint_warm_neutral',
          'paint_bright_white',
          'paint_soft_greige',
          'floor_light_wood',
          'floor_medium_wood',
          'floor_dark_hardwood',
          'floor_lvp_neutral',
        ],
      },
      {
        key: 'room_upgrades',
        label: 'Additional room upgrades',
        items: [
          'kitchen_white_cabinets_granite',
          'kitchen_white_cabinets_quartz',
          'kitchen_green_cabinets_granite',
          'kitchen_green_cabinets_quartz',
          'exterior_curb_appeal_refresh',
          'backyard_entertaining_refresh',
          'backyard_pool_preview',
        ],
      },
    ],
    allowFreeform: true,
  },
  {
    key: 'style',
    label: '3. Listing Ready',
    title: 'Listing Ready',
    description:
      'Run the strict publish-confidence pass. Save the winner if it reads clean and trustworthy, or step back to Smart Enhancement if it still needs work.',
    nextKey: 'final',
    groups: [
      {
        key: 'listing_ready',
        label: 'Final publish pass',
        items: ['combined_listing_refresh'],
      },
    ],
    allowFreeform: false,
  },
  {
    key: 'final',
    label: '4. Finalize',
    title: 'Finalize',
    description: 'Keep the winner, set brochure/report usage, and delete earlier drafts when ready.',
    nextKey: 'final',
    groups: [],
    allowFreeform: false,
  },
];

export const PHOTO_LIBRARY_CATEGORY_DEFINITIONS = [
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'living_room', label: 'Living Room' },
  { key: 'master_bedroom', label: 'Master Bedroom' },
  { key: 'master_bathroom', label: 'Master Bathroom' },
  { key: 'other', label: 'Other' },
  { key: 'exterior', label: 'Exterior' },
];

export function getVisionWorkflowStage(stageKey) {
  return (
    VISION_WORKFLOW_STAGES.find((stage) => stage.key === stageKey) || VISION_WORKFLOW_STAGES[0]
  );
}

export function getVisionWorkflowStageForPreset(presetKey) {
  const normalizedPresetKey = String(presetKey || '').trim();
  if (!normalizedPresetKey) {
    return 'clean';
  }

  const matchingStage = VISION_WORKFLOW_STAGES.find((stage) =>
    stage.groups.some((group) => group.items.includes(normalizedPresetKey)),
  );

  return matchingStage?.key || 'style';
}

export function getDefaultVisionPresetKeyForStage(stageKey) {
  const stage = getVisionWorkflowStage(stageKey);
  return stage.groups.flatMap((group) => group.items)[0] || 'enhance_listing_quality';
}

export function getNextVisionWorkflowStageKey(stageKey) {
  return getVisionWorkflowStage(stageKey).nextKey || 'final';
}

export function getVisionRecommendationLabel(presetKey, presets = []) {
  const preset = presets.find((item) => item.key === presetKey);
  if (preset?.displayName) {
    return preset.displayName;
  }

  if (presetKey === 'enhance_listing_quality') {
    return 'First Impression';
  }
  if (presetKey === 'combined_listing_refresh') {
    return 'Listing Ready';
  }
  if (presetKey === 'declutter_medium') {
    return 'Smart Declutter+';
  }
  if (presetKey === 'declutter_light') {
    return 'Smart Declutter';
  }
  if (presetKey === 'lighting_boost') {
    return 'Lighting Recovery';
  }

  return 'Vision enhancement';
}

export function buildVisionWorkflowRecommendation(asset, selectedVariant = null, presets = []) {
  const metadata = selectedVariant?.metadata || asset?.selectedVariant?.metadata || {};
  const recommendedNextStep =
    metadata?.recommendedNextStep && typeof metadata.recommendedNextStep === 'object'
      ? metadata.recommendedNextStep
      : null;
  const requestedPresetKey =
    metadata?.requestedPresetKey || metadata?.presetKey || selectedVariant?.variantType || '';
  const pipelineStage = String(metadata?.pipelineStage || '');
  const smartPlan = Array.isArray(metadata?.smartEnhancementPlan)
    ? metadata.smartEnhancementPlan
    : [];
  const sceneAnalysis = metadata?.sceneAnalysis || {};
  const clutterLevel = Number(
    sceneAnalysis?.clutterLevel || sceneAnalysis?.clutterScore || asset?.analysis?.clutterScore || 0,
  );
  const rawLightingQuality = Number(
    sceneAnalysis?.lightingQuality ?? asset?.analysis?.lightingScore ?? 0,
  );
  const lightingQuality = rawLightingQuality > 1 ? rawLightingQuality / 100 : rawLightingQuality;
  const listingReadyLabel = String(metadata?.listingReadyLabel || '');
  const fallbackApplied = Boolean(metadata?.fallbackApplied);
  const summary = String(asset?.analysis?.summary || '').toLowerCase();
  const hasDeclutterSignal =
    smartPlan.includes('declutter') ||
    asset?.analysis?.retakeRecommended ||
    clutterLevel > 0.5 ||
    /clutter|declutter|distraction|tidy|retake|busy|remove/i.test(summary);
  const needsLightingRecovery =
    smartPlan.includes('lighting_boost') || (lightingQuality > 0 && lightingQuality < 0.6);
  const declutterPresetKey = clutterLevel >= 0.68 ? 'declutter_medium' : 'declutter_light';

  if (recommendedNextStep?.type === 'save_result') {
    return {
      type: 'save_result',
      label: recommendedNextStep.label || 'Save this result',
      reason:
        recommendedNextStep.reason ||
        'This preview is already reading as listing-ready, so the next move is to keep it and use it in Photos, brochure, or report output.',
    };
  }

  if (recommendedNextStep?.presetKey) {
    return {
      type: 'generate',
      presetKey: recommendedNextStep.presetKey,
      label:
        recommendedNextStep.label ||
        getVisionRecommendationLabel(recommendedNextStep.presetKey, presets),
      reason: recommendedNextStep.reason || 'This is the strongest next step based on the current result.',
    };
  }

  if (listingReadyLabel === 'Listing Ready') {
    return {
      type: 'save_result',
      label: 'Save this result',
      reason:
        'This preview is already reading as listing-ready, so the next move is to keep it and use it in Photos, brochure, or report output.',
    };
  }

  if (!selectedVariant && !asset?.selectedVariant) {
    return {
      type: 'generate',
      presetKey: 'enhance_listing_quality',
      label: getVisionRecommendationLabel('enhance_listing_quality', presets),
      reason:
        'Start with the fast first-impression pass so the room gets a reliable visual improvement before heavier cleanup or listing polish.',
    };
  }

  if (requestedPresetKey === 'combined_listing_refresh' && fallbackApplied && hasDeclutterSignal) {
    return {
      type: 'generate',
      presetKey: declutterPresetKey,
      label: getVisionRecommendationLabel(declutterPresetKey, presets),
      reason:
        'The listing-ready pass fell back safely, which usually means the room still needs a stronger cleanup step before final polish.',
    };
  }

  if (pipelineStage === 'first_impression' && hasDeclutterSignal) {
    return {
      type: 'generate',
      presetKey: declutterPresetKey,
      label: getVisionRecommendationLabel(declutterPresetKey, presets),
      reason:
        'The first-impression pass is in place. Cleaning visual distractions next should create a stronger base for listing-ready polish.',
    };
  }

  if (
    (pipelineStage === 'first_impression' || requestedPresetKey === 'combined_listing_refresh') &&
    needsLightingRecovery &&
    !hasDeclutterSignal
  ) {
    return {
      type: 'generate',
      presetKey: 'lighting_boost',
      label: getVisionRecommendationLabel('lighting_boost', presets),
      reason:
        requestedPresetKey === 'combined_listing_refresh' && fallbackApplied
          ? 'The listing-ready pass backed off safely, which usually means the room needs a stronger lighting baseline before final polish.'
          : 'The first-impression baseline is in place. A lighting recovery pass should improve brightness before the stricter listing-ready step.',
    };
  }

  if (pipelineStage === 'first_impression' || pipelineStage === 'smart_enhancement') {
    return {
      type: 'generate',
      presetKey: 'combined_listing_refresh',
      label: getVisionRecommendationLabel('combined_listing_refresh', presets),
      reason:
        'The room now has a stable enough baseline for the stricter listing-ready pass that favors realism and publish confidence.',
    };
  }

  if (requestedPresetKey === 'combined_listing_refresh' && listingReadyLabel !== 'Listing Ready') {
    return {
      type: 'generate',
      presetKey: hasDeclutterSignal
        ? declutterPresetKey
        : needsLightingRecovery
          ? 'lighting_boost'
          : 'combined_listing_refresh',
      label: getVisionRecommendationLabel(
        hasDeclutterSignal
          ? declutterPresetKey
          : needsLightingRecovery
            ? 'lighting_boost'
            : 'combined_listing_refresh',
        presets,
      ),
      reason: hasDeclutterSignal
        ? 'The result is safer than final. A cleanup step should improve the next listing-ready attempt.'
        : needsLightingRecovery
          ? 'The result is safer than final. A lighting recovery step should improve the next listing-ready attempt.'
          : 'The room is close, but another listing-ready attempt may still produce a cleaner publishable result.',
    };
  }

  return {
    type: 'generate',
    presetKey: 'enhance_listing_quality',
    label: getVisionRecommendationLabel('enhance_listing_quality', presets),
    reason:
      'Use the fast enhancement pass to re-establish a strong first impression before trying another advanced transformation.',
  };
}

export function getPreferredVariantLabel(item) {
  return item?.variantLabel || 'Preferred vision variant';
}

export function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This variant can be reviewed, marked preferred, and optionally used in brochure or report outputs.'
  );
}

export function getVariantDisclaimer(variant) {
  if (variant?.metadata?.disclaimerType === 'concept_preview') {
    return 'AI visualizations are conceptual previews only. Actual condition, remodel results, and value impact may vary.';
  }

  return 'Enhanced images should stay truthful to the room and be reviewed before use in final marketing materials.';
}

export function getVariantReviewScore(variant) {
  return Number(variant?.metadata?.review?.overallScore || 0);
}

export function getAssetGenerationStageKey(asset) {
  const normalized = String(asset?.generationStage || '').trim().toLowerCase();
  if (normalized === 'clean_room') {
    return 'clean';
  }
  if (normalized === 'finishes' || normalized === 'finish') {
    return 'finish';
  }
  if (normalized === 'style') {
    return 'style';
  }
  return '';
}

export function getVariantCreatedAtTimestamp(variant) {
  const timestamp = new Date(
    variant?.updatedAt || variant?.createdAt || variant?.selectedAt || 0,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getVisionWorkflowStageKeyForVariant(variant) {
  return (
    variant?.metadata?.workflowStageKey ||
    getVisionWorkflowStageForPreset(variant?.metadata?.presetKey || variant?.variantType)
  );
}

export function getNewestVisionVariants(variants = []) {
  return [...variants].sort(
    (left, right) => getVariantCreatedAtTimestamp(right) - getVariantCreatedAtTimestamp(left),
  );
}

export function pickVisionWorkspaceVariantId(
  variants = [],
  { currentVariantId = '', stageKey = 'clean', sourceVariantId = '' } = {},
) {
  if (!variants.length) {
    return '';
  }

  if (currentVariantId && variants.some((variant) => variant.id === currentVariantId)) {
    return currentVariantId;
  }

  const nonHiddenVariants = variants.filter(
    (variant) => !variant?.metadata?.review?.shouldHideByDefault,
  );
  const candidatePool = nonHiddenVariants.length ? nonHiddenVariants : variants;
  const newestCandidates = getNewestVisionVariants(candidatePool);
  const normalizedStageKey = String(stageKey || 'clean').trim() || 'clean';
  const normalizedSourceVariantId = String(sourceVariantId || '').trim();

  if (normalizedSourceVariantId) {
    const sourceDescendants = newestCandidates.filter(
      (variant) => String(variant?.metadata?.sourceVariantId || '') === normalizedSourceVariantId,
    );
    const sameStageSourceDescendants = sourceDescendants.filter(
      (variant) => getVisionWorkflowStageKeyForVariant(variant) === normalizedStageKey,
    );
    if (sameStageSourceDescendants[0]?.id) {
      return sameStageSourceDescendants[0].id;
    }
    if (sourceDescendants[0]?.id) {
      return sourceDescendants[0].id;
    }
    const exactSourceVariant = newestCandidates.find(
      (variant) => variant.id === normalizedSourceVariantId,
    );
    if (exactSourceVariant?.id) {
      return exactSourceVariant.id;
    }
  }

  const sameStageVariants = newestCandidates.filter(
    (variant) => getVisionWorkflowStageKeyForVariant(variant) === normalizedStageKey,
  );
  if (sameStageVariants[0]?.id) {
    return sameStageVariants[0].id;
  }

  return newestCandidates[0]?.id || variants[0]?.id || '';
}

export function getVisionSaveDefaults(variant, activeStageKey = 'style') {
  const metadata = variant?.metadata || {};
  const pipelineDescriptor =
    metadata?.pipelineDescriptor && typeof metadata.pipelineDescriptor === 'object'
      ? metadata.pipelineDescriptor
      : null;
  const pipelineStage = String(
    pipelineDescriptor?.stageKey || metadata?.pipelineStage || '',
  ).trim();
  const workflowStageKey = String(metadata?.workflowStageKey || activeStageKey || '').trim();
  const generationStage =
    workflowStageKey === 'clean'
      ? 'clean_room'
      : workflowStageKey === 'finish'
        ? 'finishes'
        : workflowStageKey === 'style'
          ? 'finishes'
          : pipelineStage === 'listing_ready'
            ? 'finishes'
            : pipelineStage === 'first_impression'
              ? 'clean_room'
              : pipelineStage === 'smart_enhancement' &&
                  variant?.variantCategory !== 'concept_preview'
                ? 'finishes'
                : 'style';

  return {
    generationStage,
    listingCandidate: Boolean(
      metadata?.publishable || pipelineDescriptor?.publishable,
    ),
    qualityLabel:
      metadata?.qualityLabel ||
      pipelineDescriptor?.statusLabel ||
      metadata?.confidenceBadge ||
      metadata?.listingReadyLabel ||
      '',
    publishable: Boolean(metadata?.publishable || pipelineDescriptor?.publishable),
  };
}

export function getVisionPipelinePackageSummary(variant, saveDefaults = null) {
  if (!variant) {
    return null;
  }

  const metadata = variant?.metadata || {};
  const pipelineDescriptor =
    metadata?.pipelineDescriptor && typeof metadata.pipelineDescriptor === 'object'
      ? metadata.pipelineDescriptor
      : null;
  const stageLabel =
    pipelineDescriptor?.stageLabel || metadata?.pipelineStageLabel || 'Vision result';
  const statusLabel =
    saveDefaults?.qualityLabel ||
    pipelineDescriptor?.statusLabel ||
    metadata?.confidenceBadge ||
    metadata?.listingReadyLabel ||
    'Review pending';
  const publishable = Boolean(
    saveDefaults?.publishable || metadata?.publishable || pipelineDescriptor?.publishable,
  );
  const reviewMessage =
    pipelineDescriptor?.reviewMessage || metadata?.warning || getVariantSummary(variant);

  let deliveryMessage =
    'Review this result before using it in final marketing materials.';
  if (pipelineDescriptor?.stageKey === 'first_impression') {
    deliveryMessage =
      'This is your fast baseline improvement. Use Smart Enhancement next for clutter, lighting, or selective cleanup.';
  } else if (pipelineDescriptor?.stageKey === 'smart_enhancement') {
    deliveryMessage =
      'This result is ready for the stricter Listing Ready pass once the room feels clean and believable.';
  } else if (publishable) {
    deliveryMessage =
      'This result is strong enough to save as a listing photo and use in brochure and report workflows.';
  } else if (pipelineDescriptor?.stageKey === 'listing_ready') {
    deliveryMessage =
      'Treat this as a reviewed draft unless you want to step back into Smart Enhancement for another pass.';
  }

  return {
    stageLabel,
    statusLabel,
    reviewMessage,
    deliveryMessage,
    publishable,
  };
}

export function getMediaAssetCreatedAtTimestamp(asset) {
  const timestamp = new Date(asset?.updatedAt || asset?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getDefaultVisionStageForAsset(asset) {
  if (asset?.assetType !== 'generated') {
    return 'clean';
  }

  const sourceStageKey = getAssetGenerationStageKey(asset);
  if (!sourceStageKey) {
    return 'clean';
  }

  return getNextVisionWorkflowStageKey(sourceStageKey);
}

export function getMediaAssetPrimaryLabel(asset) {
  if (asset?.assetType === 'generated') {
    if (asset?.generationStage === 'clean_room') {
      return 'AI Cleaned';
    }
    if (asset?.generationStage === 'finishes') {
      return 'AI Finish Update';
    }
    if (asset?.generationStage === 'style') {
      return 'AI Styled';
    }
    return 'AI Generated';
  }

  return 'Original';
}

export function getMediaAssetBadges(asset) {
  const badges = [getMediaAssetPrimaryLabel(asset)];
  if (asset?.savedFromVision) {
    badges.push('Saved from Vision');
  }
  if (asset?.listingCandidate) {
    badges.push('Seller Pick');
  }
  return badges;
}

export function getMediaAssetSummary(asset) {
  if (asset?.assetType === 'generated') {
    const stageLabel =
      asset?.generationStage === 'clean_room'
        ? 'room cleanup'
        : asset?.generationStage === 'finishes'
          ? 'finish update'
          : asset?.generationStage === 'style'
            ? 'style concept'
            : 'Vision edit';
    return asset?.generationLabel
      ? `${asset.generationLabel}. Saved from Vision for ${stageLabel} review.`
      : `Saved from Vision for ${stageLabel} review.`;
  }

  return asset?.analysis?.summary || 'Original photo saved to the shared property gallery.';
}

export function groupMediaAssetsByRoom(assets = []) {
  const roomMap = new Map();
  for (const asset of assets) {
    const roomKey = String(asset?.roomLabel || 'Unlabeled room').trim() || 'Unlabeled room';
    if (!roomMap.has(roomKey)) {
      roomMap.set(roomKey, []);
    }
    roomMap.get(roomKey).push(asset);
  }

  return [...roomMap.entries()]
    .map(([roomLabel, roomAssets]) => ({
      roomLabel,
      assets: [...roomAssets].sort((left, right) => {
        if ((left?.assetType || 'original') !== (right?.assetType || 'original')) {
          return left?.assetType === 'original' ? -1 : 1;
        }
        return getMediaAssetCreatedAtTimestamp(right) - getMediaAssetCreatedAtTimestamp(left);
      }),
    }))
    .sort((left, right) => left.roomLabel.localeCompare(right.roomLabel));
}

export function resolvePhotoLibraryCategoryKey(roomLabel = '') {
  const normalizedLabel = String(roomLabel || '').trim().toLowerCase();
  if (!normalizedLabel) {
    return 'other';
  }

  if (
    normalizedLabel.includes('living') ||
    normalizedLabel.includes('family') ||
    normalizedLabel.includes('great room') ||
    normalizedLabel.includes('den')
  ) {
    return 'living_room';
  }
  if (normalizedLabel.includes('kitchen') || normalizedLabel.includes('pantry')) {
    return 'kitchen';
  }
  if (
    normalizedLabel.includes('primary bedroom') ||
    normalizedLabel.includes('master bedroom') ||
    normalizedLabel.includes('owner bedroom')
  ) {
    return 'master_bedroom';
  }
  if (normalizedLabel.includes('bath')) {
    return 'master_bathroom';
  }
  if (
    normalizedLabel.includes('exterior') ||
    normalizedLabel.includes('yard') ||
    normalizedLabel.includes('patio') ||
    normalizedLabel.includes('backyard') ||
    normalizedLabel.includes('front yard') ||
    normalizedLabel.includes('curb')
  ) {
    return 'exterior';
  }

  return 'other';
}

export function buildPhotoCategoryGroups(assets = []) {
  const categoryMap = new Map(
    PHOTO_LIBRARY_CATEGORY_DEFINITIONS.map((definition) => [definition.key, []]),
  );

  for (const asset of assets) {
    const categoryKey = resolvePhotoLibraryCategoryKey(asset?.roomLabel);
    categoryMap.get(categoryKey)?.push(asset);
  }

  return PHOTO_LIBRARY_CATEGORY_DEFINITIONS.map((definition) => ({
    ...definition,
    assets: [...(categoryMap.get(definition.key) || [])].sort(
      (left, right) => getMediaAssetCreatedAtTimestamp(right) - getMediaAssetCreatedAtTimestamp(left),
    ),
  }));
}

export function formatFreeformPlanHighlights(normalizedPlan) {
  if (!normalizedPlan) {
    return [];
  }

  const highlights = [];

  if (normalizedPlan.removeObjects?.includes('furniture')) {
    highlights.push('Furniture removal requested');
  }
  if (normalizedPlan.removeObjects?.includes('clutter')) {
    highlights.push('Declutter requested');
  }
  if (normalizedPlan.flooring) {
    highlights.push(`Flooring: ${normalizedPlan.flooring}`);
  }
  if (normalizedPlan.wallColor) {
    highlights.push(`Wall color: ${normalizedPlan.wallColor}`);
  }
  if (normalizedPlan.cabinetColor) {
    highlights.push(`Cabinet color: ${normalizedPlan.cabinetColor}`);
  }
  if (normalizedPlan.countertopMaterial) {
    highlights.push(`Countertops: ${normalizedPlan.countertopMaterial}`);
  }
  if ((normalizedPlan.exteriorFeatures || []).length) {
    highlights.push(`Exterior: ${(normalizedPlan.exteriorFeatures || []).join(', ')}`);
  }
  if (normalizedPlan.lighting) {
    highlights.push(`${normalizedPlan.lighting === 'brighter' ? 'Brighter' : normalizedPlan.lighting} lighting`);
  }

  return highlights;
}
