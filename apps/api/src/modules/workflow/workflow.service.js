import { getLatestPropertyFlyer } from '../documents/flyer.service.js';
import { getLatestPropertyReport } from '../documents/report.service.js';
import { countMarketplaceReadyAssets } from '../media/media.service.js';
import { getPropertyWorkspaceSnapshot } from '../properties/property-workspace.service.js';
import { listProviderLeadsForProperty } from '../providers/providers.service.js';

const CORE_ROOM_LABELS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const PHASE_LABELS = {
  account: 'Account',
  property: 'Property',
  pricing: 'Pricing',
  photos: 'Photos',
  prep: 'Prep',
  providers: 'Providers',
  materials: 'Materials',
  final_review: 'Final Review',
};

const ROLE_STEP_COPY = {
  seller: {
    account_created: {
      title: 'Create your account',
      description: 'Start here. It only takes a minute.',
      ctaLabel: 'Continue',
      actionHref: '/auth',
    },
    profile_complete: {
      title: 'Complete your profile',
      description: 'We’ll use this to guide your experience.',
      ctaLabel: 'Open dashboard',
      actionHref: '/dashboard',
    },
    property_added: {
      title: 'Add your property',
      description: 'Enter the home you’re preparing to sell.',
      ctaLabel: 'Open dashboard',
      actionHref: '/dashboard',
    },
    property_details: {
      title: 'Add property details',
      description: 'These details help us prepare your home.',
      ctaLabel: 'Review details',
      actionTarget: 'overview',
      helperText: 'Confirm the address and core property facts before moving into pricing and photos.',
    },
    pricing_review: {
      title: 'Review pricing',
      description: 'See how your home compares.',
      ctaLabel: 'View pricing',
      actionTarget: 'pricing',
    },
    capture_photos: {
      title: 'Take photos',
      description: 'Use your phone. We’ll guide you room by room.',
      ctaLabel: 'Start photo capture',
      actionTarget: 'photos',
      helperText: 'Good lighting helps. Stand in the corner for best results.',
    },
    review_photos: {
      title: 'Review your photos',
      description: 'Choose the best images for your listing.',
      ctaLabel: 'Review photos',
      actionTarget: 'photos',
    },
    enhance_photos: {
      title: 'Improve your photos',
      description: 'Make a stronger first impression.',
      ctaLabel: 'Enhance photos',
      actionTarget: 'vision',
    },
    prep_checklist: {
      title: 'Prepare your home',
      description: 'Complete these steps to improve your home’s appeal.',
      ctaLabel: 'View checklist',
      actionTarget: 'checklist',
    },
    providers: {
      title: 'Get help if needed',
      description: 'We’ll connect you with local providers.',
      ctaLabel: 'View providers',
      actionTarget: 'checklist',
      fallbackDescription: 'No providers in your area yet. You can still continue.',
    },
    report: {
      title: 'Create your report',
      description: 'Generate a professional summary of your home.',
      ctaLabel: 'Generate report',
      actionTarget: 'report',
    },
    brochure: {
      title: 'Create marketing materials',
      description: 'Build a brochure in minutes.',
      ctaLabel: 'Create brochure',
      actionTarget: 'brochure',
    },
    final_review: {
      title: 'Final review',
      description: 'You’re almost ready.',
      ctaLabel: 'Review now',
      actionTarget: 'overview',
    },
  },
  agent: {
    account_created: {
      title: 'Create your agent account',
      description: 'Set up your workspace.',
      ctaLabel: 'Continue',
      actionHref: '/auth',
    },
    profile_complete: {
      title: 'Complete your profile',
      description: 'Add your details and brokerage.',
      ctaLabel: 'Open dashboard',
      actionHref: '/dashboard',
    },
    property_added: {
      title: 'Add a listing',
      description: 'Start with the property you’re preparing.',
      ctaLabel: 'Open dashboard',
      actionHref: '/dashboard',
    },
    property_details: {
      title: 'Enter property details',
      description: 'This powers pricing and materials.',
      ctaLabel: 'Review details',
      actionTarget: 'overview',
      helperText: 'Confirm the address and core listing facts before moving into pricing and marketing materials.',
    },
    pricing_review: {
      title: 'Review comps',
      description: 'Align your pricing early.',
      ctaLabel: 'View comps',
      actionTarget: 'pricing',
    },
    capture_photos: {
      title: 'Add photos',
      description: 'Upload or capture listing photos.',
      ctaLabel: 'Add photos',
      actionTarget: 'photos',
    },
    review_photos: {
      title: 'Review listing photos',
      description: 'Choose your best images.',
      ctaLabel: 'Review',
      actionTarget: 'photos',
    },
    enhance_photos: {
      title: 'Enhance images',
      description: 'Optional improvements for better presentation.',
      ctaLabel: 'Enhance',
      actionTarget: 'vision',
    },
    prep_checklist: {
      title: 'Prep checklist',
      description: 'Plan what needs to be done.',
      ctaLabel: 'View checklist',
      actionTarget: 'checklist',
    },
    providers: {
      title: 'Find providers',
      description: 'Connect with services quickly.',
      ctaLabel: 'Find providers',
      actionTarget: 'checklist',
      fallbackDescription: 'No providers in your area yet. You can still continue.',
    },
    report: {
      title: 'Generate report',
      description: 'Create a seller-ready report.',
      ctaLabel: 'Generate',
      actionTarget: 'report',
    },
    brochure: {
      title: 'Create brochure',
      description: 'Build listing materials.',
      ctaLabel: 'Create',
      actionTarget: 'brochure',
    },
    final_review: {
      title: 'Ready to list',
      description: 'Everything is in place.',
      ctaLabel: 'Finalize',
      actionTarget: 'overview',
    },
  },
};

