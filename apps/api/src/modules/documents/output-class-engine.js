export const SELLER_REPORT_CLASS = Object.freeze({
  PREP: 'prep_report',
  BALANCED: 'balanced_report',
  LAUNCH: 'launch_report',
});

export const FLYER_CLASS = Object.freeze({
  PREVIEW: 'preview_flyer',
  PRELAUNCH: 'prelaunch_flyer',
  MARKETING: 'marketing_flyer',
});

const SELLER_TONE_PROFILES = Object.freeze({
  [SELLER_REPORT_CLASS.PREP]: Object.freeze({
    key: 'prep_operational',
    summaryIntro: 'prep-focused seller summary of strongest blockers, risks, and next actions.',
    readinessIntro: 'preparation dashboard prioritizing blockers, risk reduction, and launch sequencing.',
    styleNotes: ['practical', 'honest', 'preparation-first'],
  }),
  [SELLER_REPORT_CLASS.BALANCED]: Object.freeze({
    key: 'balanced_guidance',
    summaryIntro: 'balanced seller summary of strongest signals, risks, and launch opportunities.',
    readinessIntro: 'structured prep dashboard showing score, risk, opportunity, and top actions.',
    styleNotes: ['balanced', 'actionable', 'opportunity-aware'],
  }),
  [SELLER_REPORT_CLASS.LAUNCH]: Object.freeze({
    key: 'launch_confident',
    summaryIntro: 'launch-facing summary of strongest signals, market positioning, and final execution checks.',
    readinessIntro: 'concise dashboard of launch confidence, residual risks, and final execution checks.',
    styleNotes: ['confident', 'reassuring', 'market-facing'],
  }),
});

const FLYER_TONE_PROFILES = Object.freeze({
  [FLYER_CLASS.PREVIEW]: Object.freeze({
    key: 'preview_teaser',
    modeSignal: 'Preview mode: positioning this property as an early opportunity while final prep is completed.',
    ctaHeading: 'Preparation and inquiry',
    styleNotes: ['honest', 'teaser', 'minimal-claim'],
  }),
  [FLYER_CLASS.PRELAUNCH]: Object.freeze({
    key: 'prelaunch_persuasive',
    modeSignal: 'Pre-launch mode: visual story is strong, with final positioning polish before full launch.',
    ctaHeading: 'Buyer inquiry and showing readiness',
    styleNotes: ['limited but persuasive', 'feature-forward'],
  }),
  [FLYER_CLASS.MARKETING]: Object.freeze({
    key: 'marketing_sales_forward',
    modeSignal: 'Marketing mode: polished presentation designed to convert high-intent buyer interest.',
    ctaHeading: 'Request showing',
    styleNotes: ['sales-forward', 'listing-grade', 'visual-first'],
  }),
});

const ACTION_PLAN_DEPTH_BY_CLASS = Object.freeze({
  [SELLER_REPORT_CLASS.PREP]: Object.freeze({
    topActionLimit: 4,
    actionCardLimit: 3,
    includeSupportPages: true,
  }),
  [SELLER_REPORT_CLASS.BALANCED]: Object.freeze({
    topActionLimit: 3,
    actionCardLimit: 2,
    includeSupportPages: true,
  }),
  [SELLER_REPORT_CLASS.LAUNCH]: Object.freeze({
    topActionLimit: 2,
    actionCardLimit: 1,
    includeSupportPages: false,
  }),
});

