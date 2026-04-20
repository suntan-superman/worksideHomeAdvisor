export const ROOM_LABEL_OPTIONS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];

export function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Signed-in user';
}

export function truncateMiddle(value, maxLength = 28) {
  if (!value || value.length <= maxLength) {
    return value || '';
  }

  const keep = Math.max(8, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatCreatedAt(value) {
  if (!value) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

export function formatChecklistStatus(status) {
  if (status === 'done') {
    return 'Done';
  }

  if (status === 'in_progress') {
    return 'In progress';
  }

  return 'Open';
}

export function formatPhoneInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);

  if (!digits) {
    return '';
  }

  if (digits.length < 4) {
    return `(${digits}`;
  }

  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This variant can be marked preferred for flyer and report selection.'
  );
}

export function formatWorkflowStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }
  if (status === 'complete') {
    return 'Complete';
  }
  if (status === 'blocked') {
    return 'Blocked';
  }
  if (status === 'locked') {
    return 'Locked';
  }
  return 'Available';
}

export function getVisionJobLabel(jobType) {
  if (jobType === 'declutter_preview' || jobType === 'declutter_light' || jobType === 'declutter_medium') {
    return 'Running smart declutter';
  }
  if (jobType === 'lighting_boost') {
    return 'Running lighting recovery';
  }
  if (jobType === 'combined_listing_refresh') {
    return 'Running listing-ready pass';
  }
  if (jobType === 'enhance_listing_quality') {
    return 'Running first-impression pass';
  }

  return 'Enhancing photo';
}

export function getNextChecklistStatus(currentStatus) {
  if (currentStatus === 'todo') {
    return 'in_progress';
  }

  if (currentStatus === 'in_progress') {
    return 'done';
  }

  return 'todo';
}

export function summarizePricing(pricingSummary) {
  if (!pricingSummary) {
    return [];
  }

  return String(pricingSummary)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function getVisionActionLabel(jobType) {
  if (jobType === 'enhance_listing_quality') {
    return 'First Impression';
  }
  if (jobType === 'combined_listing_refresh') {
    return 'Listing Ready';
  }
  if (jobType === 'declutter_medium') {
    return 'Smart Declutter+';
  }
  if (jobType === 'declutter_light' || jobType === 'declutter_preview') {
    return 'Smart Declutter';
  }
  if (jobType === 'lighting_boost') {
    return 'Lighting';
  }

  return 'Enhance';
}

export function getVisionActionRecommendation(asset, selectedVariant = null) {
  const metadata = selectedVariant?.metadata || asset?.selectedVariant?.metadata || {};
  const recommendedNextStep =
    metadata?.recommendedNextStep && typeof metadata.recommendedNextStep === 'object'
      ? metadata.recommendedNextStep
      : null;
  const requestedPresetKey = metadata?.requestedPresetKey || '';
  const executionPresetKey = metadata?.executionPresetKey || metadata?.presetKey || '';
  const pipelineStage = metadata?.pipelineStage || '';
  const smartPlan = metadata?.smartEnhancementPlan || [];
  const sceneAnalysis = metadata?.sceneAnalysis || {};
  const clutterLevel = Number(
    sceneAnalysis?.clutterLevel || sceneAnalysis?.clutterScore || asset?.analysis?.clutterScore || 0,
  );
  const rawLightingQuality = Number(
    sceneAnalysis?.lightingQuality ?? asset?.analysis?.lightingScore ?? 0,
  );
  const lightingQuality =
    rawLightingQuality > 1 ? rawLightingQuality / 100 : rawLightingQuality;
  const listingReadyLabel = metadata?.listingReadyLabel || '';
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
      presetKey: '',
      label: recommendedNextStep.label || 'Save this result',
      reason:
        recommendedNextStep.reason || 'This preview is already reading as listing-ready.',
    };
  }

  if (recommendedNextStep?.presetKey) {
    return {
      presetKey: recommendedNextStep.presetKey,
      label:
        recommendedNextStep.label || getVisionActionLabel(recommendedNextStep.presetKey),
      reason:
        recommendedNextStep.reason ||
        'This is the strongest next step based on the current result.',
    };
  }

  if (listingReadyLabel === 'Listing Ready') {
    return {
      presetKey: '',
      label: 'Save this result',
      reason: 'This preview is already reading as listing-ready.',
    };
  }

  if (!selectedVariant && !asset?.selectedVariant) {
    return {
      presetKey: 'enhance_listing_quality',
      label: getVisionActionLabel('enhance_listing_quality'),
      reason: 'Start with the fast first-impression pass before heavier cleanup or listing polish.',
    };
  }

  if (hasDeclutterSignal) {
    return {
      presetKey: declutterPresetKey,
      label: getVisionActionLabel(declutterPresetKey),
      reason:
        requestedPresetKey === 'combined_listing_refresh' && fallbackApplied
          ? 'The listing-ready pass fell back safely, so the room likely needs a stronger cleanup step first.'
          : 'Cleaning distractions next should create a stronger base for listing-ready polish.',
    };
  }

  if (needsLightingRecovery && executionPresetKey !== 'lighting_boost') {
    return {
      presetKey: 'lighting_boost',
      label: getVisionActionLabel('lighting_boost'),
      reason:
        requestedPresetKey === 'combined_listing_refresh' && fallbackApplied
          ? 'The listing-ready pass backed off safely, so the room likely needs a brighter lighting baseline first.'
          : 'Recovering the lighting first should create a cleaner, more trustworthy base for the final listing-ready pass.',
    };
  }

  if (
    requestedPresetKey === 'combined_listing_refresh' &&
    (
      executionPresetKey === 'declutter_light' ||
      executionPresetKey === 'declutter_medium' ||
      executionPresetKey === 'lighting_boost'
    )
  ) {
    return {
      presetKey: 'combined_listing_refresh',
      label: getVisionActionLabel('combined_listing_refresh'),
      reason: 'The cleanup path has run, so the next step is the stricter listing-ready pass.',
    };
  }

  if (pipelineStage === 'first_impression' || pipelineStage === 'smart_enhancement') {
    return {
      presetKey: 'combined_listing_refresh',
      label: getVisionActionLabel('combined_listing_refresh'),
      reason: 'The room now has a stable enough baseline for the listing-ready pass.',
    };
  }

  return {
    presetKey: 'enhance_listing_quality',
    label: getVisionActionLabel('enhance_listing_quality'),
    reason: 'Use the fast enhancement pass to re-establish a strong first impression first.',
  };
}