const STEP_SEQUENCE = [
  { key: 'account_created', phase: 'account', isRequired: true },
  { key: 'profile_complete', phase: 'account', isRequired: true },
  { key: 'property_added', phase: 'property', isRequired: true },
  { key: 'property_details', phase: 'property', isRequired: true },
  { key: 'pricing_review', phase: 'pricing', isRequired: true },
  { key: 'capture_photos', phase: 'photos', isRequired: true },
  { key: 'review_photos', phase: 'photos', isRequired: true },
  { key: 'enhance_photos', phase: 'photos', isRequired: false },
  { key: 'prep_checklist', phase: 'prep', isRequired: true },
  { key: 'providers', phase: 'providers', isRequired: false },
  { key: 'report', phase: 'materials', isRequired: true },
  { key: 'brochure', phase: 'materials', isRequired: true },
  { key: 'final_review', phase: 'final_review', isRequired: true },
];

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function normalizeRole(role) {
  return role === 'agent' ? 'agent' : 'seller';
}

function coverageSummary(mediaAssets) {
  const roomCoverageCount = CORE_ROOM_LABELS.filter((roomLabel) =>
    mediaAssets.some((asset) => asset.roomLabel === roomLabel),
  ).length;
  const listingCandidateCount = countMarketplaceReadyAssets(mediaAssets);
  const preferredVariantCount = mediaAssets.filter((asset) => asset.selectedVariant).length;
  return {
    photoCount: mediaAssets.length,
    roomCoverageCount,
    listingCandidateCount,
    preferredVariantCount,
    completePhotoCoverage: mediaAssets.length >= CORE_ROOM_LABELS.length || roomCoverageCount >= CORE_ROOM_LABELS.length,
  };
}

function computeMarketReadyScore(context) {
  const propertyDetailsScore = context.propertyDetailsComplete
    ? 100
    : context.propertyDetailsStarted
      ? 55
      : 0;
  const pricingScore = context.pricingReviewed ? 100 : 0;
  const photosScore = clampScore(
    ((context.photoSummary.completePhotoCoverage ? 60 : (context.photoSummary.photoCount / CORE_ROOM_LABELS.length) * 60) || 0) +
      Math.min(40, (context.photoSummary.listingCandidateCount / 3) * 40),
  );
  const checklistScore = clampScore(context.checklist?.summary?.progressPercent || 0);
  const providersNeeded = context.providerPromptCount > 0;
  const providersScore = providersNeeded ? (context.providerLeadCount > 0 ? 100 : 0) : 100;
  const reportScore = context.latestReport ? 100 : 0;
  const brochureScore = context.latestFlyer ? 100 : 0;

  const weighted =
    propertyDetailsScore * 0.2 +
    pricingScore * 0.2 +
    photosScore * 0.2 +
    checklistScore * 0.15 +
    providersScore * 0.1 +
    reportScore * 0.15 +
    brochureScore * 0.1;

  return clampScore(weighted);
}