export function buildPhotoReadinessMetrics({ photoSummary = {}, selectedPhotos = [], recommendationActions = [] } = {}) {
  const selected = (selectedPhotos || []).filter((photo) => photo?.imageUrl);
  const marketplaceReadyFromSummary = Number(photoSummary?.listingCandidateCount || 0);
  const marketplaceReadyFromSelection = selected.filter((photo) => photo?.listingCandidate).length;
  const marketplaceReadyPhotos = Math.max(marketplaceReadyFromSummary, marketplaceReadyFromSelection, 0);

  const savedPhotosFlaggedForImprovement = selected.filter((photo) => {
    const score = Number(photo?.score || 0);
    return !photo?.listingCandidate || (Number.isFinite(score) && score > 0 && score < 75);
  }).length;

  const priorityRetakesFromActions = (recommendationActions || []).filter((action) => {
    const urgency = String(action?.urgency || '').toLowerCase();
    const title = String(action?.title || '').toLowerCase();
    return urgency === 'high' && /photo|retake|image/.test(title);
  }).length;
  const priorityRetakesFromSummary = Number(photoSummary?.retakeCount || 0);
  const priorityRetakes = Math.max(priorityRetakesFromSummary, priorityRetakesFromActions, 0);

  const mustFixBeforeLaunchCount = Math.max(
    priorityRetakes,
    Number(photoSummary?.retakeCount || 0),
  );

  return {
    totalSelectedPhotos: selected.length,
    marketplaceReadyPhotos,
    savedPhotosFlaggedForImprovement,
    priorityRetakes,
    mustFixBeforeLaunchCount,
  };
}

export function decideOutputClasses({
  readinessScore = 0,
  marketplaceReadyPhotoCount = 0,
  chosenPricePresent = false,
  checklistCompletionPercent = 0,
  priorityRetakeCount = 0,
} = {}) {
  const readiness = Number(readinessScore || 0);
  const marketplaceReady = Math.max(0, Number(marketplaceReadyPhotoCount || 0));
  const checklistCompletion = Math.max(0, Number(checklistCompletionPercent || 0));
  const priorityRetakes = Math.max(0, Number(priorityRetakeCount || 0));
  const hasChosenPrice = Boolean(chosenPricePresent);

  const reasons = [];

  if (readiness < 50 || marketplaceReady === 0) {
    if (readiness < 50) {
      reasons.push(`readiness_${readiness}_below_50`);
    }
    if (marketplaceReady === 0) {
      reasons.push('no_marketplace_ready_photos');
    }
    return {
      sellerReportClass: SELLER_REPORT_CLASS.PREP,
      flyerClass: FLYER_CLASS.PREVIEW,
      reasons,
    };
  }

  if (readiness >= 70 && marketplaceReady >= 3 && hasChosenPrice) {
    reasons.push('high_readiness_with_ready_visuals_and_price');
    return {
      sellerReportClass: SELLER_REPORT_CLASS.LAUNCH,
      flyerClass: FLYER_CLASS.MARKETING,
      reasons,
    };
  }

  if (readiness >= 50 && readiness < 70) {
    reasons.push(`readiness_${readiness}_between_50_69`);
    if (marketplaceReady >= 3) {
      reasons.push('strong_visual_coverage_for_prelaunch');
    }
    return {
      sellerReportClass: SELLER_REPORT_CLASS.BALANCED,
      flyerClass: FLYER_CLASS.PRELAUNCH,
      reasons,
    };
  }

  if (readiness >= 70 && marketplaceReady >= 3 && !hasChosenPrice) {
    reasons.push('high_readiness_missing_chosen_price');
    return {
      sellerReportClass: SELLER_REPORT_CLASS.LAUNCH,
      flyerClass: FLYER_CLASS.PRELAUNCH,
      reasons,
    };
  }

  if (readiness >= 70 && marketplaceReady < 3) {
    reasons.push('high_readiness_weak_gallery_mismatch');
    reasons.push(`marketplace_ready_${marketplaceReady}_below_3`);
    return {
      sellerReportClass: SELLER_REPORT_CLASS.BALANCED,
      flyerClass: marketplaceReady === 0 ? FLYER_CLASS.PREVIEW : FLYER_CLASS.PRELAUNCH,
      reasons,
    };
  }

  if (checklistCompletion >= 80 && marketplaceReady >= 2 && hasChosenPrice) {
    reasons.push('checklist_near_complete_with_pricing');
    return {
      sellerReportClass: SELLER_REPORT_CLASS.BALANCED,
      flyerClass: FLYER_CLASS.PRELAUNCH,
      reasons,
    };
  }

  if (priorityRetakes >= 5 && readiness < 70) {
    reasons.push('priority_retakes_high_for_current_readiness');
    return {
      sellerReportClass: SELLER_REPORT_CLASS.PREP,
      flyerClass: FLYER_CLASS.PREVIEW,
      reasons,
    };
  }

  reasons.push('default_balanced_classification');
  return {
    sellerReportClass: SELLER_REPORT_CLASS.BALANCED,
    flyerClass: marketplaceReady >= 2 ? FLYER_CLASS.PRELAUNCH : FLYER_CLASS.PREVIEW,
    reasons,
  };
}