export function getVisionSaveDefaults(variant) {
  const metadata = variant?.metadata || {};
  const pipelineDescriptor =
    metadata?.pipelineDescriptor && typeof metadata.pipelineDescriptor === 'object'
      ? metadata.pipelineDescriptor
      : null;
  const pipelineStage = String(
    pipelineDescriptor?.stageKey || metadata?.pipelineStage || '',
  ).trim();
  const workflowStageKey = String(metadata?.workflowStageKey || '').trim();
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
    publishable: Boolean(
      metadata?.publishable || pipelineDescriptor?.publishable,
    ),
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
      'This is your fast baseline improvement. Use Smart Enhancement next for clutter, lighting, or targeted cleanup.';
  } else if (pipelineDescriptor?.stageKey === 'smart_enhancement') {
    deliveryMessage =
      'This result is ready for the stricter Listing Ready pass once the room feels clean and believable.';
  } else if (publishable) {
    deliveryMessage =
      'This result is strong enough to keep as a listing candidate and use in final materials.';
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

export function getVisionWorkflowStageKeyForJobType(jobType = '', mode = 'preset') {
  if (mode === 'freeform') {
    return 'finish';
  }

  const normalizedJobType = String(jobType || '').trim();
  if (!normalizedJobType || normalizedJobType === 'enhance_listing_quality') {
    return 'clean';
  }

  if (normalizedJobType === 'combined_listing_refresh') {
    return 'style';
  }

  return 'finish';
}

export function getRecommendedSection(nextStepKey) {
  switch (nextStepKey) {
    case 'capture_photos':
    case 'capture_core_listing_rooms':
      return 'capture';
    case 'review_listing_photos':
    case 'choose_listing_candidate_photos':
      return 'gallery';
    case 'improve_listing_photos':
    case 'select_preferred_vision_variant':
      return 'vision';
    case 'complete_checklist':
    case 'prepare_home':
    case 'provider_help':
      return 'tasks';
    case 'review_pricing':
    default:
      return 'overview';
  }
}