function buildRawStepStates(context, role) {
  const copy = ROLE_STEP_COPY[role];
  const steps = [];

  const propertyAddedComplete = Boolean(context.property?.addressLine1);
  const propertyDetailsComplete = Boolean(
    context.property?.bedrooms &&
      context.property?.bathrooms &&
      context.property?.squareFeet,
  );
  const propertyDetailsStarted = Boolean(
    context.property?.bedrooms ||
      context.property?.bathrooms ||
      context.property?.squareFeet ||
      context.property?.yearBuilt,
  );
  const pricingReviewed = Boolean(context.pricing?.recommendedListMid);
  const photosStarted = context.photoSummary.photoCount > 0;
  const photosReviewed = context.photoSummary.listingCandidateCount >= 3;
  const photosReviewStarted = context.photoSummary.listingCandidateCount > 0 || photosStarted;
  const enhancementsComplete = context.photoSummary.preferredVariantCount > 0 || context.variantCount > 0;
  const checklistProgress = Number(context.checklist?.summary?.progressPercent || 0);
  const prepComplete = checklistProgress >= 70;
  const prepStarted = checklistProgress > 0;
  const providersApplicable = context.providerPromptCount > 0;
  const providersComplete = !providersApplicable || context.providerLeadCount > 0;
  const finalReviewComplete =
    pricingReviewed &&
    photosReviewed &&
    prepComplete &&
    Boolean(context.latestFlyer) &&
    Boolean(context.latestReport);
  const finalReviewStarted =
    Boolean(context.latestFlyer) ||
    Boolean(context.latestReport) ||
    checklistProgress >= 50;

  const rawByKey = {
    account_created: {
      status: 'complete',
      completedAt: context.property?.createdAt || null,
    },
    profile_complete: {
      status: 'complete',
      completedAt: context.property?.createdAt || null,
    },
    property_added: {
      status: propertyAddedComplete ? 'complete' : 'available',
      completedAt: propertyAddedComplete ? context.property?.createdAt || null : null,
    },
    property_details: {
      status: propertyDetailsComplete ? 'complete' : propertyDetailsStarted ? 'in_progress' : 'available',
      completedAt: propertyDetailsComplete ? context.property?.updatedAt || context.property?.createdAt || null : null,
    },
    pricing_review: {
      status: pricingReviewed ? 'complete' : 'available',
      completedAt: pricingReviewed ? context.pricing?.createdAt || context.pricing?.updatedAt || null : null,
    },
    capture_photos: {
      status: context.photoSummary.completePhotoCoverage ? 'complete' : photosStarted ? 'in_progress' : 'available',
      completedAt: context.photoSummary.completePhotoCoverage ? context.latestMediaAt || null : null,
      helperText: copy.capture_photos.helperText,
    },
    review_photos: {
      status: photosReviewed ? 'complete' : photosReviewStarted ? 'in_progress' : 'available',
      completedAt: photosReviewed ? context.latestMediaAt || null : null,
    },
    enhance_photos: {
      status: enhancementsComplete ? 'complete' : photosStarted ? 'available' : 'locked',
      completedAt: enhancementsComplete ? context.latestVariantAt || null : null,
    },
    prep_checklist: {
      status: prepComplete ? 'complete' : prepStarted ? 'in_progress' : 'available',
      completedAt: prepComplete ? context.checklist?.updatedAt || null : null,
    },
    providers: {
      status: providersComplete ? 'complete' : providersApplicable ? 'available' : 'complete',
      completedAt: providersComplete && providersApplicable ? context.latestProviderLeadAt || null : null,
      description: providersApplicable ? copy.providers.description : copy.providers.fallbackDescription,
    },
    report: {
      status: context.latestReport ? 'complete' : 'available',
      completedAt: context.latestReport?.createdAt || null,
    },
    brochure: {
      status: context.latestFlyer ? 'complete' : 'available',
      completedAt: context.latestFlyer?.createdAt || null,
    },
    final_review: {
      status: finalReviewComplete ? 'complete' : finalReviewStarted ? 'in_progress' : 'available',
      completedAt: finalReviewComplete ? context.latestReport?.updatedAt || context.latestFlyer?.updatedAt || null : null,
    },
  };

  let previousRequiredIncomplete = false;

  for (const stepTemplate of STEP_SEQUENCE) {
    const copyEntry = copy[stepTemplate.key];
    const raw = rawByKey[stepTemplate.key];
    let status = raw.status;

    if (status !== 'complete' && previousRequiredIncomplete) {
      status = 'locked';
    }

    if (stepTemplate.key === 'enhance_photos' && !photosStarted) {
      status = 'locked';
    }
    if (stepTemplate.key === 'providers' && !providersApplicable) {
      status = 'complete';
    }

    const step = {
      key: stepTemplate.key,
      phase: stepTemplate.phase,
      phaseLabel: PHASE_LABELS[stepTemplate.phase],
      title: copyEntry.title,
      description: raw.description || copyEntry.description,
      helperText: raw.helperText || copyEntry.helperText || '',
      ctaLabel: copyEntry.ctaLabel,
      actionTarget: copyEntry.actionTarget || '',
      actionHref: copyEntry.actionHref || '',
      status,
      isRequired: stepTemplate.isRequired,
      completedAt: raw.completedAt || null,
    };

    steps.push(step);

    if (stepTemplate.isRequired && status !== 'complete') {
      previousRequiredIncomplete = true;
    }
  }

  steps.forEach((step, index) => {
    if (step.status !== 'locked') {
      return;
    }

    const blockingStep = steps
      .slice(0, index)
      .find((previousStep) => previousStep.isRequired && previousStep.status !== 'complete');

    if (blockingStep) {
      step.lockedReason = `Finish "${blockingStep.title}" first to unlock this step.`;
      step.unlocksWhen = blockingStep.title;
    }
  });

  return {
    steps,
    propertyDetailsComplete,
    propertyDetailsStarted,
    pricingReviewed,
  };
}