export function getSellerReportToneProfile(sellerReportClass = SELLER_REPORT_CLASS.BALANCED) {
  return SELLER_TONE_PROFILES[sellerReportClass] || SELLER_TONE_PROFILES[SELLER_REPORT_CLASS.BALANCED];
}

export function getFlyerToneProfile(flyerClass = FLYER_CLASS.PRELAUNCH) {
  return FLYER_TONE_PROFILES[flyerClass] || FLYER_TONE_PROFILES[FLYER_CLASS.PRELAUNCH];
}

export function getActionPlanDepthProfile(sellerReportClass = SELLER_REPORT_CLASS.BALANCED) {
  return ACTION_PLAN_DEPTH_BY_CLASS[sellerReportClass] || ACTION_PLAN_DEPTH_BY_CLASS[SELLER_REPORT_CLASS.BALANCED];
}

export function buildSectionRegistry({
  sellerReportClass,
  flyerClass,
  photoMetrics = {},
  hasSelectedPrice = false,
} = {}) {
  const marketplaceReadyPhotos = Number(photoMetrics?.marketplaceReadyPhotos || 0);
  const mustFixBeforeLaunchCount = Number(photoMetrics?.mustFixBeforeLaunchCount || 0);
  const actionDepth = getActionPlanDepthProfile(sellerReportClass);
  const includePhotoPreparationPage =
    sellerReportClass === SELLER_REPORT_CLASS.PREP ||
    (sellerReportClass === SELLER_REPORT_CLASS.BALANCED && (marketplaceReadyPhotos < 2 || mustFixBeforeLaunchCount >= 4)) ||
    (sellerReportClass === SELLER_REPORT_CLASS.LAUNCH && mustFixBeforeLaunchCount >= 5);
  const includeActionSupportPages =
    actionDepth.includeSupportPages || mustFixBeforeLaunchCount >= 3;
  const includeReadinessEconomics =
    sellerReportClass !== SELLER_REPORT_CLASS.LAUNCH || !hasSelectedPrice || mustFixBeforeLaunchCount > 0;
  const includeMarketingGallery =
    flyerClass === FLYER_CLASS.MARKETING
      ? marketplaceReadyPhotos >= 2
      : flyerClass === FLYER_CLASS.PRELAUNCH
        ? marketplaceReadyPhotos >= 1
        : marketplaceReadyPhotos >= 2;
  const includeNeighborhoodPositioningPage =
    flyerClass !== FLYER_CLASS.PREVIEW || hasSelectedPrice || marketplaceReadyPhotos >= 2;
  const includePricingPositioningPage = hasSelectedPrice || flyerClass !== FLYER_CLASS.PREVIEW;

  return {
    seller: {
      includePhotoPreparationPage,
      includeActionSupportPages,
      includeReadinessEconomics,
      maxDetailLevel: sellerReportClass === SELLER_REPORT_CLASS.PREP ? 'high' : sellerReportClass === SELLER_REPORT_CLASS.LAUNCH ? 'low' : 'medium',
    },
    flyer: {
      includeMarketingGallery,
      includeNeighborhoodPositioningPage,
      includePricingPositioningPage,
      maxDetailLevel: flyerClass === FLYER_CLASS.PREVIEW ? 'low' : flyerClass === FLYER_CLASS.MARKETING ? 'high' : 'medium',
    },
  };
}
