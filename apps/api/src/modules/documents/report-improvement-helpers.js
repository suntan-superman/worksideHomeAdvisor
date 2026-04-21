import { formatCurrency } from '@workside/utils';

const DEFAULT_ACTION_URGENCY = 'medium';

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeByTitle(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeText(item?.title).toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function actionTypeFromTitle(title = '') {
  const normalized = normalizeText(title).toLowerCase();
  if (!normalized) {
    return 'staging_improvement';
  }
  if (normalized.includes('photo') || normalized.includes('retake')) {
    return 'photo_retake';
  }
  if (normalized.includes('staging')) {
    return 'staging_improvement';
  }
  if (normalized.includes('light')) {
    return 'lighting_improvement';
  }
  if (normalized.includes('declutter') || normalized.includes('organize')) {
    return 'declutter';
  }
  if (normalized.includes('curb') || normalized.includes('exterior')) {
    return 'curb_appeal';
  }
  if (normalized.includes('price') || normalized.includes('pricing')) {
    return 'pricing_review';
  }
  if (normalized.includes('provider') || normalized.includes('book') || normalized.includes('schedule')) {
    return 'provider_booking';
  }
  return 'staging_improvement';
}

function urgencyFromChecklistPriority(priority = '') {
  const normalized = normalizeText(priority).toLowerCase();
  if (normalized === 'high') {
    return 'high';
  }
  if (normalized === 'low') {
    return 'low';
  }
  return DEFAULT_ACTION_URGENCY;
}

function urgencyFromActionType(actionType) {
  if (['photo_retake', 'pricing_review', 'provider_booking'].includes(actionType)) {
    return 'high';
  }
  if (['staging_improvement', 'lighting_improvement', 'curb_appeal'].includes(actionType)) {
    return 'medium';
  }
  return DEFAULT_ACTION_URGENCY;
}

function buildActionCta({
  actionType,
  propertyId,
  checklistItemId = '',
  providerCategory = '',
  priority = 50,
}) {
  const defaultRoute = `/properties/${propertyId || ':propertyId'}`;
  const map = {
    photo_retake: {
      label: 'Retake key photos',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/media`,
    },
    staging_improvement: {
      label: 'Review staging checklist',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/checklist`,
    },
    lighting_improvement: {
      label: 'Improve lighting setup',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/checklist`,
    },
    declutter: {
      label: 'Start declutter plan',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/checklist`,
    },
    curb_appeal: {
      label: 'Review curb appeal tasks',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/checklist`,
    },
    pricing_review: {
      label: 'Review pricing',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/pricing`,
    },
    provider_booking: {
      label: 'Find a provider',
      destinationType: 'app_route',
      destinationRoute: `${defaultRoute}/providers`,
    },
    report_regeneration: {
      label: 'Regenerate report',
      destinationType: 'api_route',
      destinationRoute: `/api/properties/${propertyId || ':propertyId'}/reports/generate`,
    },
  };
  const selected = map[actionType] || map.staging_improvement;
  return {
    label: selected.label,
    destinationType: selected.destinationType,
    destinationRoute: selected.destinationRoute,
    relatedPropertyId: propertyId || '',
    relatedTaskId: checklistItemId || '',
    relatedProviderCategory: providerCategory || '',
    priority: Number(priority || 50),
    visibilityConditions: [],
  };
}

function buildReasonFromActionType({
  actionType,
  photoSummary,
  checklist,
  pricing,
  providerCategory,
}) {
  if (actionType === 'photo_retake') {
    const count = Number(photoSummary?.retakeCount || 0);
    return count
      ? `${count} photo retake recommendation${count === 1 ? '' : 's'} remain before launch.`
      : 'Photo quality should be reviewed before launch.';
  }
  if (actionType === 'pricing_review') {
    return pricing?.recommendedListMid
      ? `Pricing is centered near ${formatCurrency(pricing.recommendedListMid)} and should be confirmed before launch.`
      : 'Pricing guidance needs review before launch.';
  }
  if (actionType === 'provider_booking') {
    return providerCategory
      ? `Execution support is available in ${providerCategory}.`
      : 'Execution support can reduce launch delays.';
  }
  if (actionType === 'report_regeneration') {
    return 'Refresh the report after major pricing, photo, or checklist changes.';
  }
  const openCount = Number(checklist?.summary?.openCount || 0);
  if (openCount > 0) {
    return `${openCount} checklist item${openCount === 1 ? '' : 's'} remain open.`;
  }
  return 'This action supports stronger launch readiness and buyer first impressions.';
}

function buildOutcomeFromActionType(actionType = '') {
  const map = {
    photo_retake: 'Cleaner first impressions and stronger buyer click-through potential.',
    staging_improvement: 'Clearer room function and improved buyer perception.',
    lighting_improvement: 'Brighter visuals that may improve showing interest.',
    declutter: 'Lower visual friction and better perceived space.',
    curb_appeal: 'Stronger street-level first impression before showings.',
    pricing_review: 'Better price-position confidence and launch alignment.',
    provider_booking: 'Faster execution and fewer launch delays.',
    report_regeneration: 'Updated plan that reflects the latest readiness signals.',
  };
  return map[actionType] || 'Improved launch confidence.';
}

function estimatedCostFromActionType(actionType = '') {
  const map = {
    photo_retake: '$250-$650',
    staging_improvement: '$500-$2,000',
    lighting_improvement: '$150-$600',
    declutter: '$100-$900',
    curb_appeal: '$300-$1,500',
    pricing_review: 'Low direct cost',
    provider_booking: 'Varies by provider',
    report_regeneration: 'Included',
  };
  return map[actionType] || 'Varies';
}

export function buildConsequenceFraming({
  photoSummary,
  checklist,
  pricing,
  readinessSummary,
  providerRecommendations = [],
}) {
  const consequences = [];
  const retakeCount = Number(photoSummary?.retakeCount || 0);
  const openCount = Number(checklist?.summary?.openCount || 0);
  const hasSelectedPrice = Number(pricing?.recommendedListMid || 0) > 0;
  const score = Number(readinessSummary?.overallScore || 0);

  if (retakeCount > 0) {
    consequences.push(
      `${retakeCount} photo retake recommendation${retakeCount === 1 ? '' : 's'} remain, which may weaken first impressions and reduce early buyer appeal.`,
    );
  }

  if (openCount > 0) {
    consequences.push(
      `${openCount} checklist item${openCount === 1 ? '' : 's'} remain open and may delay launch momentum if unresolved.`,
    );
  }

  if (!hasSelectedPrice || Number(pricing?.confidenceScore || 0) < 0.6) {
    consequences.push(
      'Pricing still needs confirmation, which may limit value perception or create negotiation friction.',
    );
  }

  if (score < 70) {
    consequences.push(
      `Current readiness is ${score}/100, which may leave presentation value on the table until top prep items are completed.`,
    );
  }

  if (!providerRecommendations.length) {
    consequences.push(
      'Execution support is still limited, which may slow prep completion and showing readiness.',
    );
  }

  return {
    lines: consequences.slice(0, 5),
    summary: consequences.length
      ? consequences[0]
      : 'No major consequence flags are currently dominant, but readiness should still be monitored as launch plans change.',
  };
}

export function buildDecisionDrivenEconomics({ estimatedCost, estimatedRoi, readinessSummary }) {
  const cost = Number(estimatedCost || 0);
  const roi = Number(estimatedRoi || 0);
  const netUpside = roi > 0 && cost > 0 ? Math.max(0, roi - cost) : 0;
  const score = Number(readinessSummary?.overallScore || 0);

  let decisionMessage = 'Improve the highest-impact prep items before launch to protect buyer confidence.';
  if (cost > 0 && roi > 0) {
    decisionMessage = `A focused prep investment of about ${formatCurrency(cost)} may protect or unlock roughly ${formatCurrency(roi)} in presentation-driven value.`;
  } else if (score < 65) {
    decisionMessage =
      'Readiness signals suggest the home may be leaving value on the table until top prep items are complete.';
  }

  return {
    netUpside,
    decisionMessage,
  };
}

export function buildRecommendationActions({
  propertyId,
  improvementGuidance,
  checklist,
  photoSummary,
  pricing,
  providerRecommendations = [],
  readinessSummary,
}) {
  const actions = [];
  const openChecklistItems = (checklist?.items || []).filter((item) => item.status !== 'done');
  const guidanceItems = improvementGuidance?.recommendations || [];

  if (Number(photoSummary?.retakeCount || 0) > 0) {
    const actionType = 'photo_retake';
    actions.push({
      title: `Retake ${photoSummary.retakeCount} priority listing photo${photoSummary.retakeCount === 1 ? '' : 's'}`,
      reason: buildReasonFromActionType({ actionType, photoSummary, checklist, pricing }),
      urgency: 'high',
      estimatedCost: estimatedCostFromActionType(actionType),
      expectedOutcome: buildOutcomeFromActionType(actionType),
      actionType,
      linkedChecklistItemIds: openChecklistItems
        .filter((item) => String(item.category || '').toLowerCase().includes('photo'))
        .map((item) => item.id)
        .filter(Boolean)
        .slice(0, 3),
      linkedProviderCategory: 'photographer',
    });
  }

  for (const entry of guidanceItems) {
    const actionType = actionTypeFromTitle(entry?.title || '');
    actions.push({
      title: normalizeText(entry?.title) || 'Complete high-impact prep item',
      reason: normalizeText(entry?.rationale) || buildReasonFromActionType({ actionType, photoSummary, checklist, pricing }),
      urgency: ['high', 'medium', 'low'].includes(String(entry?.priority || '').toLowerCase())
        ? String(entry.priority).toLowerCase()
        : urgencyFromActionType(actionType),
      estimatedCost: estimatedCostFromActionType(actionType),
      expectedOutcome: normalizeText(entry?.estimatedImpact) || buildOutcomeFromActionType(actionType),
      actionType,
      linkedChecklistItemIds: [],
      linkedProviderCategory: '',
    });
  }

  if (openChecklistItems[0]) {
    const primaryChecklistItem = openChecklistItems[0];
    const actionType = actionTypeFromTitle(primaryChecklistItem.title);
    actions.push({
      title: primaryChecklistItem.title,
      reason:
        normalizeText(primaryChecklistItem.detail) ||
        `Complete this checklist item to improve launch readiness before showings.`,
      urgency: urgencyFromChecklistPriority(primaryChecklistItem.priority),
      estimatedCost: estimatedCostFromActionType(actionType),
      expectedOutcome: buildOutcomeFromActionType(actionType),
      actionType,
      linkedChecklistItemIds: [primaryChecklistItem.id].filter(Boolean),
      linkedProviderCategory: primaryChecklistItem.providerCategoryKey || '',
    });
  }

  if (!pricing?.recommendedListMid || Number(pricing?.confidenceScore || 0) < 0.6) {
    const actionType = 'pricing_review';
    actions.push({
      title: 'Review pricing before launch',
      reason: buildReasonFromActionType({ actionType, photoSummary, checklist, pricing }),
      urgency: 'high',
      estimatedCost: estimatedCostFromActionType(actionType),
      expectedOutcome: buildOutcomeFromActionType(actionType),
      actionType,
      linkedChecklistItemIds: [],
      linkedProviderCategory: '',
    });
  }

  for (const provider of providerRecommendations.slice(0, 2)) {
    const actionType = 'provider_booking';
    actions.push({
      title: `Contact ${provider.businessName}`,
      reason:
        normalizeText(provider.reasonMatched) ||
        normalizeText(provider.reason) ||
        buildReasonFromActionType({
          actionType,
          photoSummary,
          checklist,
          pricing,
          providerCategory: provider.categoryLabel || provider.categoryKey,
        }),
      urgency: provider.sourceType === 'marketplace' ? 'medium' : 'high',
      estimatedCost: estimatedCostFromActionType(actionType),
      expectedOutcome: buildOutcomeFromActionType(actionType),
      actionType,
      linkedChecklistItemIds: [],
      linkedProviderCategory: provider.categoryKey || '',
    });
  }

  actions.push({
    title: 'Regenerate the report after key updates',
    reason: buildReasonFromActionType({
      actionType: 'report_regeneration',
      photoSummary,
      checklist,
      pricing,
    }),
    urgency: Number(readinessSummary?.overallScore || 0) < 75 ? 'high' : 'medium',
    estimatedCost: estimatedCostFromActionType('report_regeneration'),
    expectedOutcome: buildOutcomeFromActionType('report_regeneration'),
    actionType: 'report_regeneration',
    linkedChecklistItemIds: [],
    linkedProviderCategory: '',
  });

  const normalized = dedupeByTitle(actions).slice(0, 20);
  return normalized.map((action, index) => {
    const cta = buildActionCta({
      actionType: action.actionType,
      propertyId,
      checklistItemId: action.linkedChecklistItemIds?.[0] || '',
      providerCategory: action.linkedProviderCategory || '',
      priority: Math.max(1, 100 - index * 10),
    });
    return {
      id: `action-${index + 1}`,
      title: action.title,
      reason: action.reason,
      urgency: action.urgency || DEFAULT_ACTION_URGENCY,
      estimatedCost: action.estimatedCost,
      expectedOutcome: action.expectedOutcome,
      recommendedActionType: action.actionType,
      ctaLabel: cta.label,
      ctaDestination: cta.destinationRoute,
      linkedChecklistItemIds: action.linkedChecklistItemIds || [],
      linkedProviderCategory: action.linkedProviderCategory || '',
      cta,
    };
  });
}