function buildPhaseSummary(steps) {
  const phases = [];
  for (const [phaseKey, phaseLabel] of Object.entries(PHASE_LABELS)) {
    const phaseSteps = steps.filter((step) => step.phase === phaseKey);
    if (!phaseSteps.length) {
      continue;
    }
    const requiredSteps = phaseSteps.filter((step) => step.isRequired);
    const completedRequired = requiredSteps.filter((step) => step.status === 'complete').length;
    const status = completedRequired === requiredSteps.length
      ? 'complete'
      : phaseSteps.some((step) => step.status === 'in_progress' || step.status === 'available')
        ? 'in_progress'
        : phaseSteps.every((step) => step.status === 'locked')
          ? 'locked'
          : 'available';

    phases.push({
      key: phaseKey,
      label: phaseLabel,
      status,
      completedSteps: completedRequired,
      totalSteps: requiredSteps.length,
    });
  }
  return phases;
}

function buildNextStep(steps) {
  return steps.find((step) => step.isRequired && step.status !== 'complete') ||
    steps.find((step) => step.status === 'available') ||
    steps.find((step) => step.status === 'in_progress') ||
    null;
}

function mapStepStatusToUxStatus(step, recommendedStepKey) {
  if (step.status === 'complete') {
    return 'completed';
  }

  if (step.status === 'locked') {
    return 'blocked';
  }

  if (step.key === recommendedStepKey) {
    return 'recommended';
  }

  if (step.status === 'in_progress') {
    return 'in_progress';
  }

  return 'ready';
}

function buildStatusSummary(steps) {
  return steps.reduce(
    (summary, step) => {
      if (step.uxStatus === 'completed') {
        summary.completed += 1;
      } else if (step.uxStatus === 'blocked') {
        summary.blocked += 1;
      } else {
        summary.open += 1;
        if (step.uxStatus === 'recommended') {
          summary.recommended += 1;
        }
        if (step.uxStatus === 'ready') {
          summary.ready += 1;
        }
        if (step.uxStatus === 'in_progress') {
          summary.inProgress += 1;
        }
      }

      return summary;
    },
    {
      completed: 0,
      open: 0,
      blocked: 0,
      recommended: 0,
      ready: 0,
      inProgress: 0,
    },
  );
}

function buildReadinessSummary(marketReadyScore, completionPercent) {
  if (marketReadyScore >= 85) {
    return {
      tone: 'strong',
      label: 'Market-ready momentum',
      message: `You have ${completionPercent}% of the guided workflow complete and the property is in strong shape for final materials.`,
    };
  }

  if (marketReadyScore >= 60) {
    return {
      tone: 'steady',
      label: 'Good progress',
      message: `You have ${completionPercent}% complete. Tightening the remaining prep and photo tasks should lift presentation quality quickly.`,
    };
  }

  if (marketReadyScore >= 35) {
    return {
      tone: 'building',
      label: 'Foundation in place',
      message: `You have ${completionPercent}% complete. The next few guided actions will noticeably improve pricing confidence and marketing quality.`,
    };
  }

  return {
    tone: 'early',
    label: 'Just getting started',
    message: `You have ${completionPercent}% complete. Focus on the recommended step first so the rest of the workflow unlocks cleanly.`,
  };
}

export async function getGuidedWorkflowState(propertyId, role = 'seller') {
  const normalizedRole = normalizeRole(role);
  const [snapshot, providerLeads] = await Promise.all([
    getPropertyWorkspaceSnapshot(propertyId),
    listProviderLeadsForProperty(propertyId),
  ]);

  const property = snapshot?.property || null;
  const pricing = snapshot?.pricingAnalyses?.latest || null;
  const mediaAssets = snapshot?.mediaAssets || [];
  const checklist = snapshot?.checklist || null;
  const latestFlyer = snapshot?.reports?.latestFlyer || null;
  const latestReport = snapshot?.reports?.latestReport || null;

  if (!property) {
    throw new Error('Property not found.');
  }

  const variants = snapshot?.mediaVariants || [];
  const photoSummary = coverageSummary(mediaAssets);
  const providerPromptCount = (checklist?.items || []).filter(
    (item) => item.providerCategoryKey && item.status !== 'done',
  ).length;
  const latestMediaAt = [...mediaAssets]
    .map((asset) => asset.createdAt || asset.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const latestVariantAt = variants[0]?.createdAt || null;
  const latestProviderLeadAt = providerLeads.items?.[0]?.createdAt || null;

  const context = {
    property,
    pricing,
    mediaAssets,
    checklist,
    latestFlyer,
    latestReport,
    photoSummary,
    providerPromptCount,
    providerLeadCount: providerLeads.items?.length || 0,
    latestMediaAt,
    latestVariantAt,
    latestProviderLeadAt,
    variantCount: variants.length,
  };

  const rawState = buildRawStepStates(context, normalizedRole);
  const steps = rawState.steps;
  const requiredSteps = steps.filter((step) => step.isRequired);
  const completedRequiredSteps = requiredSteps.filter((step) => step.status === 'complete').length;
  const completionPercent = requiredSteps.length
    ? clampScore((completedRequiredSteps / requiredSteps.length) * 100)
    : 0;
  const marketReadyScore = computeMarketReadyScore({
    ...context,
    ...rawState,
  });
  const phases = buildPhaseSummary(steps);
  const nextStep = buildNextStep(steps);
  const recommendedStepKey = nextStep?.key || '';
  const stepsWithUxState = steps.map((step, index) => ({
    ...step,
    sequenceIndex: index + 1,
    uxStatus: mapStepStatusToUxStatus(step, recommendedStepKey),
  }));
  const currentPhase = nextStep?.phase || phases.find((phase) => phase.status !== 'complete')?.key || 'final_review';
  const currentStep = nextStep?.key || stepsWithUxState.at(-1)?.key || '';
  const statusSummary = buildStatusSummary(stepsWithUxState);
  const readinessSummary = buildReadinessSummary(marketReadyScore, completionPercent);

  return {
    propertyId,
    role: normalizedRole,
    currentPhase,
    currentPhaseLabel: PHASE_LABELS[currentPhase] || 'Workflow',
    currentStep,
    completionPercent,
    marketReadyScore,
    phases,
    steps: stepsWithUxState,
    nextStep,
    nextAction: nextStep
      ? {
          ...nextStep,
          uxStatus: 'recommended',
          sequenceIndex: stepsWithUxState.find((step) => step.key === nextStep.key)?.sequenceIndex || 1,
        }
      : null,
    statusSummary,
    readinessSummary,
    metrics: {
      photoCount: photoSummary.photoCount,
      roomCoverageCount: photoSummary.roomCoverageCount,
      listingCandidateCount: photoSummary.listingCandidateCount,
      preferredVariantCount: photoSummary.preferredVariantCount,
      checklistProgress: Number(checklist?.summary?.progressPercent || 0),
      providerLeadCount: providerLeads.items?.length || 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
