'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../../components/AppFrame';
import { PropertyLocationMap, ProviderResultsMap } from '../../../components/PropertyLocationMap';
import { Toast } from '../../../components/Toast';
import {
  analyzePricing,
  cancelImageEnhancementJob,
  createBillingCheckoutSession,
  createChecklistItem,
  createImageEnhancementJob,
  createProviderLead,
  createProviderReference,
  deleteProperty as deletePropertyRequest,
  deleteMediaAsset as deleteMediaAssetRequest,
  deleteMediaVariant as deleteMediaVariantRequest,
  deleteProviderReference,
  downloadFile,
  generateFlyer,
  generateReport,
  generateSocialPack,
  getImageEnhancementJob,
  getFlyerExportUrl,
  getLatestSocialPack,
  getPropertyFull,
  getProviderReferenceSheetExportUrl,
  getReportExportUrl,
  getWorkflow,
  listProviderLeads,
  listProviderReferences,
  listProviders,
  listImageEnhancementJobs,
  listMediaVariants,
  listVisionPresets,
  pruneVisionDrafts,
  savePhoto,
  saveVariantToPhotos,
  saveProvider,
  selectMediaVariant,
  setPropertyPricingDecision,
  updateChecklistItem,
  updateMediaAsset,
} from '../../../lib/api';
import { getStoredSession, setStoredSession } from '../../../lib/session';

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'photos', label: 'Photos' },
  { id: 'seller_picks', label: 'Seller Picks' },
  { id: 'brochure', label: 'Brochure' },
  { id: 'report', label: 'Report' },
  { id: 'checklist', label: 'Checklist' },
];
const HIDDEN_WORKSPACE_TABS = [{ id: 'vision', label: 'Vision workspace' }];

const PHOTO_IMPORT_SOURCE_OPTIONS = [
  { value: 'web_upload', label: 'Web upload' },
  { value: 'third_party_import', label: 'Third-party import' },
];

const PHOTO_VARIATIONS_PAGE_SIZE = 12;
const INITIAL_PHOTO_VARIATIONS_STATE = {
  assetId: '',
  variants: [],
  totalCount: 0,
  loadedCount: 0,
  isLoading: false,
  hasMore: false,
  error: '',
};

const PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS = new Set([
  'account_created',
  'profile_complete',
  'property_added',
]);
const DASHBOARD_FLASH_TOAST_KEY = 'worksideDashboardFlashToast';
const HOME_ADVISOR_GUIDE_STORAGE_KEY_PREFIX = 'workside.homeAdvisorGuide.hidden';

const REPORT_SECTION_OPTIONS = [
  { id: 'executive_summary', label: 'Executive Summary' },
  { id: 'pricing_analysis', label: 'Pricing Analysis' },
  { id: 'comparable_properties', label: 'Comparable Properties' },
  { id: 'photo_review', label: 'Photo Review Summary' },
  { id: 'visual_improvement_previews', label: 'Visual Improvement Previews' },
  { id: 'readiness_score', label: 'Readiness Score' },
  { id: 'improvement_recommendations', label: 'Improvement Recommendations' },
  { id: 'seller_checklist', label: 'Seller Checklist' },
  { id: 'marketing_guidance', label: 'Marketing Guidance' },
  { id: 'draft_listing_description', label: 'Draft Listing Description' },
];

const VISION_WORKFLOW_STAGES = [
  {
    key: 'clean',
    label: '1. Clean',
    title: 'Clean room',
    description: 'Remove furniture, declutter the room, and run a cleanup pass before changing finishes.',
    nextKey: 'finish',
    groups: [
      {
        key: 'clean_room',
        label: 'Clean room workflow',
        items: [
          'remove_furniture',
          'cleanup_empty_room',
          'declutter_light',
          'declutter_medium',
        ],
      },
    ],
    allowFreeform: false,
  },
  {
    key: 'finish',
    label: '2. Finishes',
    title: 'Buyer Appeal Previews',
    description:
      'Preview simple buyer-friendly finish directions like brighter walls and lighter, warmer, darker, or more neutral floors.',
    nextKey: 'style',
    groups: [
      {
        key: 'wall_color',
        label: 'Wall color previews',
        items: ['paint_warm_neutral', 'paint_bright_white', 'paint_soft_greige'],
      },
      {
        key: 'flooring',
        label: 'Floor tone previews',
        items: ['floor_light_wood', 'floor_medium_wood', 'floor_dark_hardwood', 'floor_lvp_neutral'],
      },
      {
        key: 'kitchen_upgrade',
        label: 'Kitchen upgrade concepts',
        items: [
          'kitchen_white_cabinets_granite',
          'kitchen_white_cabinets_quartz',
          'kitchen_green_cabinets_granite',
          'kitchen_green_cabinets_quartz',
        ],
      },
    ],
    allowFreeform: false,
  },
  {
    key: 'style',
    label: '3. Style',
    title: 'Style concept',
    description: 'Polish the current room version or try a guided natural-language concept request.',
    nextKey: 'final',
    groups: [
      {
        key: 'listing_enhancement',
        label: 'Listing polish',
        items: ['enhance_listing_quality', 'combined_listing_refresh'],
      },
      {
        key: 'exterior_upgrade',
        label: 'Exterior upgrade concepts',
        items: [
          'exterior_curb_appeal_refresh',
          'backyard_entertaining_refresh',
          'backyard_pool_preview',
        ],
      },
    ],
    allowFreeform: true,
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
const VISION_COMPLETION_SOUND_MIN_SECONDS = 15;
const VISION_JOB_RECOVERY_LOOKBACK_MS = 90 * 1000;
const VISION_JOB_RECOVERY_POLL_INTERVAL_MS = 4000;
const VISION_JOB_RECOVERY_TIMEOUT_MS = 45 * 1000;
const VISION_JOB_BACKGROUND_RECOVERY_TIMEOUT_MS = 10 * 60 * 1000;
const PHOTO_LIBRARY_CATEGORY_DEFINITIONS = [
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'living_room', label: 'Living Room' },
  { key: 'master_bedroom', label: 'Master Bedroom' },
  { key: 'master_bathroom', label: 'Master Bathroom' },
  { key: 'other', label: 'Other' },
  { key: 'exterior', label: 'Exterior' },
];
const DEFAULT_WORKSPACE_SECTION_STATE = {
  photos_import: true,
  photos_room_kitchen: true,
  photos_room_living_room: true,
  photos_room_master_bedroom: true,
  photos_room_master_bathroom: true,
  photos_room_other: false,
  photos_room_exterior: true,
  seller_picks_summary: true,
  brochure_controls: true,
  brochure_preview: true,
  brochure_social: false,
  report_builder: true,
  report_preview: true,
  checklist_tasks: true,
  checklist_summary: true,
  checklist_custom: false,
  checklist_providers: false,
};

function getVisionWorkflowStage(stageKey) {
  return (
    VISION_WORKFLOW_STAGES.find((stage) => stage.key === stageKey) || VISION_WORKFLOW_STAGES[0]
  );
}

function getVisionWorkflowStageForPreset(presetKey) {
  const normalizedPresetKey = String(presetKey || '').trim();
  if (!normalizedPresetKey) {
    return 'clean';
  }

  const matchingStage = VISION_WORKFLOW_STAGES.find((stage) =>
    stage.groups.some((group) => group.items.includes(normalizedPresetKey)),
  );

  return matchingStage?.key || 'style';
}

function getDefaultVisionPresetKeyForStage(stageKey) {
  const stage = getVisionWorkflowStage(stageKey);
  return stage.groups.flatMap((group) => group.items)[0] || 'remove_furniture';
}

function getNextVisionWorkflowStageKey(stageKey) {
  return getVisionWorkflowStage(stageKey).nextKey || 'final';
}

function buildAddressQuery(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

function buildGoogleMapsRouteUrl(property, comps = []) {
  const propertyAddress = buildAddressQuery(property);
  const compAddresses = (comps || [])
    .map((comp) => comp?.address)
    .filter(Boolean)
    .slice(0, 8);

  if (!propertyAddress) {
    return null;
  }

  if (!compAddresses.length) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propertyAddress)}`;
  }

  const [destination, ...waypoints] = compAddresses;
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', propertyAddress);
  url.searchParams.set('destination', destination);
  url.searchParams.set('travelmode', 'driving');

  if (waypoints.length) {
    url.searchParams.set('waypoints', waypoints.join('|'));
  }

  return url.toString();
}

function formatChecklistStatus(status) {
  if (status === 'in_progress') {
    return 'In progress';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'To do';
}

function formatChecklistCategory(category) {
  return String(category || 'custom')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatChecklistPriority(priority) {
  return `${String(priority || 'medium').replace(/\b\w/g, (character) => character.toUpperCase())} priority`;
}

function getPreferredVariantLabel(item) {
  return item?.variantLabel || 'Preferred vision variant';
}

function getVariantSummary(variant) {
  return (
    variant?.metadata?.summary ||
    variant?.metadata?.warning ||
    'This variant can be reviewed, marked preferred, and optionally used in brochure or report outputs.'
  );
}

function getVariantDisclaimer(variant) {
  if (variant?.metadata?.disclaimerType === 'concept_preview') {
    return 'AI visualizations are conceptual previews only. Actual condition, remodel results, and value impact may vary.';
  }

  return 'Enhanced images should stay truthful to the room and be reviewed before use in final marketing materials.';
}

function getVariantReviewScore(variant) {
  return Number(variant?.metadata?.review?.overallScore || 0);
}

function getAssetGenerationStageKey(asset) {
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

function getVariantCreatedAtTimestamp(variant) {
  const timestamp = new Date(
    variant?.updatedAt || variant?.createdAt || variant?.selectedAt || 0,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildDashboardFromSnapshot(snapshot = {}) {
  const latestPricing = snapshot?.pricingAnalyses?.latest || null;
  const latestFlyer = snapshot?.reports?.latestFlyer || null;
  const latestReport = snapshot?.reports?.latestReport || null;

  return {
    property: snapshot?.property || null,
    comps: latestPricing?.selectedComps || [],
    pricingSummary: latestPricing?.summary || '',
    flyer: latestFlyer,
    report: latestReport,
  };
}

function getVisionWorkflowStageKeyForVariant(variant) {
  return (
    variant?.metadata?.workflowStageKey ||
    getVisionWorkflowStageForPreset(variant?.metadata?.presetKey || variant?.variantType)
  );
}

function getNewestVisionVariants(variants = []) {
  return [...variants].sort(
    (left, right) => getVariantCreatedAtTimestamp(right) - getVariantCreatedAtTimestamp(left),
  );
}

function pickVisionWorkspaceVariantId(
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

function waitForDuration(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getMediaAssetCreatedAtTimestamp(asset) {
  const timestamp = new Date(asset?.updatedAt || asset?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDefaultVisionStageForAsset(asset) {
  if (asset?.assetType !== 'generated') {
    return 'clean';
  }

  const sourceStageKey = getAssetGenerationStageKey(asset);
  if (!sourceStageKey) {
    return 'clean';
  }

  return getNextVisionWorkflowStageKey(sourceStageKey);
}

function getMediaAssetPrimaryLabel(asset) {
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

function getMediaAssetBadges(asset) {
  const badges = [getMediaAssetPrimaryLabel(asset)];
  if (asset?.savedFromVision) {
    badges.push('Saved from Vision');
  }
  if (asset?.listingCandidate) {
    badges.push('Seller Pick');
  }
  return badges;
}

function getMediaAssetSummary(asset) {
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

function groupMediaAssetsByRoom(assets = []) {
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

function resolvePhotoLibraryCategoryKey(roomLabel = '') {
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

function buildPhotoCategoryGroups(assets = []) {
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

function readWorkspaceSectionState(storageKey) {
  if (typeof window === 'undefined' || !storageKey) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readBooleanWorkspacePreference(storageKey, fallbackValue = false) {
  if (typeof window === 'undefined' || !storageKey) {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (rawValue == null) {
      return fallbackValue;
    }

    return rawValue === 'true';
  } catch {
    return fallbackValue;
  }
}

function formatFreeformPlanHighlights(normalizedPlan) {
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

function getSocialPackVariantKey(variant, index = 0) {
  return `${variant?.format || 'variant'}-${variant?.width || 0}-${variant?.height || 0}-${index}`;
}

function getSocialPackVariantLabel(variant) {
  if (!variant) {
    return 'Social pack view';
  }

  return variant.width && variant.height
    ? `${variant.format} ${variant.width}x${variant.height}`
    : variant.format;
}

function buildSocialPackVariantDetails(pack, variant) {
  if (!pack || !variant) {
    return null;
  }

  const normalizedFormat = String(variant.format || '').toLowerCase();
  const sections = [];
  const highlights = [];

  if (variant.width && variant.height) {
    highlights.push(`${variant.width}x${variant.height} canvas`);
  }

  if (normalizedFormat.includes('square')) {
    highlights.push('Feed-ready layout');
    sections.push(
      { label: 'Headline', value: pack.headline },
      { label: 'Short caption', value: pack.shortCaption },
      { label: 'CTA', value: pack.cta },
    );
    return {
      title: getSocialPackVariantLabel(variant),
      summary: 'Use this for square feed placements, static ads, and simple hero-image posts.',
      guidance: variant.guidance,
      highlights,
      sections,
    };
  }

  if (normalizedFormat.includes('story') || normalizedFormat.includes('reel')) {
    highlights.push('Vertical motion-friendly');
    sections.push(
      { label: 'Headline', value: pack.headline },
      { label: 'Short caption', value: pack.shortCaption },
      { label: 'CTA', value: pack.cta },
    );
    return {
      title: getSocialPackVariantLabel(variant),
      summary: 'Use this for story, reel, or vertical placements where the opening frame and CTA need to land quickly.',
      guidance: variant.guidance,
      highlights,
      sections,
    };
  }

  if (normalizedFormat.includes('ad copy')) {
    highlights.push('Long-form copy block');
    sections.push(
      { label: 'Headline', value: pack.headline },
      { label: 'Primary text', value: pack.primaryText },
      { label: 'Short caption', value: pack.shortCaption },
      { label: 'Disclaimers', value: (pack.disclaimers || []).join(' ') },
    );
    return {
      title: getSocialPackVariantLabel(variant),
      summary: 'This is the copy reference view for ad drafting, approvals, and export review.',
      guidance: variant.guidance,
      highlights,
      sections,
    };
  }

  highlights.push('Call-to-action guidance');
  sections.push(
    { label: 'Primary CTA', value: pack.cta },
    { label: 'Short caption', value: pack.shortCaption },
    {
      label: 'Compliance reminder',
      value:
        pack.disclaimers?.[0] ||
        'Review generated copy and imagery before public advertising use.',
    },
  );
  return {
    title: getSocialPackVariantLabel(variant),
    summary: 'Use this to choose the CTA language and the supporting line you want to pair with it.',
    guidance: variant.guidance,
    highlights,
    sections,
  };
}

function formatWorkflowStatus(status) {
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

function buildPropertyAddressLabel(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

function buildProviderFallbackQuery(task, property) {
  const categoryQueryByKey = {
    inspector: 'home inspector',
    title_company: 'title company',
    real_estate_attorney: 'real estate attorney',
    photographer: 'real estate photographer',
    cleaning_service: 'house cleaning service',
    termite_inspection: 'termite inspection',
    notary: 'mobile notary',
    nhd_report: 'natural hazard disclosure report provider',
    staging_company: 'home staging company',
  };
  const categoryLabel =
    categoryQueryByKey[task?.providerCategoryKey] || task?.providerCategoryLabel || task?.title || 'home services';
  const addressLabel = buildPropertyAddressLabel(property);
  const fallbackLocationLabel = [property?.city, property?.state, property?.zip].filter(Boolean).join(', ');
  return [categoryLabel, addressLabel || fallbackLocationLabel || 'this property']
    .filter(Boolean)
    .join(' ');
}

function formatProviderStatusLabel(status) {
  return String(status || 'unavailable')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatProviderLeadStatusLabel(status) {
  return formatProviderStatusLabel(status || 'open');
}

function formatDateTimeLabel(value) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString();
}

function formatProviderReferenceAccessLabel(reference) {
  if (reference?.websiteUrl) {
    try {
      return new URL(reference.websiteUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'Website available';
    }
  }

  if (reference?.mapsUrl) {
    return reference?.source === 'google_maps' ? 'Google Maps reference saved' : 'Maps link available';
  }

  return 'Contact details not listed';
}

function buildProviderCoverageGuidance(providerSuggestionTask, providerSource) {
  if (!providerSuggestionTask) {
    return null;
  }

  const categoryLabel =
    providerSource?.categoryLabel ||
    providerSuggestionTask.providerCategoryLabel ||
    providerSuggestionTask.title ||
    'providers';
  const categoryLabelLower = categoryLabel.toLowerCase();
  const liveCount = Number(providerSource?.internalProviders || 0);
  const unavailableCount = Number(providerSource?.unavailableProviders || 0);
  const externalCount = Number(providerSource?.externalProviders || 0);
  const totalMatches = Number(providerSource?.totalCategoryProviders || 0);
  const fallback = providerSource?.googleFallback || null;
  const fallbackEnabled = Boolean(providerSource?.googleFallbackEnabled || fallback?.enabled);

  if (liveCount > 0) {
    return null;
  }

  if (unavailableCount > 0) {
    const statusCounts = Object.entries(providerSource?.unavailableStatusCounts || {})
      .map(([status, count]) => `${count} ${formatProviderStatusLabel(status).toLowerCase()}`)
      .join(', ');

    return {
      tone: 'setup',
      eyebrow: 'Coverage status',
      title: `No live ${categoryLabelLower} yet`,
      message: `Workside found matching providers for this property, but they are still completing onboarding and marketplace setup.`,
      highlights: [
        `${unavailableCount} matching provider${unavailableCount === 1 ? '' : 's'} still in setup`,
        statusCounts || null,
        fallbackEnabled ? 'Google fallback is ready for backup search' : 'Google fallback is not available in this session',
      ].filter(Boolean),
      nextStep: fallbackEnabled
        ? 'Use Google fallback or the live map search below if you need an outside option before these providers go live.'
        : 'These providers should appear here automatically once they are approved and fully live.',
    };
  }

  if (fallback?.triggered && fallback.status === 'results' && externalCount > 0) {
    return {
      tone: 'fallback',
      eyebrow: 'Marketplace gap',
      title: `No live Workside ${categoryLabelLower} for this property`,
      message: `There is not yet active marketplace coverage for this category at this address, so the workspace loaded outside local options from Google fallback below.`,
      highlights: [
        `${externalCount} Google fallback result${externalCount === 1 ? '' : 's'} loaded`,
        fallback.locationLabel ? `Search area: ${fallback.locationLabel}` : null,
        fallback.queryUsed ? `Query: ${fallback.queryUsed}` : null,
      ].filter(Boolean),
      nextStep: 'Review the fallback contacts below, save the best ones to the provider sheet, and keep the task moving while marketplace coverage grows.',
    };
  }

  if (fallback?.triggered && fallback.status === 'no_results') {
    return {
      tone: 'empty',
      eyebrow: 'Search result',
      title: `No nearby ${categoryLabelLower} were found in fallback search`,
      message: `Workside does not have live coverage here yet, and Google fallback did not return structured nearby results for this request.`,
      highlights: [
        fallback.locationLabel ? `Search area: ${fallback.locationLabel}` : null,
        fallback.queryUsed ? `Query: ${fallback.queryUsed}` : null,
        'Open the live map search below for a broader manual search',
      ].filter(Boolean),
      nextStep: 'If you still need coverage, open the map search below and save any promising outside contacts to the provider reference sheet.',
    };
  }

  if (fallback?.triggered && fallback.status === 'error') {
    return {
      tone: 'warning',
      eyebrow: 'Search issue',
      title: `Google fallback could not finish for ${categoryLabelLower}`,
      message:
        fallback.diagnostic ||
        'The workspace could not complete the outside-provider search right now, so only marketplace coverage is shown.',
      highlights: [
        totalMatches > 0
          ? `${totalMatches} Workside provider record${totalMatches === 1 ? '' : 's'} matched overall`
          : 'No matching Workside provider records in coverage yet',
        'You can still open the live map search below',
      ],
      nextStep: 'Try the fallback search again or continue with the live map search while we improve marketplace coverage.',
    };
  }

  if (fallbackEnabled) {
    return {
      tone: 'coverage',
      eyebrow: 'Marketplace gap',
      title: `No live Workside ${categoryLabelLower} for this property`,
      message: `This task does not yet have active marketplace coverage at the property location, but you can broaden the search with Google fallback or the live map search below.`,
      highlights: [
        totalMatches > 0
          ? `${totalMatches} Workside provider record${totalMatches === 1 ? '' : 's'} matched, but none are live here`
          : 'No matching Workside provider records in this coverage area yet',
        'Google fallback is available on demand',
      ],
      nextStep: 'Use the fallback actions below to keep the checklist moving while Workside coverage fills in.',
    };
  }

  return {
    tone: 'coverage',
    eyebrow: 'Marketplace gap',
    title: `No live ${categoryLabelLower} are available here yet`,
    message: `This property does not currently have marketplace coverage for this task, and Google fallback is not configured for this session.`,
    highlights: [
      totalMatches > 0
        ? `${totalMatches} Workside provider record${totalMatches === 1 ? '' : 's'} matched, but none are live here`
        : 'No matching Workside provider records in this coverage area yet',
    ],
    nextStep: 'You can keep moving with the rest of the checklist now, then revisit this step when provider coverage expands.',
  };
}

function buildProviderSourceSummary(providerSource) {
  if (!providerSource) {
    return '';
  }

  const totalMatches = Number(providerSource.totalCategoryProviders || 0);
  const liveMatches = Number(providerSource.internalProviders || 0);
  const unavailableMatches = Number(providerSource.unavailableProviders || 0);
  const externalMatches = Number(providerSource.externalProviders || 0);
  const parts = [];

  if (totalMatches > 0) {
    parts.push(
      `${totalMatches} matching Workside provider record(s): ${liveMatches} live${unavailableMatches ? ` · ${unavailableMatches} still in setup` : ''}`,
    );
  } else {
    parts.push('No Workside provider records match this category and coverage yet');
  }

  if (externalMatches > 0) {
    parts.push(`${externalMatches} external Google fallback result(s) loaded separately`);
  } else if (providerSource.googleFallbackEnabled) {
    parts.push('Google fallback available if you want broader local search');
  } else {
    parts.push('Google fallback unavailable for this browser session');
  }

  return parts.join(' · ');
}

function buildGoogleFallbackSummary(providerSource) {
  const fallback = providerSource?.googleFallback || null;
  if (!fallback?.enabled) {
    return 'Google fallback is not configured yet, so this workspace can only show Workside marketplace coverage.';
  }

  if (!fallback.triggered) {
    return 'Google fallback is available if you want to broaden the search beyond Workside providers.';
  }

  if (fallback.status === 'results') {
    return `Google fallback found ${fallback.resultCount || 0} result(s) using ${fallback.searchMode === 'places_legacy_textsearch' ? 'legacy text search' : 'Places search'}${fallback.queryUsed ? ` for "${fallback.queryUsed}"` : ''}.`;
  }

  if (fallback.status === 'no_results') {
    return `Google fallback did not return structured results${fallback.locationLabel ? ` near ${fallback.locationLabel}` : ''}${fallback.queryUsed ? ` for "${fallback.queryUsed}"` : ''}.`;
  }

  if (fallback.status === 'error') {
    return fallback.diagnostic || 'Google fallback search could not be completed at this time.';
  }

  return providerSource?.googleFallbackDiagnostic || 'Google fallback is available on demand.';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file?.name || 'file'}.`));
    reader.readAsDataURL(file);
  });
}

export function PropertyWorkspaceClient({ propertyId, mapsApiKey = '' }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const flyerPreviewRef = useRef(null);
  const reportPreviewRef = useRef(null);
  const visionCompareRef = useRef(null);
  const visionCurrentActionRef = useRef(null);
  const lastVisionAssetResetRef = useRef('');
  const propertySnapshotRefreshPromiseRef = useRef(null);
  const workspaceBodyMainRef = useRef(null);
  const providerSuggestionsRef = useRef(null);
  const visionCompletionAudioContextRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [property, setProperty] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [latestPricing, setLatestPricing] = useState(null);
  const [latestFlyer, setLatestFlyer] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [latestSocialPack, setLatestSocialPack] = useState(null);
  const [activeSocialPackVariantKey, setActiveSocialPackVariantKey] = useState('');
  const [mediaAssets, setMediaAssets] = useState([]);
  const [mediaVariants, setMediaVariants] = useState([]);
  const [visionPresets, setVisionPresets] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [latestGeneratedVariantId, setLatestGeneratedVariantId] = useState('');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('');
  const [workflowSourceVariantId, setWorkflowSourceVariantId] = useState('');
  const [activeVisionWorkflowStageKey, setActiveVisionWorkflowStageKey] = useState('clean');
  const [activeVisionPresetKey, setActiveVisionPresetKey] = useState('remove_furniture');
  const [flyerType, setFlyerType] = useState('sale');
  const [flyerHeadlineDraft, setFlyerHeadlineDraft] = useState('');
  const [flyerSubheadlineDraft, setFlyerSubheadlineDraft] = useState('');
  const [flyerSummaryDraft, setFlyerSummaryDraft] = useState('');
  const [flyerCallToActionDraft, setFlyerCallToActionDraft] = useState('');
  const [flyerSelectedPhotoIds, setFlyerSelectedPhotoIds] = useState([]);
  const [reportTitleDraft, setReportTitleDraft] = useState('');
  const [reportExecutiveSummaryDraft, setReportExecutiveSummaryDraft] = useState('');
  const [reportListingDescriptionDraft, setReportListingDescriptionDraft] = useState('');
  const [reportSelectedPhotoIds, setReportSelectedPhotoIds] = useState([]);
  const [reportIncludedSections, setReportIncludedSections] = useState(
    REPORT_SECTION_OPTIONS.map((section) => section.id),
  );
  const [selectedListPriceDraft, setSelectedListPriceDraft] = useState('');
  const [selectedListPriceSourceDraft, setSelectedListPriceSourceDraft] = useState('recommended_mid');
  const [photoImportSource, setPhotoImportSource] = useState('web_upload');
  const [photoImportRoomLabel, setPhotoImportRoomLabel] = useState('Living room');
  const [photoImportNotes, setPhotoImportNotes] = useState('');
  const [freeformEnhancementInstructions, setFreeformEnhancementInstructions] = useState('');
  const [customChecklistTitle, setCustomChecklistTitle] = useState('');
  const [customChecklistDetail, setCustomChecklistDetail] = useState('');
  const [providerRecommendations, setProviderRecommendations] = useState([]);
  const [unavailableProviderRecommendations, setUnavailableProviderRecommendations] = useState([]);
  const [externalProviderRecommendations, setExternalProviderRecommendations] = useState([]);
  const [providerReferences, setProviderReferences] = useState([]);
  const [providerLeads, setProviderLeads] = useState([]);
  const [providerSource, setProviderSource] = useState(null);
  const [showExternalProviderFallback, setShowExternalProviderFallback] = useState(false);
  const [activeProviderDetails, setActiveProviderDetails] = useState(null);
  const [showProviderMap, setShowProviderMap] = useState(false);
  const [providerMapScope, setProviderMapScope] = useState('internal');
  const [providerMapDensity, setProviderMapDensity] = useState('compact');
  const [activeProviderTaskKey, setActiveProviderTaskKey] = useState('');
  const [providerSearchStatus, setProviderSearchStatus] = useState('');
  const [showMoreVisionVariants, setShowMoreVisionVariants] = useState(false);
  const [showVisionHistory, setShowVisionHistory] = useState(false);
  const [showVisionPhotoPicker, setShowVisionPhotoPicker] = useState(false);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState(null);
  const [pendingDeleteVisionVariant, setPendingDeleteVisionVariant] = useState(null);
  const [pendingPruneVisionDrafts, setPendingPruneVisionDrafts] = useState(null);
  const [showExpandedMap, setShowExpandedMap] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState(null);
  const [pendingDeleteProperty, setPendingDeleteProperty] = useState(null);
  const [activePhotoDetailsAsset, setActivePhotoDetailsAsset] = useState(null);
  const [activePhotoVariationsAssetId, setActivePhotoVariationsAssetId] = useState('');
  const [photoVariationsState, setPhotoVariationsState] = useState(INITIAL_PHOTO_VARIATIONS_STATE);
  const [isSelectingPhotoVariations, setIsSelectingPhotoVariations] = useState(false);
  const [selectedPhotoVariationIds, setSelectedPhotoVariationIds] = useState([]);
  const [pendingDeletePhotoVariationIds, setPendingDeletePhotoVariationIds] = useState([]);
  const [photoVariationSortKey, setPhotoVariationSortKey] = useState('date');
  const [photoVariationSortDirection, setPhotoVariationSortDirection] = useState('desc');
  const [guidedWorkflow, setGuidedWorkflow] = useState(null);
  const [workflowPreviewStepKey, setWorkflowPreviewStepKey] = useState('');
  const [checklistSummaryMode, setChecklistSummaryMode] = useState('open');
  const [workspaceSectionState, setWorkspaceSectionState] = useState({});
  const [isHomeAdvisorGuideHidden, setIsHomeAdvisorGuideHidden] = useState(false);
  const [pendingWorkspaceScrollTarget, setPendingWorkspaceScrollTarget] = useState('');
  const [pendingChecklistFocusTarget, setPendingChecklistFocusTarget] = useState('');
  const [status, setStatus] = useState('Loading property workspace...');
  const [toast, setToast] = useState(null);
  const [visionGenerationState, setVisionGenerationState] = useState(null);
  const [visionGenerationElapsedSeconds, setVisionGenerationElapsedSeconds] = useState(0);
  const [visionRecoveryState, setVisionRecoveryState] = useState(null);
  const [visionCancellationPending, setVisionCancellationPending] = useState(false);
  const viewerRole = useMemo(() => {
    const session = getStoredSession();
    return session?.user?.role === 'agent' ? 'agent' : 'seller';
  }, []);
  const viewerIdentityKey = useMemo(() => {
    const session = getStoredSession();
    return (
      session?.user?.id ||
      session?.user?.email ||
      session?.user?.phone ||
      viewerRole
    );
  }, [viewerRole]);
  const workspaceSectionStorageKey = useMemo(
    () => `workside.workspace.sections.${viewerIdentityKey}.${propertyId}`,
    [propertyId, viewerIdentityKey],
  );
  const homeAdvisorGuideStorageKey = useMemo(
    () => `${HOME_ADVISOR_GUIDE_STORAGE_KEY_PREFIX}.${viewerIdentityKey}.${propertyId}`,
    [propertyId, viewerIdentityKey],
  );

  useEffect(() => {
    setWorkspaceSectionState(readWorkspaceSectionState(workspaceSectionStorageKey));
  }, [workspaceSectionStorageKey]);

  useEffect(() => {
    setIsHomeAdvisorGuideHidden(
      readBooleanWorkspacePreference(homeAdvisorGuideStorageKey, false),
    );
  }, [homeAdvisorGuideStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !workspaceSectionStorageKey) {
      return;
    }

    try {
      window.localStorage.setItem(
        workspaceSectionStorageKey,
        JSON.stringify(workspaceSectionState),
      );
    } catch {}
  }, [workspaceSectionState, workspaceSectionStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !homeAdvisorGuideStorageKey) {
      return;
    }

    try {
      window.localStorage.setItem(
        homeAdvisorGuideStorageKey,
        String(isHomeAdvisorGuideHidden),
      );
    } catch {}
  }, [homeAdvisorGuideStorageKey, isHomeAdvisorGuideHidden]);

  function isWorkspaceSectionOpen(sectionKey, defaultOpen = true) {
    if (Object.prototype.hasOwnProperty.call(workspaceSectionState, sectionKey)) {
      return Boolean(workspaceSectionState[sectionKey]);
    }
    return defaultOpen;
  }

  function setWorkspaceSectionOpen(sectionKey, nextValue, defaultOpen = true) {
    setWorkspaceSectionState((current) => ({
      ...current,
      [sectionKey]:
        typeof nextValue === 'function'
          ? nextValue(
              Object.prototype.hasOwnProperty.call(current, sectionKey)
                ? Boolean(current[sectionKey])
                : defaultOpen,
            )
          : Boolean(nextValue),
    }));
  }

  useEffect(() => {
    if (!visionGenerationState?.startedAt) {
      setVisionGenerationElapsedSeconds(0);
      return undefined;
    }

    const updateElapsedSeconds = () => {
      setVisionGenerationElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - visionGenerationState.startedAt) / 1000)),
      );
    };

    updateElapsedSeconds();
    const timer = window.setInterval(updateElapsedSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [visionGenerationState]);

  useEffect(() => {
    if (!visionRecoveryState?.jobId || !visionRecoveryState.assetId) {
      return undefined;
    }

    let cancelled = false;

    async function pollRecoveredVisionJob() {
      const deadline = Date.now() + VISION_JOB_BACKGROUND_RECOVERY_TIMEOUT_MS;

      while (!cancelled && Date.now() < deadline) {
        await waitForDuration(VISION_JOB_RECOVERY_POLL_INTERVAL_MS);
        if (cancelled) {
          return;
        }

        try {
          const jobResponse = await getImageEnhancementJob(visionRecoveryState.jobId);
          const latestJob = jobResponse.job;
          if (!latestJob) {
            continue;
          }

          if (
            latestJob.status !== 'completed' &&
            latestJob.status !== 'failed' &&
            latestJob.status !== 'cancelled'
          ) {
            continue;
          }

          try {
            const settledJob = await reconcileRecoveredVisionJob(
              latestJob,
              visionRecoveryState.assetId,
            );

            if (cancelled) {
              return;
            }

            if (visionRecoveryState.mode === 'freeform') {
              setShowMoreVisionVariants(true);
              setActiveVisionPresetKey(
                settledJob?.presetKey ||
                  settledJob?.variants?.[0]?.metadata?.presetKey ||
                  settledJob?.variants?.[0]?.variantType ||
                  'combined_listing_refresh',
              );
            } else if (visionRecoveryState.presetKey) {
              setActiveVisionPresetKey(visionRecoveryState.presetKey);
              setActiveVisionWorkflowStageKey(
                visionRecoveryState.workflowStageKey ||
                  getVisionWorkflowStageForPreset(visionRecoveryState.presetKey),
              );
            }

            const completionToast = buildVisionCompletionToast({
              job: settledJob,
              successTitle: visionRecoveryState.successTitle,
              successMessage: visionRecoveryState.successMessage,
              warningTitle: 'Preview ready with warning',
            });
            setToast(completionToast);
            if (completionToast.nextVariantId) {
              setLatestGeneratedVariantId(completionToast.nextVariantId);
            }
            if (completionToast.shouldScroll) {
              requestAnimationFrame(() => {
                visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
            }
            void playVisionCompletionSound({
              tone: 'success',
              elapsedSeconds: getVisionGenerationDurationSeconds(visionRecoveryState.startedAt),
            });
          } catch (recoveryError) {
            if (cancelled) {
              return;
            }
            setToast({
              tone: 'error',
              title: visionRecoveryState.failureTitle,
              message: `${recoveryError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
              autoDismissMs: 0,
            });
            void playVisionCompletionSound({
              tone: 'error',
              elapsedSeconds: getVisionGenerationDurationSeconds(visionRecoveryState.startedAt),
            });
          } finally {
            if (!cancelled) {
              setVisionRecoveryState(null);
              setVisionGenerationState(null);
              setVisionCancellationPending(false);
              setStatus('');
            }
          }

          return;
        } catch (pollError) {
          if (cancelled) {
            return;
          }
        }
      }

      if (!cancelled) {
        setToast({
          tone: 'error',
          title: visionRecoveryState.failureTitle,
          message:
            'The browser request disconnected and the vision job did not finish within the recovery window. No new variant was selected, so the compare view is still showing the last successful preview.',
          autoDismissMs: 0,
        });
        void playVisionCompletionSound({
          tone: 'error',
          elapsedSeconds: getVisionGenerationDurationSeconds(visionRecoveryState.startedAt),
        });
        setVisionRecoveryState(null);
        setVisionGenerationState(null);
        setVisionCancellationPending(false);
        setStatus('');
      }
    }

    void pollRecoveredVisionJob();

    return () => {
      cancelled = true;
    };
  }, [visionRecoveryState]);

  useEffect(() => {
    if (!selectedMediaAssetId) {
      lastVisionAssetResetRef.current = '';
      setMediaVariants([]);
      return;
    }
    if (lastVisionAssetResetRef.current === selectedMediaAssetId) {
      return;
    }
    const nextSelectedAsset =
      mediaAssets.find((asset) => asset.id === selectedMediaAssetId) || null;
    const nextStageKey = getDefaultVisionStageForAsset(nextSelectedAsset);
    lastVisionAssetResetRef.current = selectedMediaAssetId;
    setMediaVariants([]);
    setSelectedVariantId('');
    setWorkflowSourceVariantId('');
    setActiveVisionWorkflowStageKey(nextStageKey);
    setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(nextStageKey));
    setShowVisionHistory(false);
    setShowVisionPhotoPicker(false);
    setShowMoreVisionVariants(false);
    setLatestGeneratedVariantId('');
    setVisionRecoveryState(null);
    setVisionGenerationState(null);
    setVisionCancellationPending(false);
  }, [mediaAssets, selectedMediaAssetId]);

  useEffect(() => {
    if (
      workflowSourceVariantId &&
      !mediaVariants.some((variant) => variant.id === workflowSourceVariantId)
    ) {
      setWorkflowSourceVariantId('');
    }
  }, [mediaVariants, workflowSourceVariantId]);

  useEffect(() => {
    if (
      latestGeneratedVariantId &&
      !mediaVariants.some((variant) => variant.id === latestGeneratedVariantId)
    ) {
      setLatestGeneratedVariantId('');
    }
  }, [latestGeneratedVariantId, mediaVariants]);

  useEffect(() => {
    const stagePresetKeys = getVisionWorkflowStage(activeVisionWorkflowStageKey).groups.flatMap(
      (group) => group.items,
    );
    if (!stagePresetKeys.length) {
      return;
    }

    if (!stagePresetKeys.includes(activeVisionPresetKey)) {
      setActiveVisionPresetKey(stagePresetKeys[0]);
    }
  }, [activeVisionPresetKey, activeVisionWorkflowStageKey]);

  useEffect(
    () => () => {
      const audioContext = visionCompletionAudioContextRef.current;
      if (audioContext && typeof audioContext.close === 'function') {
        audioContext.close().catch(() => {});
      }
    },
    [],
  );

  async function primeVisionCompletionAudio() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    let audioContext = visionCompletionAudioContextRef.current;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContextConstructor();
      visionCompletionAudioContextRef.current = audioContext;
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {
        return audioContext;
      }
    }

    return audioContext;
  }

  function getVisionGenerationDurationSeconds(startedAt) {
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  }

  function matchesVisionJobRequest(job, { presetKey = '', mode = 'preset', startedAt = 0 } = {}) {
    const jobCreatedAt = new Date(job?.createdAt || 0).getTime();
    if (!jobCreatedAt || jobCreatedAt < startedAt - VISION_JOB_RECOVERY_LOOKBACK_MS) {
      return false;
    }

    if (mode === 'freeform') {
      return job?.mode === 'freeform';
    }

    return String(job?.presetKey || job?.jobType || '') === String(presetKey || '');
  }

  async function recoverVisionJobAfterDisconnect({
    assetId,
    presetKey = '',
    mode = 'preset',
    startedAt = 0,
  }) {
    const jobListResponse = await listImageEnhancementJobs(assetId, 8);
    const matchingJob = (jobListResponse.jobs || []).find((job) =>
      matchesVisionJobRequest(job, { presetKey, mode, startedAt }),
    );

    if (!matchingJob) {
      return null;
    }

    if (matchingJob.status === 'completed' || matchingJob.status === 'failed') {
      return matchingJob;
    }

    const deadline = Date.now() + VISION_JOB_RECOVERY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await waitForDuration(VISION_JOB_RECOVERY_POLL_INTERVAL_MS);
      const jobResponse = await getImageEnhancementJob(matchingJob.id);
      const latestJob = jobResponse.job;
      if (!latestJob) {
        continue;
      }
      if (latestJob.status === 'completed' || latestJob.status === 'failed') {
        return latestJob;
      }
    }

    return matchingJob;
  }

  function resolveVisionResultVariantId(job, variant = null) {
    return variant?.id || job?.selectedVariantId || job?.variants?.[0]?.id || '';
  }

  function buildVisionCompletionToast({
    job,
    variant = null,
    successTitle,
    successMessage,
    warningTitle = 'Preview ready with warning',
  }) {
    const nextVariantId = resolveVisionResultVariantId(job, variant);
    const isAdvisorOnly = job?.fallbackMode === 'advisor_only' || !nextVariantId;

    if (isAdvisorOnly) {
      return {
        tone: 'warning',
        title: 'No strong visual change detected',
        message:
          job?.warning ||
          job?.message ||
          'The room may already present well, or the requested change was too subtle to preview reliably.',
        autoDismissMs: 0,
        shouldScroll: false,
        nextVariantId: '',
      };
    }

    return {
      tone: job?.warning ? 'warning' : 'success',
      title: job?.warning ? warningTitle : successTitle,
      message: job?.warning || successMessage,
      autoDismissMs: job?.warning ? 0 : 9000,
      shouldScroll: true,
      nextVariantId,
    };
  }

  async function reconcileRecoveredVisionJob(job, fallbackAssetId) {
    if (!job) {
      return null;
    }

    if (job.status === 'completed') {
      const nextAssetId = fallbackAssetId || selectedMediaAsset?.id || selectedMediaAssetId;
      await Promise.all([
        refreshMediaAssets(nextAssetId),
        refreshMediaVariants(nextAssetId),
        refreshWorkflow(),
      ]);
      const nextVariantId = resolveVisionResultVariantId(job);
      if (nextVariantId) {
        setSelectedVariantId(nextVariantId);
      }
      return job;
    }

    if (job.status === 'failed') {
      const failureMessage = job.warning || job.message || 'The vision job failed before producing a usable variant.';
      throw new Error(failureMessage);
    }

    if (job.status === 'cancelled') {
      throw new Error(job.message || 'The vision job was cancelled before a new preview was saved.');
    }

    throw new Error(
      'The request disconnected before the vision job finished. Please retry once the current generation has cleared.',
    );
  }

  async function playVisionCompletionSound({ tone = 'success', elapsedSeconds = 0 } = {}) {
    if (elapsedSeconds < VISION_COMPLETION_SOUND_MIN_SECONDS) {
      return;
    }

    const audioContext = await primeVisionCompletionAudio();
    if (!audioContext || audioContext.state !== 'running') {
      return;
    }

    const notePattern =
      tone === 'error'
        ? [
            { frequency: 415.3, duration: 0.08, gain: 0.028, delay: 0 },
            { frequency: 329.6, duration: 0.12, gain: 0.026, delay: 0.13 },
          ]
        : [
            { frequency: 659.3, duration: 0.08, gain: 0.03, delay: 0 },
            { frequency: 783.99, duration: 0.12, gain: 0.032, delay: 0.13 },
          ];

    for (const note of notePattern) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const startTime = audioContext.currentTime + note.delay;
      const endTime = startTime + note.duration;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, startTime);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.02);
    }
  }

  function beginVisionRecovery({
    job,
    assetId,
    mode = 'preset',
    presetKey = '',
    workflowStageKey = '',
    startedAt = 0,
    successTitle = 'Vision job recovered',
    successMessage = 'The browser lost the original request, but the vision job finished and the generated variant has been recovered.',
    failureTitle = 'Variant generation failed',
  }) {
    if (!job?.id || !assetId) {
      return;
    }

    setVisionRecoveryState({
      jobId: job.id,
      assetId,
      mode,
      presetKey,
      workflowStageKey,
      startedAt,
      successTitle,
      successMessage,
      failureTitle,
    });
    setStatus('Recovering vision job...');
    setVisionGenerationState((current) =>
      current
        ? {
            ...current,
            detail:
              'The browser connection dropped, but the server job is still running. We are checking for the finished result now.',
          }
        : current,
    );
    setToast({
      tone: 'info',
      title: 'Recovering vision job',
      message:
        'The browser connection dropped, but the server job is still running. This workspace will update as soon as the result is ready.',
      autoDismissMs: 9000,
    });
  }

  async function handleCancelVisionGeneration() {
    const activeJobId = visionRecoveryState?.jobId;
    if (!activeJobId || visionCancellationPending) {
      return;
    }

    setVisionCancellationPending(true);
    try {
      const response = await cancelImageEnhancementJob(activeJobId);
      setVisionRecoveryState(null);
      setVisionGenerationState(null);
      setStatus('');
      setToast({
        tone: 'warning',
        title: 'Generation cancelled',
        message:
          response.job?.message ||
          'The background vision job was cancelled before a new preview was selected.',
        autoDismissMs: 7000,
      });
    } catch (error) {
      setToast({
        tone: 'error',
        title: 'Cancel failed',
        message: error.message || 'We could not cancel the running vision job.',
        autoDismissMs: 0,
      });
    } finally {
      setVisionCancellationPending(false);
    }
  }

  const propertyFullQuery = useQuery({
    queryKey: ['property-full', propertyId],
    enabled: Boolean(propertyId),
    queryFn: async () => getPropertyFull(propertyId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const liveMediaVariantsQuery = useQuery({
    queryKey: ['property-media-variants', selectedMediaAssetId || ''],
    enabled: Boolean(selectedMediaAssetId),
    queryFn: async () => {
      const response = await listMediaVariants(selectedMediaAssetId);
      return response.variants || [];
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const workflowQuery = useQuery({
    queryKey: ['property-workflow', propertyId, viewerRole],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const response = await getWorkflow(propertyId, viewerRole);
      return response.workflow;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const selectedMediaAsset = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedMediaAssetId) || mediaAssets[0] || null,
    [mediaAssets, selectedMediaAssetId],
  );
  const resolvedActivePhotoDetailsAsset = useMemo(() => {
    if (!activePhotoDetailsAsset?.id) {
      return null;
    }

    return (
      mediaAssets.find((asset) => asset.id === activePhotoDetailsAsset.id) ||
      activePhotoDetailsAsset
    );
  }, [activePhotoDetailsAsset, mediaAssets]);
  const resolvedActivePhotoVariationsAsset = useMemo(() => {
    if (!activePhotoVariationsAssetId) {
      return null;
    }

    return mediaAssets.find((asset) => asset.id === activePhotoVariationsAssetId) || null;
  }, [activePhotoVariationsAssetId, mediaAssets]);
  const listingCandidateAssets = useMemo(
    () => mediaAssets.filter((asset) => asset.listingCandidate),
    [mediaAssets],
  );
  const photoCategoryGroups = useMemo(() => buildPhotoCategoryGroups(mediaAssets), [mediaAssets]);
  const sellerPickCategoryGroups = useMemo(
    () => buildPhotoCategoryGroups(listingCandidateAssets).filter((group) => group.assets.length),
    [listingCandidateAssets],
  );
  const selectedMediaAssetPhotoCategory = useMemo(
    () =>
      photoCategoryGroups.find((group) =>
        group.assets.some((asset) => asset.id === selectedMediaAsset?.id),
      ) || null,
    [photoCategoryGroups, selectedMediaAsset?.id],
  );
  const firstPopulatedPhotoCategoryKey = useMemo(
    () => photoCategoryGroups.find((group) => group.assets.length)?.key || photoCategoryGroups[0]?.key || '',
    [photoCategoryGroups],
  );
  const mediaAssetGroups = useMemo(() => groupMediaAssetsByRoom(mediaAssets), [mediaAssets]);
  const brochurePhotoPool = useMemo(
    () => (listingCandidateAssets.length ? listingCandidateAssets : mediaAssets),
    [listingCandidateAssets, mediaAssets],
  );
  const reportPhotoPool = useMemo(() => mediaAssets, [mediaAssets]);
  const preferredVisionVariant = useMemo(
    () => mediaVariants.find((variant) => variant.isSelected) || null,
    [mediaVariants],
  );
  const stageScopedVisionVariants = useMemo(() => {
    const stageVariants = mediaVariants.filter(
      (variant) => getVisionWorkflowStageKeyForVariant(variant) === activeVisionWorkflowStageKey,
    );
    return getNewestVisionVariants(stageVariants.length ? stageVariants : mediaVariants);
  }, [activeVisionWorkflowStageKey, mediaVariants]);
  const defaultVisionWorkspaceVariantId = useMemo(
    () =>
      pickVisionWorkspaceVariantId(mediaVariants, {
        currentVariantId: selectedVariantId,
        stageKey: activeVisionWorkflowStageKey,
        sourceVariantId: workflowSourceVariantId,
      }),
    [activeVisionWorkflowStageKey, mediaVariants, selectedVariantId, workflowSourceVariantId],
  );
  const resolvedSelectedVariantId = useMemo(() => {
    if (selectedVariantId && mediaVariants.some((variant) => variant.id === selectedVariantId)) {
      return selectedVariantId;
    }
    return defaultVisionWorkspaceVariantId;
  }, [defaultVisionWorkspaceVariantId, mediaVariants, selectedVariantId]);
  const selectedVariant = useMemo(
    () =>
      mediaVariants.find(
        (variant) => variant.id === resolvedSelectedVariantId,
      ) || null,
    [mediaVariants, resolvedSelectedVariantId],
  );
  const latestGeneratedVariant = useMemo(
    () => mediaVariants.find((variant) => variant.id === latestGeneratedVariantId) || null,
    [latestGeneratedVariantId, mediaVariants],
  );
  const workflowSourceVariant = useMemo(
    () =>
      mediaVariants.find((variant) => variant.id === workflowSourceVariantId) ||
      null,
    [mediaVariants, workflowSourceVariantId],
  );
  const selectedVariantSourceVariant = useMemo(
    () =>
      mediaVariants.find(
        (variant) => variant.id === String(selectedVariant?.metadata?.sourceVariantId || ''),
      ) || null,
    [mediaVariants, selectedVariant?.metadata?.sourceVariantId],
  );
  const savedAssetForSelectedVariant = useMemo(
    () =>
      mediaAssets.find(
        (asset) => String(asset?.sourceVariantId || '') === String(selectedVariant?.id || ''),
      ) || null,
    [mediaAssets, selectedVariant?.id],
  );
  const selectedMediaAssetSourceAsset = useMemo(
    () =>
      mediaAssets.find(
        (asset) => String(asset?.id || '') === String(selectedMediaAsset?.sourceMediaId || ''),
      ) || null,
    [mediaAssets, selectedMediaAsset?.sourceMediaId],
  );
  const activeVisionWorkflowStage = useMemo(
    () => getVisionWorkflowStage(activeVisionWorkflowStageKey),
    [activeVisionWorkflowStageKey],
  );
  const photoVariations = useMemo(() => {
    if (
      !activePhotoVariationsAssetId ||
      String(photoVariationsState.assetId || '') !== String(activePhotoVariationsAssetId)
    ) {
      return [];
    }

    return photoVariationsState.variants;
  }, [activePhotoVariationsAssetId, photoVariationsState]);
  const sortedPhotoVariations = useMemo(() => {
    const variants = [...photoVariations];
    const compareDirection = photoVariationSortDirection === 'asc' ? 1 : -1;

    variants.sort((left, right) => {
      if (photoVariationSortKey === 'name') {
        const leftLabel = String(left?.label || '').trim().toLowerCase();
        const rightLabel = String(right?.label || '').trim().toLowerCase();
        const labelComparison = leftLabel.localeCompare(rightLabel);
        if (labelComparison !== 0) {
          return labelComparison * compareDirection;
        }
      } else {
        const leftDate = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightDate = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
        const dateComparison = leftDate - rightDate;
        if (dateComparison !== 0) {
          return dateComparison * compareDirection;
        }
      }

      const leftFallback = String(left?.label || '').trim().toLowerCase();
      const rightFallback = String(right?.label || '').trim().toLowerCase();
      return leftFallback.localeCompare(rightFallback);
    });

    return variants;
  }, [photoVariations, photoVariationSortDirection, photoVariationSortKey]);
  const isLoadingPhotoVariations =
    Boolean(activePhotoVariationsAssetId) &&
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId) &&
    photoVariationsState.isLoading;
  const photoVariationsTotalCount =
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId)
      ? photoVariationsState.totalCount
      : 0;
  const photoVariationsLoadedCount =
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId)
      ? photoVariationsState.loadedCount
      : 0;
  const photoVariationsError =
    String(photoVariationsState.assetId || '') === String(activePhotoVariationsAssetId)
      ? photoVariationsState.error
      : '';
  const photoVariationsProgressPercent =
    photoVariationsTotalCount > 0
      ? Math.min(100, Math.round((photoVariationsLoadedCount / photoVariationsTotalCount) * 100))
      : 0;
  const activeVisionWorkflowPresetGroups = useMemo(() => {
    const presetByKey = new Map(visionPresets.map((preset) => [preset.key, preset]));
    return activeVisionWorkflowStage.groups
      .map((group) => ({
        ...group,
        items: group.items
          .map((itemKey) => presetByKey.get(itemKey))
          .filter(Boolean),
      }))
      .filter((group) => group.items.length);
  }, [activeVisionWorkflowStage, visionPresets]);
  const compareSourceVariant =
    selectedVariantSourceVariant ||
    (workflowSourceVariant && workflowSourceVariant.id !== selectedVariant?.id
      ? workflowSourceVariant
      : null);
  const selectedGeneratedAssetAsResult =
    !selectedVariant && selectedMediaAsset?.assetType === 'generated'
      ? selectedMediaAsset
      : null;
  const compareSourceImageUrl = selectedGeneratedAssetAsResult
    ? selectedMediaAssetSourceAsset?.imageUrl || selectedMediaAsset?.imageUrl || ''
    : compareSourceVariant?.imageUrl || selectedMediaAsset?.imageUrl || '';
  const compareSourceLabel = selectedGeneratedAssetAsResult
    ? selectedMediaAssetSourceAsset?.roomLabel || 'Original photo'
    : compareSourceVariant?.label || selectedMediaAsset?.roomLabel || 'Original photo';
  const effectiveVisionResultImageUrl =
    selectedVariant?.imageUrl || selectedGeneratedAssetAsResult?.imageUrl || '';
  const effectiveVisionResultLabel =
    selectedVariant?.label ||
    selectedGeneratedAssetAsResult?.generationLabel ||
    (selectedGeneratedAssetAsResult ? getMediaAssetPrimaryLabel(selectedGeneratedAssetAsResult) : '') ||
    'No result yet';
  const effectiveVisionResultSummary = selectedVariant
    ? getVariantSummary(selectedVariant)
    : selectedGeneratedAssetAsResult
    ? getMediaAssetSummary(selectedGeneratedAssetAsResult)
    : 'Generate the next stage action to compare the current source with a new result.';
  const selectedVariantFreeformHighlights = useMemo(
    () => formatFreeformPlanHighlights(selectedVariant?.metadata?.normalizedPlan),
    [selectedVariant?.metadata?.normalizedPlan],
  );
  const activeSocialPackVariant = useMemo(() => {
    const variants = latestSocialPack?.variants || [];
    if (!variants.length) {
      return null;
    }

    return (
      variants.find((variant, index) => getSocialPackVariantKey(variant, index) === activeSocialPackVariantKey) ||
      variants[0]
    );
  }, [activeSocialPackVariantKey, latestSocialPack]);
  const activeSocialPackVariantDetails = useMemo(
    () => buildSocialPackVariantDetails(latestSocialPack, activeSocialPackVariant),
    [activeSocialPackVariant, latestSocialPack],
  );
  const visibleVisionVariants = useMemo(() => {
    const historyVariants = stageScopedVisionVariants;
    if (showMoreVisionVariants) {
      return historyVariants;
    }

    const preferredVariants = historyVariants.filter(
      (variant) => !variant?.metadata?.review?.shouldHideByDefault,
    );
    const defaultVariants = (preferredVariants.length ? preferredVariants : historyVariants).slice(0, 3);
    if (
      selectedVariant &&
      !defaultVariants.some((variant) => variant.id === selectedVariant.id)
    ) {
      return [...defaultVariants, selectedVariant];
    }

    return defaultVariants;
  }, [selectedVariant, showMoreVisionVariants, stageScopedVisionVariants]);
  const hiddenVisionVariantCount = useMemo(
    () =>
      stageScopedVisionVariants.filter((variant) => variant?.metadata?.review?.shouldHideByDefault)
        .length,
    [stageScopedVisionVariants],
  );
  const activeVisionPreset = useMemo(
    () => visionPresets.find((preset) => preset.key === activeVisionPresetKey) || null,
    [activeVisionPresetKey, visionPresets],
  );
  const activeVisionPresetTooltip = useMemo(() => {
    if (!activeVisionPreset) {
      return '';
    }

    return [
      activeVisionPreset.displayName,
      activeVisionPreset.helperText,
      activeVisionPreset.category === 'concept_preview'
        ? 'Concept preview for planning and discussion.'
        : 'Listing enhancement for stronger presentation.',
      activeVisionPreset.upgradeTier === 'premium'
        ? 'Premium workflow step.'
        : 'Included workflow step.',
    ]
      .filter(Boolean)
      .join(' ');
  }, [activeVisionPreset]);
  useEffect(() => {
    if (!activePhotoVariationsAssetId) {
      setPhotoVariationsState(INITIAL_PHOTO_VARIATIONS_STATE);
      return undefined;
    }

    let cancelled = false;

    async function loadPhotoVariationsInBatches() {
      setPhotoVariationsState({
        assetId: activePhotoVariationsAssetId,
        variants: [],
        totalCount: 0,
        loadedCount: 0,
        isLoading: true,
        hasMore: false,
        error: '',
      });

      try {
        const firstBatch = await listMediaVariants(activePhotoVariationsAssetId, {
          offset: 0,
          limit: PHOTO_VARIATIONS_PAGE_SIZE,
          includeTotalCount: true,
        });
        if (cancelled) {
          return;
        }

        let loadedVariants = firstBatch.variants || [];
        const totalCount = Number(firstBatch.totalCount || loadedVariants.length || 0);
        let hasMore = loadedVariants.length < totalCount;

        setPhotoVariationsState({
          assetId: activePhotoVariationsAssetId,
          variants: loadedVariants,
          totalCount,
          loadedCount: loadedVariants.length,
          isLoading: hasMore,
          hasMore,
          error: '',
        });

        while (!cancelled && hasMore) {
          const nextBatch = await listMediaVariants(activePhotoVariationsAssetId, {
            offset: loadedVariants.length,
            limit: PHOTO_VARIATIONS_PAGE_SIZE,
          });
          if (cancelled) {
            return;
          }

          const nextVariants = nextBatch.variants || [];
          if (!nextVariants.length) {
            hasMore = false;
          } else {
            loadedVariants = [...loadedVariants, ...nextVariants];
            hasMore = loadedVariants.length < totalCount;
          }

          setPhotoVariationsState({
            assetId: activePhotoVariationsAssetId,
            variants: loadedVariants,
            totalCount,
            loadedCount: loadedVariants.length,
            isLoading: hasMore,
            hasMore,
            error: '',
          });
        }
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        setPhotoVariationsState({
          assetId: activePhotoVariationsAssetId,
          variants: [],
          totalCount: 0,
          loadedCount: 0,
          isLoading: false,
          hasMore: false,
          error: requestError.message || 'Could not load photo variations.',
        });
      }
    }

    void loadPhotoVariationsInBatches();

    return () => {
      cancelled = true;
    };
  }, [activePhotoVariationsAssetId]);
  const selectedComps = useMemo(
    () => (latestPricing?.selectedComps || dashboard?.comps || []).slice(0, 8),
    [dashboard?.comps, latestPricing?.selectedComps],
  );
  const readinessScore = useMemo(
    () => latestReport?.payload?.readinessSummary?.overallScore || checklist?.summary?.progressPercent || 0,
    [checklist?.summary?.progressPercent, latestReport?.payload?.readinessSummary?.overallScore],
  );
  const readinessLabel = useMemo(() => {
    if (latestReport?.payload?.readinessSummary?.label) {
      return latestReport.payload.readinessSummary.label;
    }
    if (readinessScore >= 80) {
      return 'Listing Ready';
    }
    if (readinessScore >= 60) {
      return 'Almost Ready';
    }
    return 'Needs Work';
  }, [latestReport?.payload?.readinessSummary?.label, readinessScore]);
  const pricingQuickPickOptions = useMemo(
    () =>
      latestPricing
        ? [
            {
              key: 'recommended_low',
              label: 'Low',
              value: latestPricing.recommendedListLow,
            },
            {
              key: 'recommended_mid',
              label: 'Mid',
              value: latestPricing.recommendedListMid,
            },
            {
              key: 'recommended_high',
              label: 'High',
              value: latestPricing.recommendedListHigh,
            },
          ].filter((option) => Number(option.value) > 0)
        : [],
    [latestPricing],
  );
  const checklistGroups = useMemo(() => {
    const groups = new Map();
    for (const item of checklist?.items || []) {
      const groupKey = formatChecklistCategory(item.category);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(item);
    }
    return [...groups.entries()];
  }, [checklist?.items]);
  const completedChecklistItems = useMemo(
    () => (checklist?.items || []).filter((item) => item.status === 'done'),
    [checklist?.items],
  );
  const openChecklistItems = useMemo(
    () => (checklist?.items || []).filter((item) => item.status !== 'done'),
    [checklist?.items],
  );
  const providerSuggestionTask = useMemo(() => {
    const tasksWithProviders = (checklist?.items || []).filter((item) => item.providerCategoryKey);
    if (!tasksWithProviders.length) {
      return null;
    }

    if (activeProviderTaskKey) {
      const matchingTask = tasksWithProviders.find(
        (item) => item.id === activeProviderTaskKey || item.systemKey === activeProviderTaskKey,
      );
      if (matchingTask) {
        return matchingTask;
      }
    }

    return tasksWithProviders.find((item) => item.status !== 'done') || tasksWithProviders[0];
  }, [activeProviderTaskKey, checklist?.items]);
  const providerReferenceIds = useMemo(
    () => new Set(providerReferences.map((reference) => `${reference.source}:${reference.sourceRefId}`)),
    [providerReferences],
  );
  const providerGoogleSearchUrl = useMemo(() => {
    if (!providerSuggestionTask) {
      return '';
    }

    const query = buildProviderFallbackQuery(providerSuggestionTask, property);
    if (!query) {
      return '';
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }, [property, providerSuggestionTask]);
  const providerMapProviders = useMemo(() => {
    const internalProviders = (providerRecommendations || []).map((provider) => ({
      ...provider,
      categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
    }));
    const unavailableProviders = (unavailableProviderRecommendations || []).map((provider) => ({
      ...provider,
      categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
    }));
    const externalProviders = (externalProviderRecommendations || []).map((provider) => ({
      ...provider,
      categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
    }));
    return [...internalProviders, ...unavailableProviders, ...externalProviders];
  }, [
    externalProviderRecommendations,
    providerRecommendations,
    providerSource?.categoryLabel,
    unavailableProviderRecommendations,
  ]);
  const providerMapViewportProviders = useMemo(() => {
    if (providerMapScope === 'all' && providerMapProviders.length) {
      return providerMapProviders;
    }

    const internalAndSetupProviders = providerMapProviders.filter(
      (provider) => !provider.isExternalFallback,
    );
    if (internalAndSetupProviders.length) {
      return internalAndSetupProviders;
    }

    return providerMapProviders;
  }, [providerMapProviders, providerMapScope]);
  const providerMapResultLimit = providerMapDensity === 'expanded' ? 10 : 6;
  const providerMapDisplayedProviders = useMemo(
    () => providerMapViewportProviders.slice(0, providerMapResultLimit),
    [providerMapResultLimit, providerMapViewportProviders],
  );
  const hasInternalProviderResults =
    providerRecommendations.length > 0 || unavailableProviderRecommendations.length > 0;
  const providerMapInternalCount = providerMapViewportProviders.filter((provider) => !provider.isExternalFallback).length;
  const providerMapExternalCount = providerMapViewportProviders.filter((provider) => provider.isExternalFallback).length;
  const hiddenProviderMapCount = Math.max(0, providerMapViewportProviders.length - providerMapDisplayedProviders.length);
  const shouldShowExternalProviderSection =
    Boolean(externalProviderRecommendations.length) &&
    (showExternalProviderFallback || !hasInternalProviderResults);
  const providerCoverageGuidance = useMemo(
    () => buildProviderCoverageGuidance(providerSuggestionTask, providerSource),
    [providerSuggestionTask, providerSource],
  );

  useEffect(() => {
    if (hasInternalProviderResults) {
      setProviderMapScope('internal');
      return;
    }

    if (providerMapProviders.length) {
      setProviderMapScope('all');
    }
  }, [hasInternalProviderResults, providerMapProviders.length]);

  useEffect(() => {
    if (providerMapViewportProviders.length <= 6 && providerMapDensity !== 'compact') {
      setProviderMapDensity('compact');
    }
  }, [providerMapDensity, providerMapViewportProviders.length]);

  const recentOutputs = useMemo(
    () =>
      [
        latestFlyer
          ? { key: 'brochure', label: 'Brochure', title: latestFlyer.headline, detail: latestFlyer.summary, tab: 'brochure' }
          : null,
        latestReport
          ? { key: 'report', label: 'Report', title: latestReport.title, detail: latestReport.executiveSummary, tab: 'report' }
          : null,
      ].filter(Boolean),
    [latestFlyer, latestReport],
  );
  const nextBestAction = useMemo(() => {
    if (property?.status === 'archived') {
      return { title: 'Restore this property from the dashboard', detail: 'Archived properties stay viewable, but edits and new outputs are blocked until the property is restored.', tab: 'overview' };
    }
    if (!mediaAssets.length) {
      return { title: 'Review the photo set', detail: 'Use the Photos tab to work from the shared mobile gallery and start building listing picks.', tab: 'photos' };
    }
    if (!listingCandidateAssets.length) {
      return { title: 'Select listing photos', detail: 'Choose the strongest images so brochure and report output prioritize them automatically.', tab: 'photos' };
    }
    if (!selectedVariant && selectedMediaAsset) {
      return { title: 'Generate a vision variant', detail: 'Create an enhanced or decluttered version before final brochure and report generation.', tab: 'vision' };
    }
    if (!latestFlyer) {
      return { title: 'Generate the brochure', detail: 'Turn pricing and photo selection into a seller-facing brochure draft.', tab: 'brochure' };
    }
    if (!latestReport) {
      return { title: 'Generate the report', detail: 'Package pricing, photos, and checklist progress into a premium deliverable.', tab: 'report' };
    }
    if (checklist?.nextTask?.title) {
      return { title: checklist.nextTask.title, detail: checklist.nextTask.detail || 'Keep the checklist moving with the next prep step.', tab: 'checklist' };
    }
    return { title: 'Review the latest outputs', detail: 'Both brochure and report are ready. Use Overview to compare the latest deliverables.', tab: 'overview' };
  }, [checklist?.nextTask?.detail, checklist?.nextTask?.title, latestFlyer, latestReport, listingCandidateAssets.length, mediaAssets.length, property?.status, selectedMediaAsset, selectedVariant]);
  const workflowNextStep = guidedWorkflow?.nextStep || null;
  const homeAdvisorGuide = useMemo(() => {
    if (isHomeAdvisorGuideHidden) {
      return null;
    }

    if (!property?.id) {
      return {
        title: 'Home Advisor Agent',
        body: 'Start by creating a property so pricing, photos, and seller-facing materials have somewhere to live.',
        ctaLabel: 'Open Overview',
        ctaAction: () => setActiveTab('overview'),
        highlights: ['Property setup first', 'Everything else builds from there'],
      };
    }

    if (!latestPricing) {
      return {
        title: 'Home Advisor Agent',
        body: 'Run pricing first so brochure, report, and seller guidance all have a live comp-backed foundation.',
        ctaLabel: 'Open Pricing',
        ctaAction: () => setActiveTab('pricing'),
        highlights: ['Review comps', 'Confirm pricing direction'],
      };
    }

    if (!mediaAssets.length) {
      return {
        title: 'Home Advisor Agent',
        body: 'Bring in photos next. One strong room photo is enough to start the Vision workflow and seller picks.',
        ctaLabel: 'Open Photos',
        ctaAction: () => setActiveTab('photos'),
        highlights: ['Import photos', 'Start with strongest rooms'],
      };
    }

    if (!listingCandidateAssets.length) {
      return {
        title: 'Home Advisor Agent',
        body: 'Mark a few seller picks so the brochure and report use the right photos by default.',
        ctaLabel: 'Open Seller Picks',
        ctaAction: () => setActiveTab('seller_picks'),
        highlights: ['Choose strongest rooms', 'Keep the story focused'],
      };
    }

    if (!latestFlyer) {
      return {
        title: 'Home Advisor Agent',
        body: 'You have pricing and photo picks. The fastest next win is generating the brochure draft.',
        ctaLabel: 'Open Brochure',
        ctaAction: () => setActiveTab('brochure'),
        highlights: ['Generate brochure draft', 'Check headline and selected photos'],
      };
    }

    if (!latestReport) {
      return {
        title: 'Home Advisor Agent',
        body: 'With pricing and photos in place, create the report so the seller sees the full strategy and readiness story.',
        ctaLabel: 'Open Report',
        ctaAction: () => setActiveTab('report'),
        highlights: ['Package pricing and photos', 'Share a premium seller deliverable'],
      };
    }

    if (workflowNextStep) {
      return {
        title: 'Home Advisor Agent',
        body: workflowNextStep.description || 'Keep moving through the recommended workflow step.',
        ctaLabel: workflowNextStep.ctaLabel || 'Open next step',
        ctaAction: () => openWorkflowStep(workflowNextStep),
        highlights: [workflowNextStep.title, workflowNextStep.helperText].filter(Boolean),
      };
    }

    return {
      title: 'Home Advisor Agent',
      body: 'The essentials are in place. Use Seller Picks, Brochure, and Report to review the final presentation package.',
      ctaLabel: 'Open Seller Picks',
      ctaAction: () => setActiveTab('seller_picks'),
      highlights: ['Review deliverables', 'Fine-tune presentation'],
    };
  }, [
    isHomeAdvisorGuideHidden,
    listingCandidateAssets.length,
    latestFlyer,
    latestPricing,
    latestReport,
    mediaAssets.length,
    property?.id,
    workflowNextStep,
  ]);
  const workflowSteps = (guidedWorkflow?.steps || []).filter(
    (step) => !PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS.has(step.key),
  );
  const workflowPreviewStep =
    workflowSteps.find((step) => step.key === workflowPreviewStepKey) ||
    (workflowNextStep && !PROPERTY_WORKSPACE_HIDDEN_WORKFLOW_STEPS.has(workflowNextStep.key)
      ? workflowNextStep
      : null) ||
    workflowSteps[0] ||
    null;

  const isArchivedProperty = property?.status === 'archived';

  function scrollWorkspaceBodyToTop() {
    if (!workspaceBodyMainRef.current || typeof window === 'undefined') {
      return;
    }

    const stickyOffset = 104;
    const top =
      workspaceBodyMainRef.current.getBoundingClientRect().top + window.scrollY - stickyOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    });
  }

  function scrollWorkspaceSectionIntoView(targetRef) {
    if (!targetRef?.current || typeof window === 'undefined') {
      scrollWorkspaceBodyToTop();
      return;
    }

    const stickyOffset = 132;
    const top = targetRef.current.getBoundingClientRect().top + window.scrollY - stickyOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    });
  }

  function openWorkflowStep(step) {
    if (!step || (!step.actionTarget && !step.actionHref)) {
      return;
    }

    if (step.actionHref) {
      setActiveTab('overview');
      setPendingWorkspaceScrollTarget('top');
      return;
    }

    if (step.actionTarget) {
      setActiveTab(step.actionTarget);
      setPendingWorkspaceScrollTarget('top');
    }
  }

  useEffect(() => {
    if (!propertyFullQuery.data) {
      return;
    }

    const snapshot = propertyFullQuery.data;
    const nextAssets = snapshot.mediaAssets || [];
    const nextPricing = snapshot.pricingAnalyses?.latest || null;
    const nextFlyer = snapshot.reports?.latestFlyer || null;
    const nextReport = snapshot.reports?.latestReport || null;
    const nextDashboard = buildDashboardFromSnapshot(snapshot);

    setProperty(snapshot.property || null);
    setDashboard(nextDashboard);
    setChecklist(snapshot.checklist || null);
    setLatestPricing(nextPricing);
    setLatestFlyer(nextFlyer);
    setLatestReport(nextReport);
    setMediaAssets(nextAssets);
    setSelectedMediaAssetId((current) => {
      if (nextAssets.some((asset) => asset.id === current)) {
        return current;
      }
      return nextAssets[0]?.id || '';
    });
  }, [propertyFullQuery.data]);

  useEffect(() => {
    if (!activePhotoDetailsAsset?.id) {
      return;
    }

    const refreshedAsset =
      mediaAssets.find((asset) => asset.id === activePhotoDetailsAsset.id) || null;

    if (refreshedAsset) {
      setActivePhotoDetailsAsset(refreshedAsset);
      return;
    }

    setActivePhotoDetailsAsset(null);
  }, [activePhotoDetailsAsset?.id, mediaAssets]);

  useEffect(() => {
    if (!liveMediaVariantsQuery.data) {
      return;
    }

    const nextVariants = liveMediaVariantsQuery.data || [];
    setMediaVariants(nextVariants);
    setSelectedVariantId((current) => {
      return pickVisionWorkspaceVariantId(nextVariants, {
        currentVariantId: current,
        stageKey: activeVisionWorkflowStageKey,
        sourceVariantId: workflowSourceVariantId,
      });
    });
  }, [activeVisionWorkflowStageKey, liveMediaVariantsQuery.data, workflowSourceVariantId]);

  useEffect(() => {
    if (!workflowQuery.data) {
      return;
    }

    setGuidedWorkflow(workflowQuery.data);
  }, [workflowQuery.data]);

  useEffect(() => {
    if (!workflowSteps.length) {
      setWorkflowPreviewStepKey('');
      return;
    }

    setWorkflowPreviewStepKey((current) => {
      if (current && workflowSteps.some((step) => step.key === current)) {
        return current;
      }

      return workflowNextStep?.key || workflowSteps[0]?.key || '';
    });
  }, [workflowNextStep?.key, workflowSteps]);

  useEffect(() => {
    if (!pendingWorkspaceScrollTarget) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pendingWorkspaceScrollTarget === 'flyer-preview') {
          scrollWorkspaceSectionIntoView(flyerPreviewRef);
        } else if (pendingWorkspaceScrollTarget === 'report-preview') {
          scrollWorkspaceSectionIntoView(reportPreviewRef);
        } else {
          scrollWorkspaceBodyToTop();
        }
        setPendingWorkspaceScrollTarget('');
      });
    });
  }, [activeTab, pendingWorkspaceScrollTarget]);

  useEffect(() => {
    if (activeTab !== 'checklist' || pendingChecklistFocusTarget !== 'providers') {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (providerSuggestionsRef.current) {
          const stickyOffset = 150;
          const top = providerSuggestionsRef.current.getBoundingClientRect().top + window.scrollY - stickyOffset;
          window.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth',
          });
        }
        setPendingChecklistFocusTarget('');
      });
    });
  }, [activeTab, activeProviderTaskKey, pendingChecklistFocusTarget]);

  useEffect(() => {
    if (property?.selectedListPrice) {
      setSelectedListPriceDraft(String(property.selectedListPrice));
      setSelectedListPriceSourceDraft(property.selectedListPriceSource || 'custom');
      return;
    }

    if (latestPricing?.recommendedListMid) {
      setSelectedListPriceDraft(String(latestPricing.recommendedListMid));
      setSelectedListPriceSourceDraft('recommended_mid');
      return;
    }

    setSelectedListPriceDraft('');
    setSelectedListPriceSourceDraft('recommended_mid');
  }, [
    property?.selectedListPrice,
    property?.selectedListPriceSource,
    latestPricing?.recommendedListMid,
  ]);

  useEffect(() => {
    const nextSession = { ...(getStoredSession() || {}), lastPropertyId: propertyId };
    setStoredSession(nextSession);
  }, [propertyId]);

  useEffect(() => {
    if (selectedVariant?.variantType) {
      setActiveVisionPresetKey(selectedVariant.variantType);
    }
  }, [selectedVariant?.variantType]);

  useEffect(() => {
    const variants = latestSocialPack?.variants || [];
    if (!variants.length) {
      setActiveSocialPackVariantKey('');
      return;
    }

    setActiveSocialPackVariantKey((current) => {
      if (
        current &&
        variants.some((variant, index) => getSocialPackVariantKey(variant, index) === current)
      ) {
        return current;
      }
      return getSocialPackVariantKey(variants[0], 0);
    });
  }, [latestSocialPack]);

  useEffect(() => {
    setActiveTab('overview');
  }, [propertyId]);

  useEffect(() => {
    setShowMoreVisionVariants(false);
  }, [selectedMediaAsset?.id]);

  useEffect(() => {
    if (!pendingDeleteAsset) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setPendingDeleteAsset(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDeleteAsset]);

  useEffect(() => {
    const fallbackPhotoIds = brochurePhotoPool.slice(0, 4).map((asset) => asset.id);
    const flyerCustomizations =
      latestFlyer?.flyerType === flyerType ? latestFlyer.customizations || {} : {};
    setFlyerHeadlineDraft(flyerCustomizations.headline || (latestFlyer?.flyerType === flyerType ? latestFlyer.headline || '' : property?.title || ''));
    setFlyerSubheadlineDraft(
      flyerCustomizations.subheadline ||
        (latestFlyer?.flyerType === flyerType ? latestFlyer.subheadline || '' : ''),
    );
    setFlyerSummaryDraft(
      flyerCustomizations.summary ||
        (latestFlyer?.flyerType === flyerType
          ? latestFlyer.summary || ''
          : latestReport?.payload?.marketingGuidance?.shortDescription || ''),
    );
    setFlyerCallToActionDraft(
      flyerCustomizations.callToAction ||
        (latestFlyer?.flyerType === flyerType ? latestFlyer.callToAction || '' : ''),
    );
    setFlyerSelectedPhotoIds(
      flyerCustomizations.selectedPhotoAssetIds?.length
        ? flyerCustomizations.selectedPhotoAssetIds
        : latestFlyer?.flyerType === flyerType && latestFlyer?.selectedPhotos?.length
          ? latestFlyer.selectedPhotos.map((photo) => photo.assetId).filter(Boolean)
          : fallbackPhotoIds,
    );
  }, [
    brochurePhotoPool,
    flyerType,
    latestFlyer,
    latestReport?.payload?.marketingGuidance?.shortDescription,
    property?.title,
  ]);

  useEffect(() => {
    const reportCustomizations = latestReport?.customizations || {};
    setReportTitleDraft(reportCustomizations.title || latestReport?.title || `${property?.title || 'Property'} Seller Intelligence Report`);
    setReportExecutiveSummaryDraft(
      reportCustomizations.executiveSummary || latestReport?.executiveSummary || '',
    );
    setReportListingDescriptionDraft(
      reportCustomizations.listingDescription ||
        latestReport?.payload?.listingDescriptions?.shortDescription ||
        '',
    );
    setReportSelectedPhotoIds(
      reportCustomizations.selectedPhotoAssetIds?.length
        ? reportCustomizations.selectedPhotoAssetIds
        : latestReport?.selectedPhotos?.length
          ? latestReport.selectedPhotos.map((photo) => photo.assetId).filter(Boolean)
          : reportPhotoPool.slice(0, 4).map((asset) => asset.id),
    );
    setReportIncludedSections(
      reportCustomizations.includedSections?.length
        ? reportCustomizations.includedSections
        : REPORT_SECTION_OPTIONS.map((section) => section.id),
    );
  }, [
    latestReport,
    property?.title,
    reportPhotoPool,
  ]);

  function applyPropertySnapshot(snapshot, preferredAssetId = selectedMediaAssetId) {
    const nextAssets = snapshot?.mediaAssets || [];
    const nextPricing = snapshot?.pricingAnalyses?.latest || null;
    const nextFlyer = snapshot?.reports?.latestFlyer || null;
    const nextReport = snapshot?.reports?.latestReport || null;
    const nextChecklist = snapshot?.checklist || null;
    const nextProperty = snapshot?.property || null;
    const nextDashboard = buildDashboardFromSnapshot(snapshot);

    queryClient.setQueryData(['property-full', propertyId], snapshot);
    setProperty(nextProperty);
    setDashboard(nextDashboard);
    setChecklist(nextChecklist);
    setLatestPricing(nextPricing);
    setLatestFlyer(nextFlyer);
    setLatestReport(nextReport);
    setMediaAssets(nextAssets);
    setSelectedMediaAssetId(() => {
      if (preferredAssetId && nextAssets.some((asset) => asset.id === preferredAssetId)) {
        return preferredAssetId;
      }
      return nextAssets[0]?.id || '';
    });

    return {
      dashboard: nextDashboard,
      checklist: nextChecklist,
      mediaAssets: nextAssets,
      property: nextProperty,
      latestPricing: nextPricing,
      latestFlyer: nextFlyer,
      latestReport: nextReport,
    };
  }

  async function refreshPropertySnapshot(preferredAssetId = selectedMediaAssetId) {
    if (propertySnapshotRefreshPromiseRef.current) {
      return propertySnapshotRefreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const snapshot = await getPropertyFull(propertyId);
      return applyPropertySnapshot(snapshot, preferredAssetId);
    })();

    propertySnapshotRefreshPromiseRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      propertySnapshotRefreshPromiseRef.current = null;
    }
  }

  async function refreshMediaAssets(preferredAssetId = selectedMediaAssetId) {
    const snapshot = await refreshPropertySnapshot(preferredAssetId);
    return snapshot.mediaAssets;
  }

  async function refreshMediaVariants(assetId = selectedMediaAssetId) {
    if (!assetId) {
      queryClient.setQueryData(['property-media-variants', ''], []);
      setMediaVariants([]);
      setSelectedVariantId('');
      return [];
    }
    const variantsResponse = await listMediaVariants(assetId);
    const nextVariants = variantsResponse.variants || [];
    queryClient.setQueryData(['property-media-variants', assetId], nextVariants);
    setMediaVariants(nextVariants);
    setSelectedVariantId((current) =>
      pickVisionWorkspaceVariantId(nextVariants, {
        currentVariantId: current,
        stageKey: activeVisionWorkflowStageKey,
        sourceVariantId: workflowSourceVariantId,
      }),
    );
    return nextVariants;
  }

  async function refreshDashboardSnapshot() {
    const snapshot = await refreshPropertySnapshot(selectedMediaAssetId);
    return snapshot.dashboard;
  }

  async function refreshChecklist() {
    const snapshot = await refreshPropertySnapshot(selectedMediaAssetId);
    return snapshot.checklist;
  }

  async function refreshWorkflow() {
    const response = await getWorkflow(propertyId, viewerRole);
    queryClient.setQueryData(['property-workflow', propertyId, viewerRole], response.workflow);
    setGuidedWorkflow(response.workflow);
    return response.workflow;
  }

  async function refreshSocialPack() {
    try {
      const response = await getLatestSocialPack(propertyId);
      setLatestSocialPack(response.socialPack || null);
      return response.socialPack || null;
    } catch {
      setLatestSocialPack(null);
      return null;
    }
  }

  async function handleBrowseGoogleFallback() {
    try {
      setProviderSearchStatus('Searching Google fallback providers...');
      const response = await listProviders(propertyId, {
        taskKey: providerSuggestionTask?.systemKey || providerSuggestionTask?.id,
        limit: 5,
        includeExternal: true,
      });
      const results = response.providers?.externalItems || [];
      const fallbackDiagnostic = response.providers?.source?.googleFallbackDiagnostic || '';
      setUnavailableProviderRecommendations(response.providers?.unavailableItems || []);
      setExternalProviderRecommendations(results);
      setShowExternalProviderFallback(true);
      setProviderSource((current) =>
        ({
          ...(current || {}),
          ...(response.providers?.source || {}),
          externalProviders: results.length,
        })
      );
      if (results.length) {
        setShowProviderMap(true);
      }
      if (!results.length) {
        setToast({
          tone: fallbackDiagnostic ? 'error' : 'info',
          title: fallbackDiagnostic ? 'Could not load Google fallback' : 'No Google fallback results',
          message:
            fallbackDiagnostic ||
            'Google did not return structured fallback results for this category near the property. You can still open the live Google Maps search below.',
        });
      }
      return results;
    } catch (error) {
      setShowExternalProviderFallback(true);
      setExternalProviderRecommendations([]);
      setToast({
        tone: 'error',
        title: 'Could not load Google fallback',
        message: error.message || 'Google fallback search could not be completed.',
      });
      return [];
    } finally {
      setProviderSearchStatus('');
    }
  }

  async function refreshProviders(task = providerSuggestionTask) {
    if (!task?.providerCategoryKey) {
      setProviderRecommendations([]);
      setUnavailableProviderRecommendations([]);
      setExternalProviderRecommendations([]);
      setProviderSource(null);
      return [];
    }

    const response = await listProviders(propertyId, {
      taskKey: task.systemKey || task.id,
      limit: 4,
    });
    const nextProviders = response.providers?.items || [];
    const nextUnavailableProviders = response.providers?.unavailableItems || [];
    const externalResultsFromApi = response.providers?.externalItems || [];
    setProviderRecommendations(nextProviders);
    setUnavailableProviderRecommendations(nextUnavailableProviders);
    setExternalProviderRecommendations(externalResultsFromApi);
    setShowExternalProviderFallback(Boolean(externalResultsFromApi.length && !nextProviders.length));
    setProviderSource({
      ...(response.providers?.source || {}),
      externalProviders: externalResultsFromApi.length,
    });
    return nextProviders;
  }

  function focusProviderSuggestions(taskKey = '') {
    if (taskKey) {
      setActiveProviderTaskKey(taskKey);
    }
    setActiveTab('checklist');
    setPendingChecklistFocusTarget('providers');
  }

  async function refreshProviderLeads() {
    const response = await listProviderLeads(propertyId);
    const nextLeads = response.leads?.items || [];
    setProviderLeads(nextLeads);
    return nextLeads;
  }

  async function refreshProviderReferences() {
    const response = await listProviderReferences(propertyId);
    const nextReferences = response.references?.items || [];
    setProviderReferences(nextReferences);
    return nextReferences;
  }

  useEffect(() => {
    refreshMediaVariants(selectedMediaAsset?.id).catch(() => {
      setMediaVariants([]);
      setSelectedVariantId('');
    });
  }, [selectedMediaAsset?.id]);

  useEffect(() => {
    if (!activeProviderTaskKey && providerSuggestionTask?.id) {
      setActiveProviderTaskKey(providerSuggestionTask.id);
    }
  }, [activeProviderTaskKey, providerSuggestionTask?.id]);

  useEffect(() => {
    refreshProviders(providerSuggestionTask).catch(() => {
      setProviderRecommendations([]);
      setUnavailableProviderRecommendations([]);
      setExternalProviderRecommendations([]);
      setProviderSource(null);
      setProviderSearchStatus('');
    });
  }, [propertyId, providerSuggestionTask?.id, providerSuggestionTask?.providerCategoryKey]);

  useEffect(() => {
    refreshProviderLeads().catch(() => {
      setProviderLeads([]);
    });
  }, [propertyId]);

  useEffect(() => {
    refreshProviderReferences().catch(() => {
      setProviderReferences([]);
    });
  }, [propertyId]);

  useEffect(() => {
    async function loadWorkspace() {
      setStatus('Loading property workspace...');
      setToast(null);
      try {
        const [snapshotResponse, presetsResponse] = await Promise.all([
          getPropertyFull(propertyId),
          listVisionPresets(),
        ]);
        applyPropertySnapshot(snapshotResponse);
        setVisionPresets(presetsResponse.presets || []);
        await refreshSocialPack();
        try {
          await refreshProviderLeads();
        } catch {
          setProviderLeads([]);
        }
      } catch (requestError) {
        try {
          setVisionPresets([]);
        } catch {}
        setToast({ tone: 'error', title: 'Could not load property', message: requestError.message });
      } finally {
        setStatus('');
      }
    }
    loadWorkspace();
  }, [propertyId]);

  function blockArchivedMutation() {
    if (!isArchivedProperty) {
      return false;
    }

    setToast({
      tone: 'error',
      title: 'Property is archived',
      message: 'Restore this property from the dashboard before making new changes.',
    });
    return true;
  }

  async function handleAnalyzePricing() {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus('Refreshing RentCast + AI pricing analysis...');
    setToast(null);
    try {
      const analysisResponse = await analyzePricing(propertyId);
      const [dashboardResponse, checklistResponse] = await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      setLatestPricing(analysisResponse.analysis);
      setDashboard(dashboardResponse);
      setChecklist(checklistResponse);
      const pricingMetadata = analysisResponse.metadata || {};
      const pricingPolicy = pricingMetadata.policy || {};
      if (pricingMetadata.servedFromCache && pricingMetadata.cacheReason === 'COOLDOWN_ACTIVE') {
        setToast({
          tone: 'info',
          title: 'Recent comps already available',
          message: pricingMetadata.cachedAt
            ? `Last live comps were run ${formatDateTimeLabel(pricingMetadata.cachedAt)}. Showing the saved analysis because the ${pricingPolicy.pricingCooldownHours || 24}-hour cooldown is still active.`
            : `Showing the saved analysis because the ${pricingPolicy.pricingCooldownHours || 24}-hour cooldown is still active.`,
        });
      } else if (
        pricingMetadata.servedFromCache &&
        pricingMetadata.cacheReason === 'PROPERTY_QUERY_LIMIT_REACHED'
      ) {
        setToast({
          tone: 'warning',
          title: 'Pricing query limit reached',
          message: pricingMetadata.cachedAt
            ? `This property has already used ${pricingPolicy.runsUsedForProperty || 0} live RentCast pricing runs. Showing the latest saved analysis from ${formatDateTimeLabel(pricingMetadata.cachedAt)}.`
            : `This property has already used ${pricingPolicy.runsUsedForProperty || 0} live RentCast pricing runs, so the latest saved analysis is being shown instead.`,
        });
      } else {
        setToast({ tone: 'success', title: 'Pricing refreshed', message: 'The latest analysis and comp set are ready.' });
      }
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Pricing refresh failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveSelectedListPrice() {
    if (blockArchivedMutation()) {
      return;
    }

    const session = getStoredSession();
    if (!session?.user?.id) {
      setToast({
        tone: 'error',
        title: 'Sign in required',
        message: 'Sign in again before saving a selected list price.',
      });
      return;
    }

    const parsedPrice = Number(selectedListPriceDraft);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setToast({
        tone: 'error',
        title: 'Enter a valid price',
        message: 'Choose one of the suggested prices or enter a custom list price.',
      });
      return;
    }

    setStatus('Saving selected list price...');
    setToast(null);
    try {
      const response = await setPropertyPricingDecision(
        propertyId,
        {
          selectedListPrice: Math.round(parsedPrice),
          selectedListPriceSource: selectedListPriceSourceDraft || 'custom',
        },
        session.user.id,
      );
      setProperty(response.property);
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setToast({
        tone: 'success',
        title: 'List price saved',
        message: 'Your chosen list price will be used the next time you generate brochure and report materials.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save list price',
        message: requestError.message,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateFlyer() {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus(`Generating ${flyerType} flyer...`);
    setToast(null);
    setGenerationPrompt(null);
    try {
      const response = await generateFlyer(propertyId, flyerType, {
        headline: flyerHeadlineDraft,
        subheadline: flyerSubheadlineDraft,
        summary: flyerSummaryDraft,
        callToAction: flyerCallToActionDraft,
        selectedPhotoAssetIds: flyerSelectedPhotoIds,
      });
      setLatestFlyer(response.flyer);
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      setToast({ tone: 'success', title: 'Flyer generated', message: 'The flyer is ready. You can review it here or download the PDF now.' });
      openGenerationPrompt('flyer');
    } catch (requestError) {
      if (requestError.status === 402 && requestError.details?.suggestedPlan) {
        const session = getStoredSession();
        if (session?.user?.id) {
          setStatus('Opening Stripe checkout...');
          try {
            const checkout = await createBillingCheckoutSession({ userId: session.user.id, planKey: requestError.details.suggestedPlan }, session.user.id);
            if (checkout.url) {
              window.location.href = checkout.url;
              return;
            }
          } catch (checkoutError) {
            setToast({ tone: 'error', title: 'Billing required', message: checkoutError.message });
            setStatus('');
            return;
          }
        }
      }
      setToast({ tone: 'error', title: 'Flyer generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleGenerateReport() {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus('Generating seller intelligence report...');
    setToast(null);
    setGenerationPrompt(null);
    try {
      const response = await generateReport(propertyId, {
        title: reportTitleDraft,
        executiveSummary: reportExecutiveSummaryDraft,
        listingDescription: reportListingDescriptionDraft,
        selectedPhotoAssetIds: reportSelectedPhotoIds,
        includedSections: reportIncludedSections,
      });
      setLatestReport(response.report);
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      setToast({ tone: 'success', title: 'Report generated', message: 'The seller intelligence report is ready. You can review it here or download the PDF now.' });
      openGenerationPrompt('report');
    } catch (requestError) {
      if (requestError.status === 402 && requestError.details?.suggestedPlan) {
        const session = getStoredSession();
        if (session?.user?.id) {
          setStatus('Opening Stripe checkout...');
          try {
            const checkout = await createBillingCheckoutSession({ userId: session.user.id, planKey: requestError.details.suggestedPlan }, session.user.id);
            if (checkout.url) {
              window.location.href = checkout.url;
              return;
            }
          } catch (checkoutError) {
            setToast({ tone: 'error', title: 'Billing required', message: checkoutError.message });
            setStatus('');
            return;
          }
        }
      }
      setToast({ tone: 'error', title: 'Report generation failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleToggleListingCandidateForAsset(asset, explicitValue) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!asset) {
      return;
    }
    const nextValue =
      typeof explicitValue === 'boolean' ? explicitValue : !Boolean(asset.listingCandidate);
    const previousValue = Boolean(asset.listingCandidate);
    setStatus(nextValue ? 'Marking photo as listing candidate...' : 'Removing listing-candidate mark...');
    setToast(null);
    try {
      setMediaAssets((current) =>
        current.map((currentAsset) =>
          currentAsset.id === asset.id
            ? { ...currentAsset, listingCandidate: nextValue }
            : currentAsset,
        ),
      );
      setActivePhotoDetailsAsset((current) =>
        current?.id === asset.id ? { ...current, listingCandidate: nextValue } : current,
      );
      await updateMediaAsset(asset.id, { listingCandidate: nextValue });
      await Promise.all([
        refreshMediaAssets(asset.id),
        refreshDashboardSnapshot(),
        refreshChecklist(),
        refreshWorkflow(),
      ]);
      setToast({
        tone: 'success',
        title: nextValue ? 'Listing candidate selected' : 'Listing candidate removed',
        message: nextValue
          ? 'This photo will now be prioritized for flyer generation.'
          : 'This photo will no longer be prioritized for the flyer.',
      });
    } catch (requestError) {
      setMediaAssets((current) =>
        current.map((currentAsset) =>
          currentAsset.id === asset.id
            ? { ...currentAsset, listingCandidate: previousValue }
            : currentAsset,
        ),
      );
      setActivePhotoDetailsAsset((current) =>
        current?.id === asset.id ? { ...current, listingCandidate: previousValue } : current,
      );
      setToast({ tone: 'error', title: 'Could not update photo', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  function handleOpenAssetInVision(asset, nextStageKey = '') {
    if (!asset) {
      return;
    }

    const resolvedStageKey = nextStageKey || getDefaultVisionStageForAsset(asset);
    if (asset.id !== selectedMediaAssetId) {
      setMediaVariants([]);
    }
    setSelectedMediaAssetId(asset.id);
    setSelectedVariantId('');
    setWorkflowSourceVariantId('');
    setActiveTab('vision');
    setActiveVisionWorkflowStageKey(resolvedStageKey);
    setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(resolvedStageKey));
    setShowVisionPhotoPicker(false);
    setShowVisionHistory(false);
    setPendingWorkspaceScrollTarget('vision-top');
  }

  function handleOpenPhotoVariations(asset) {
    if (!asset) {
      return;
    }

    setActivePhotoVariationsAssetId(asset.id);
    setIsSelectingPhotoVariations(false);
    setSelectedPhotoVariationIds([]);
    setPendingDeletePhotoVariationIds([]);
    setActivePhotoDetailsAsset(null);
    setToast(null);
  }

  function handleUseVariantAsVisionBaseline(asset, variant) {
    if (!asset || !variant) {
      return;
    }

    const sourceStageKey = getVisionWorkflowStageKeyForVariant(variant);
    const nextStageKey = getNextVisionWorkflowStageKey(sourceStageKey);

    setSelectedMediaAssetId(asset.id);
    setSelectedVariantId(variant.id);
    setWorkflowSourceVariantId(variant.id);
    setActiveTab('vision');
    setActiveVisionWorkflowStageKey(nextStageKey);
    if (nextStageKey !== 'final') {
      setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(nextStageKey));
    }
    setShowVisionPhotoPicker(false);
    setShowVisionHistory(false);
    setShowMoreVisionVariants(false);
    setActivePhotoVariationsAssetId('');
    setPendingWorkspaceScrollTarget('vision-top');
    setToast({
      tone: 'success',
      title: 'Vision baseline updated',
      message:
        nextStageKey === 'final'
          ? `${variant.label || 'This variation'} is now the final review source in Vision.`
          : `${variant.label || 'This variation'} is now the source for ${getVisionWorkflowStage(nextStageKey).title.toLowerCase()}.`,
    });
  }

  function renderCollapsibleSection({
    sectionKey,
    label,
    title,
    meta = '',
    defaultOpen = true,
    className = 'content-card',
    children,
  }) {
    const isOpen = isWorkspaceSectionOpen(sectionKey, defaultOpen);
    return (
      <section
        className={`${className} workspace-collapsible-section${isOpen ? ' open' : ' collapsed'}`}
      >
        <button
          type="button"
          className="workspace-collapsible-section-toggle"
          onClick={() =>
            setWorkspaceSectionOpen(sectionKey, (current) => !current, defaultOpen)
          }
          aria-expanded={isOpen}
        >
          <div>
            {label ? <span className="label">{label}</span> : null}
            <h2>{title}</h2>
          </div>
          <div className="workspace-collapsible-section-meta">
            {meta ? <span>{meta}</span> : null}
            <strong>{isOpen ? 'Hide' : 'Show'}</strong>
          </div>
        </button>
        {isOpen ? <div className="workspace-collapsible-section-body">{children}</div> : null}
      </section>
    );
  }

  function getWorkspaceTabLabel(tabId) {
    return [...WORKSPACE_TABS, ...HIDDEN_WORKSPACE_TABS].find((tab) => tab.id === tabId)?.label || 'Workspace';
  }

  function closePhotoVariationsModal() {
    setActivePhotoVariationsAssetId('');
    setIsSelectingPhotoVariations(false);
    setSelectedPhotoVariationIds([]);
    setPendingDeletePhotoVariationIds([]);
  }

  function togglePhotoVariationSelection(variantId) {
    setSelectedPhotoVariationIds((current) =>
      current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId],
    );
  }

  function applyDeletedVariantToPhotoVariationsState(assetId, variantId) {
    if (
      String(activePhotoVariationsAssetId || '') !== String(assetId || '') ||
      String(photoVariationsState.assetId || '') !== String(assetId || '')
    ) {
      return;
    }

    setPhotoVariationsState((current) => {
      const nextVariants = current.variants.filter(
        (variant) => String(variant.id || '') !== String(variantId || ''),
      );
      const deletedFromLoadedCount =
        nextVariants.length === current.variants.length ? 0 : 1;
      const nextLoadedCount = Math.max(0, current.loadedCount - deletedFromLoadedCount);
      const nextTotalCount = Math.max(0, current.totalCount - deletedFromLoadedCount);

      return {
        ...current,
        variants: nextVariants,
        loadedCount: nextLoadedCount,
        totalCount: nextTotalCount,
        hasMore: nextLoadedCount < nextTotalCount,
      };
    });
  }

  async function deleteVisionVariantByDescriptor(
    variantToDelete,
    { showSuccessToast = true, refreshAfterDelete = true } = {},
  ) {
    const selectedAssetId = String(selectedMediaAsset?.id || '');
    const assetIdForDelete = String(variantToDelete?.assetId || variantToDelete?.mediaId || selectedAssetId);
    if (!variantToDelete?.id || !assetIdForDelete) {
      throw new Error('The source photo for this attempt could not be determined.');
    }

    const deletingCurrentWorkspaceVariant =
      Boolean(selectedAssetId) && assetIdForDelete === selectedAssetId;
    const optimisticNextVariants = mediaVariants.filter(
      (variant) => variant.id !== variantToDelete.id,
    );
    const replacementStageVariant =
      optimisticNextVariants.find(
        (candidate) =>
          getVisionWorkflowStageKeyForVariant(candidate) === activeVisionWorkflowStageKey,
      ) || optimisticNextVariants[0];
    const nextWorkflowSourceVariantId =
      deletingCurrentWorkspaceVariant && workflowSourceVariantId === variantToDelete.id
        ? replacementStageVariant?.id || ''
        : workflowSourceVariantId;
    const nextLatestGeneratedVariantId =
      deletingCurrentWorkspaceVariant && latestGeneratedVariantId === variantToDelete.id
        ? ''
        : latestGeneratedVariantId;
    const nextSelectedVariantId =
      deletingCurrentWorkspaceVariant && selectedVariantId === variantToDelete.id
        ? replacementStageVariant?.id || ''
        : selectedVariantId;

    await deleteMediaVariantRequest(assetIdForDelete, variantToDelete.id);

    if (deletingCurrentWorkspaceVariant) {
      queryClient.setQueryData(
        ['property-media-variants', selectedAssetId],
        optimisticNextVariants,
      );
      setMediaVariants(optimisticNextVariants);
      setWorkflowSourceVariantId(nextWorkflowSourceVariantId);
      setLatestGeneratedVariantId(nextLatestGeneratedVariantId);
      setSelectedVariantId(nextSelectedVariantId);

      if (!optimisticNextVariants.length) {
        setShowVisionHistory(false);
        setShowMoreVisionVariants(false);
      }
    }

    applyDeletedVariantToPhotoVariationsState(assetIdForDelete, variantToDelete.id);
    setSelectedPhotoVariationIds((current) =>
      current.filter((id) => String(id) !== String(variantToDelete.id)),
    );

    if (deletingCurrentWorkspaceVariant && selectedVariantId === variantToDelete.id) {
      requestAnimationFrame(() => {
        scrollWorkspaceSectionIntoView(visionCompareRef);
      });
    }

    if (showSuccessToast) {
      setToast({
        tone: 'success',
        title: 'Vision attempt deleted',
        message: `"${variantToDelete.label || 'Selected attempt'}" was removed permanently from this photo's Vision history.`,
      });
    }

    if (refreshAfterDelete) {
      void Promise.all([
        refreshMediaVariants(assetIdForDelete),
        refreshMediaAssets(assetIdForDelete),
        refreshWorkflow(),
      ]).catch(() => {});
    }

    return {
      assetIdForDelete,
      deletingCurrentWorkspaceVariant,
    };
  }

  function renderPhotoLibrarySection(group) {
    const isSelectedCategory = selectedMediaAssetPhotoCategory?.key === group.key;
    const defaultOpen = isSelectedCategory || group.key === firstPopulatedPhotoCategoryKey;
    const sellerPickCount = group.assets.filter((asset) => asset.listingCandidate).length;
    const photoCountLabel = `${group.assets.length} photo${group.assets.length === 1 ? '' : 's'}`;
    const sellerPickLabel = `${sellerPickCount} seller pick${sellerPickCount === 1 ? '' : 's'}`;

    return renderCollapsibleSection({
      sectionKey: `photos_room_${group.key}`,
      label: 'Photo category',
      title: group.label,
      meta: `${photoCountLabel} · ${sellerPickLabel}`,
      defaultOpen,
      className: 'content-card workspace-collapsible-section photo-library-section',
      children: group.assets.length ? (
        <div className="photo-room-grid">
          {group.assets.map((asset) => (
            <article
              key={asset.id}
              className={asset.id === selectedMediaAsset?.id ? 'photo-library-card active' : 'photo-library-card'}
            >
              <button
                type="button"
                className="photo-library-card-preview"
                onClick={() => {
                  setSelectedMediaAssetId(asset.id);
                  setActivePhotoDetailsAsset(asset);
                }}
              >
                <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
              </button>
              <div className="photo-library-card-body">
                <div className="photo-card-badge-row">
                  <span className="photo-card-status-pill">{getMediaAssetPrimaryLabel(asset)}</span>
                  {asset.savedFromVision ? <span className="photo-card-status-pill">Saved from Vision</span> : null}
                  <button
                    type="button"
                    className={asset.listingCandidate ? 'photo-card-action-pill active' : 'photo-card-action-pill'}
                    onClick={() => handleToggleListingCandidateForAsset(asset)}
                    disabled={Boolean(status) || isArchivedProperty}
                  >
                    {asset.listingCandidate ? 'Seller Pick' : 'Add Seller Pick'}
                  </button>
                </div>
                <strong>{asset.roomLabel}</strong>
                <p className="photo-card-summary">{getMediaAssetSummary(asset)}</p>
                <div className="photo-library-card-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => handleOpenPhotoVariations(asset)}
                  >
                    Variations
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setSelectedMediaAssetId(asset.id);
                      setActivePhotoDetailsAsset(asset);
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="workspace-control-note photo-library-empty-state">
          No photos have been added to {group.label.toLowerCase()} yet.
        </p>
      ),
    });
  }

  function toggleFlyerPhotoSelection(assetId) {
    setFlyerSelectedPhotoIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId);
      }
      return [...current, assetId].slice(0, 4);
    });
  }

  function toggleReportPhotoSelection(assetId) {
    setReportSelectedPhotoIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId);
      }
      return [...current, assetId].slice(0, 4);
    });
  }

  function toggleReportSection(sectionId) {
    setReportIncludedSections((current) => {
      if (current.includes(sectionId)) {
        const nextSections = current.filter((id) => id !== sectionId);
        return nextSections.length ? nextSections : current;
      }
      return [...current, sectionId];
    });
  }

  async function handleDeleteSelectedPhoto() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset) {
      return;
    }
    const assetToDelete = pendingDeleteAsset || selectedMediaAsset;

    setStatus('Deleting photo...');
    setToast(null);
    try {
      await deleteMediaAssetRequest(assetToDelete.id);
      queryClient.removeQueries({
        queryKey: ['property-media-variants', assetToDelete.id],
        exact: true,
      });
      const nextAssets = await refreshMediaAssets('');
      await Promise.all([refreshDashboardSnapshot(), refreshChecklist(), refreshWorkflow()]);
      const nextSelectedAssetId = nextAssets[0]?.id || '';
      if (nextSelectedAssetId) {
        await refreshMediaVariants(nextSelectedAssetId);
      } else {
        queryClient.setQueryData(['property-media-variants', assetToDelete.id], []);
        setMediaVariants([]);
        setSelectedVariantId('');
      }
      setToast({
        tone: 'success',
        title: 'Photo deleted',
        message: 'The photo and any generated variants were removed from this property.',
      });
      setPendingDeleteAsset(null);
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not delete photo', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleDeleteArchivedProperty() {
    const storedSession = getStoredSession();
    const actorUserId = storedSession?.user?.id || '';
    if (!pendingDeleteProperty?.id || !actorUserId) {
      return;
    }

    setStatus('Deleting property...');
    setToast(null);

    try {
      await deletePropertyRequest(pendingDeleteProperty.id, actorUserId);
      const nextSession = {
        ...(storedSession || {}),
        lastPropertyId: '',
      };

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          DASHBOARD_FLASH_TOAST_KEY,
          JSON.stringify({
            tone: 'success',
            title: 'Property deleted',
            message: `${pendingDeleteProperty.title || 'The property'} and its linked outputs were removed permanently.`,
          }),
        );
      }

      setStoredSession(nextSession);
      router.push('/dashboard');
      router.refresh();
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not delete property',
        message: requestError.message,
      });
      setStatus('');
    }
  }

  async function handleGenerateVariant(presetKey = activeVisionPresetKey) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset) {
      return;
    }
    setActiveTab('vision');
    const stageKey = getVisionWorkflowStageForPreset(presetKey);
    setActiveVisionWorkflowStageKey(stageKey);
    setActiveVisionPresetKey(presetKey);
    const generationStartedAt = Date.now();
    let keepVisionGenerationState = false;
    const isDeclutterPreset = String(presetKey).includes('declutter');
    const isFurnitureRemovalPreset = presetKey === 'remove_furniture';
    const isCleanupPreset = presetKey === 'cleanup_empty_room';
    setVisionRecoveryState(null);
    setVisionCancellationPending(false);
    setStatus(
      isFurnitureRemovalPreset
        ? 'Generating furniture-removal preview...'
        : isCleanupPreset
        ? 'Generating cleanup pass...'
        : isDeclutterPreset
        ? 'Generating declutter variant...'
        : 'Generating enhanced listing version...',
    );
    setVisionGenerationState({
      kind: isFurnitureRemovalPreset
        ? 'furniture'
        : isCleanupPreset
        ? 'cleanup'
        : isDeclutterPreset
        ? 'declutter'
        : 'preset',
      title: isFurnitureRemovalPreset
        ? 'Furniture removal preview'
        : isCleanupPreset
        ? 'Empty-room cleanup pass'
        : isDeclutterPreset
        ? 'Declutter variant'
        : activeVisionPreset?.displayName || 'Vision enhancement',
      detail: isFurnitureRemovalPreset
        ? 'Generating a concept preview and checking whether fallback providers are needed.'
        : isCleanupPreset
        ? 'Refining the currently selected clean-room source and smoothing leftover artifacts.'
        : isDeclutterPreset
        ? 'Cleaning the photo up for listing use and reviewing the strongest result.'
        : 'Generating a stronger listing-ready version of the selected photo.',
      startedAt: generationStartedAt,
    });
    setToast(null);
    await primeVisionCompletionAudio();
    try {
      const response = await createImageEnhancementJob(selectedMediaAsset.id, {
        presetKey,
        roomType: selectedMediaAsset.roomLabel,
        forceRegenerate: true,
        sourceVariantId: workflowSourceVariantId || undefined,
        workflowStageKey: stageKey,
      });
      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshMediaVariants(selectedMediaAsset.id), refreshWorkflow()]);
      const completionToast = buildVisionCompletionToast({
        job: response.job,
        variant: response.variant,
        successTitle: isFurnitureRemovalPreset
          ? 'Furniture removal preview ready'
          : isCleanupPreset
          ? 'Cleanup pass ready'
          : isDeclutterPreset
          ? 'Declutter variant ready'
          : 'Enhanced photo ready',
        successMessage:
          'The new image is now shown in the Vision compare area and the Generated options panel.',
      });
      if (completionToast.nextVariantId) {
        setLatestGeneratedVariantId(completionToast.nextVariantId);
        setSelectedVariantId(completionToast.nextVariantId);
      }
      setToast(completionToast);
      if (completionToast.shouldScroll) {
        requestAnimationFrame(() => {
          visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      void playVisionCompletionSound({
        tone: 'success',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } catch (requestError) {
      if (requestError?.message === 'Failed to fetch') {
        try {
          const recoveredJob = await recoverVisionJobAfterDisconnect({
            assetId: selectedMediaAsset.id,
            presetKey,
            mode: 'preset',
            startedAt: generationStartedAt,
          });

          if (recoveredJob) {
            if (recoveredJob.status === 'completed' || recoveredJob.status === 'failed') {
              const settledJob = await reconcileRecoveredVisionJob(recoveredJob, selectedMediaAsset.id);
              const completionToast = buildVisionCompletionToast({
                job: settledJob,
                successTitle: 'Vision job recovered',
                successMessage:
                  'The browser lost the original request, but the vision job finished and the generated variant has been recovered.',
                warningTitle: 'Recovered with warning',
              });
              setToast(completionToast);
              if (completionToast.nextVariantId) {
                setLatestGeneratedVariantId(completionToast.nextVariantId);
              }
              void playVisionCompletionSound({
                tone: 'success',
                elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
              });
              return;
            }

            beginVisionRecovery({
              job: recoveredJob,
              assetId: selectedMediaAsset.id,
              mode: 'preset',
              presetKey,
              workflowStageKey: stageKey,
              startedAt: generationStartedAt,
              successTitle: 'Vision job recovered',
              successMessage:
                'The browser lost the original request, but the vision job finished and the generated variant has been recovered.',
              failureTitle: 'Variant generation failed',
            });
            keepVisionGenerationState = true;
            return;
          }
        } catch (recoveryError) {
          setToast({
            tone: 'error',
            title: 'Variant generation failed',
            message: `${recoveryError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
            autoDismissMs: 0,
          });
          void playVisionCompletionSound({
            tone: 'error',
            elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
          });
          return;
        }
      }

      setToast({
        tone: 'error',
        title: 'Variant generation failed',
        message: `${requestError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
        autoDismissMs: 0,
      });
      void playVisionCompletionSound({
        tone: 'error',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } finally {
      if (!keepVisionGenerationState) {
        setVisionGenerationState(null);
        setVisionCancellationPending(false);
        setStatus('');
      }
    }
  }

  function handleSelectVisionPreset(presetKey) {
    setActiveVisionPresetKey(presetKey);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        visionCurrentActionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 60);
    }
  }

  async function handleGenerateFreeformVariant() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset || !freeformEnhancementInstructions.trim()) {
      setToast({
        tone: 'error',
        title: 'Instructions required',
        message: 'Describe the enhancement you want before generating a custom preview.',
      });
      return;
    }

    setActiveTab('vision');
    setActiveVisionWorkflowStageKey('style');
    const generationStartedAt = Date.now();
    let keepVisionGenerationState = false;
    setVisionRecoveryState(null);
    setVisionCancellationPending(false);
    setStatus('Generating custom enhancement preview...');
    setVisionGenerationState({
      kind: 'freeform',
      title: 'Custom enhancement preview',
      detail: 'Applying your natural-language request, reviewing the generated result, and preparing a completion chime for longer runs.',
      startedAt: generationStartedAt,
    });
    setToast(null);
    await primeVisionCompletionAudio();
    try {
      const response = await createImageEnhancementJob(selectedMediaAsset.id, {
        mode: 'freeform',
        instructions: freeformEnhancementInstructions.trim(),
        roomType: selectedMediaAsset.roomLabel,
        forceRegenerate: true,
        sourceVariantId: workflowSourceVariantId || undefined,
        workflowStageKey: 'style',
      });
      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshMediaVariants(selectedMediaAsset.id),
        refreshWorkflow(),
      ]);
      setShowMoreVisionVariants(true);
      setActiveVisionPresetKey(
        response.job?.presetKey ||
          response.variant?.metadata?.presetKey ||
          response.variant?.variantType ||
          'combined_listing_refresh',
      );
      const completionToast = buildVisionCompletionToast({
        job: response.job,
        variant: response.variant,
        successTitle: 'Custom enhancement ready',
        successMessage:
          'Your freeform enhancement request was processed and the generated result is now selected in the Vision compare area.',
        warningTitle: 'Custom enhancement ready with warning',
      });
      if (completionToast.nextVariantId) {
        setLatestGeneratedVariantId(completionToast.nextVariantId);
        setSelectedVariantId(completionToast.nextVariantId);
      }
      setToast(completionToast);
      if (completionToast.shouldScroll) {
        requestAnimationFrame(() => {
          visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      void playVisionCompletionSound({
        tone: 'success',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } catch (requestError) {
      if (requestError?.message === 'Failed to fetch') {
        try {
          const recoveredJob = await recoverVisionJobAfterDisconnect({
            assetId: selectedMediaAsset.id,
            mode: 'freeform',
            startedAt: generationStartedAt,
          });

          if (recoveredJob) {
            if (recoveredJob.status === 'completed' || recoveredJob.status === 'failed') {
              const settledJob = await reconcileRecoveredVisionJob(recoveredJob, selectedMediaAsset.id);
              setShowMoreVisionVariants(true);
              setActiveVisionPresetKey(
                settledJob?.presetKey ||
                  settledJob?.variants?.[0]?.metadata?.presetKey ||
                  settledJob?.variants?.[0]?.variantType ||
                  'combined_listing_refresh',
              );
              const completionToast = buildVisionCompletionToast({
                job: settledJob,
                successTitle: 'Custom enhancement recovered',
                successMessage:
                  'The browser lost the original request, but the custom enhancement finished and the generated variant has been recovered.',
                warningTitle: 'Custom enhancement recovered with warning',
              });
              setToast(completionToast);
              if (completionToast.nextVariantId) {
                setLatestGeneratedVariantId(completionToast.nextVariantId);
              }
              void playVisionCompletionSound({
                tone: 'success',
                elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
              });
              return;
            }

            beginVisionRecovery({
              job: recoveredJob,
              assetId: selectedMediaAsset.id,
              mode: 'freeform',
              startedAt: generationStartedAt,
              successTitle: 'Custom enhancement recovered',
              successMessage:
                'The browser lost the original request, but the custom enhancement finished and the generated variant has been recovered.',
              failureTitle: 'Custom enhancement failed',
            });
            keepVisionGenerationState = true;
            return;
          }
        } catch (recoveryError) {
          setToast({
            tone: 'error',
            title: 'Custom enhancement failed',
            message: `${recoveryError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
            autoDismissMs: 0,
          });
          void playVisionCompletionSound({
            tone: 'error',
            elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
          });
          return;
        }
      }

      setToast({
        tone: 'error',
        title: 'Custom enhancement failed',
        message: `${requestError.message} No new variant was selected, so the compare view is still showing the last successful preview.`,
        autoDismissMs: 0,
      });
      void playVisionCompletionSound({
        tone: 'error',
        elapsedSeconds: getVisionGenerationDurationSeconds(generationStartedAt),
      });
    } finally {
      if (!keepVisionGenerationState) {
        setVisionGenerationState(null);
        setVisionCancellationPending(false);
        setStatus('');
      }
    }
  }

  async function handleSaveCurrentVisionResultToPhotos() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedVariant || !selectedMediaAsset) {
      return;
    }

    setStatus('Saving generated result to Photos...');
    setToast(null);
    try {
      const generationStage =
        selectedVariant?.metadata?.workflowStageKey === 'clean'
          ? 'clean_room'
          : selectedVariant?.metadata?.workflowStageKey === 'finish'
          ? 'finishes'
          : selectedVariant?.metadata?.workflowStageKey === 'style'
          ? 'style'
          : activeVisionWorkflowStageKey === 'clean'
          ? 'clean_room'
          : activeVisionWorkflowStageKey === 'finish'
          ? 'finishes'
          : 'style';
      const response = await saveVariantToPhotos(selectedVariant.id, {
        propertyId,
        roomLabel: selectedMediaAsset.roomLabel,
        generationStage,
        generationLabel: selectedVariant.label,
        listingCandidate: true,
      });

      await Promise.all([
        refreshMediaAssets(selectedMediaAsset.id),
        refreshDashboardSnapshot(),
        refreshChecklist(),
        refreshWorkflow(),
      ]);

      const savedAsset = response.asset || null;
      setToast({
        tone: 'success',
        title: 'Saved to Photos',
        message:
          response.created === false
            ? 'This AI-generated version was already in your photo library and is ready to review there.'
            : 'This AI-generated version has been added to your photo library.',
        actionLabel: savedAsset ? 'View in Photos' : '',
        onAction: savedAsset
          ? () => {
              setSelectedMediaAssetId(savedAsset.id);
              setActiveTab('photos');
              setToast(null);
            }
          : null,
        autoDismissMs: 9000,
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save to Photos',
        message: requestError.message,
        autoDismissMs: 0,
      });
    } finally {
      setStatus('');
    }
  }

  function handlePromoteVariantToNextStage() {
    if (!selectedVariant) {
      return;
    }

    const nextStageKey = getNextVisionWorkflowStageKey(activeVisionWorkflowStageKey);
    setWorkflowSourceVariantId(selectedVariant.id);
    setActiveVisionWorkflowStageKey(nextStageKey);
    if (nextStageKey !== 'final') {
      setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage(nextStageKey));
    }
    setShowVisionHistory(false);
    setToast({
      tone: 'success',
      title: 'Workflow source updated',
      message:
        nextStageKey === 'final'
          ? 'The selected result is now your final-review source. You can keep it as the winner and delete earlier drafts when ready.'
          : `${selectedVariant.label || 'The selected result'} is now the source for ${getVisionWorkflowStage(nextStageKey).title.toLowerCase()}.`,
    });
  }

  function handleResetVisionWorkflowSource() {
    setWorkflowSourceVariantId('');
    setActiveVisionWorkflowStageKey('clean');
    setActiveVisionPresetKey(getDefaultVisionPresetKeyForStage('clean'));
    setShowVisionHistory(false);
    setToast({
      tone: 'success',
      title: 'Workflow reset',
      message: 'Vision is back on the original photo so you can restart the staged workflow cleanly.',
    });
  }

  async function handlePruneVisionDraftHistory() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset || !selectedVariant) {
      return;
    }
    setPendingPruneVisionDrafts({
      assetId: selectedMediaAsset.id,
      roomLabel: selectedMediaAsset.roomLabel || 'this photo',
      variantId: selectedVariant.id,
      variantLabel: selectedVariant.label || 'the selected version',
    });
  }

  async function handleConfirmPruneVisionDraftHistory() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!pendingPruneVisionDrafts?.assetId || !pendingPruneVisionDrafts?.variantId) {
      return;
    }

    setStatus('Deleting earlier vision drafts...');
    try {
      const response = await pruneVisionDrafts(
        pendingPruneVisionDrafts.assetId,
        pendingPruneVisionDrafts.variantId,
      );
      const nextVariants = await refreshMediaVariants(pendingPruneVisionDrafts.assetId);
      setSelectedVariantId(
        nextVariants.find((variant) => variant.id === pendingPruneVisionDrafts.variantId)?.id ||
          nextVariants[0]?.id ||
          '',
      );
      setWorkflowSourceVariantId(pendingPruneVisionDrafts.variantId);
      setShowVisionHistory(false);
      setShowMoreVisionVariants(false);
      setToast({
        tone: 'success',
        title: 'Earlier drafts deleted',
        message:
          response.deletedCount > 0
            ? `${response.deletedCount} older vision draft${response.deletedCount === 1 ? '' : 's'} were removed.`
            : 'There were no earlier drafts to delete.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not delete drafts',
        message: requestError.message,
        autoDismissMs: 0,
      });
    } finally {
      setPendingPruneVisionDrafts(null);
      setStatus('');
    }
  }

  async function handleDeleteVisionVariant(variant) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!variant?.id) {
      return;
    }

    const savedPhotoForVariant = mediaAssets.find(
      (asset) => String(asset?.sourceVariantId || '') === String(variant.id),
    );
    setPendingDeleteVisionVariant({
      id: variant.id,
      assetId: String(variant.mediaId || selectedMediaAsset?.id || ''),
      label: variant.label || 'Selected attempt',
      imageUrl: variant.imageUrl,
      summary: getVariantSummary(variant),
      reviewScore: getVariantReviewScore(variant),
      savedPhotoLabel:
        savedPhotoForVariant?.roomLabel || savedPhotoForVariant?.generationLabel || '',
    });
  }

  async function handleConfirmDeleteSelectedPhotoVariations() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!pendingDeletePhotoVariationIds.length) {
      return;
    }

    const variantsToDelete = photoVariations.filter((variant) =>
      pendingDeletePhotoVariationIds.includes(variant.id),
    );
    if (!variantsToDelete.length) {
      setPendingDeletePhotoVariationIds([]);
      setSelectedPhotoVariationIds([]);
      setIsSelectingPhotoVariations(false);
      return;
    }

    setPendingDeletePhotoVariationIds([]);
    setStatus(
      `Deleting ${variantsToDelete.length} variation${variantsToDelete.length === 1 ? '' : 's'}...`,
    );
    setToast(null);

    let deletedCount = 0;
    const failedLabels = [];

    try {
      for (const variant of variantsToDelete) {
        try {
          await deleteVisionVariantByDescriptor(variant, {
            showSuccessToast: false,
            refreshAfterDelete: false,
          });
          deletedCount += 1;
        } catch (error) {
          failedLabels.push(variant.label || 'Selected variation');
        }
      }

      const refreshAssetId =
        String(resolvedActivePhotoVariationsAsset?.id || '') ||
        String(variantsToDelete[0]?.mediaId || '');
      if (refreshAssetId) {
        void Promise.all([
          refreshMediaVariants(refreshAssetId),
          refreshMediaAssets(refreshAssetId),
          refreshWorkflow(),
        ]).catch(() => {});
      }

      setSelectedPhotoVariationIds([]);
      setIsSelectingPhotoVariations(false);

      if (failedLabels.length) {
        setToast({
          tone: deletedCount ? 'warning' : 'error',
          title: deletedCount ? 'Some variations deleted' : 'Could not delete selected variations',
          message: deletedCount
            ? `${deletedCount} variation${deletedCount === 1 ? '' : 's'} deleted. ${failedLabels.length} could not be removed.`
            : `None of the selected variations could be removed.`,
          autoDismissMs: 0,
        });
      } else {
        setToast({
          tone: 'success',
          title: 'Selected variations deleted',
          message: `${deletedCount} variation${deletedCount === 1 ? '' : 's'} were removed permanently from this photo's Vision history.`,
        });
      }
    } finally {
      setStatus('');
    }
  }

  function handleViewVisionVariant(variant, { closeHistory = false } = {}) {
    if (!variant?.id) {
      return;
    }
    setSelectedVariantId(variant.id);
    setActiveVisionWorkflowStageKey(
      variant.metadata?.workflowStageKey ||
        getVisionWorkflowStageForPreset(
          variant.metadata?.presetKey || variant.variantType,
        ),
    );
    if (closeHistory) {
      setShowVisionHistory(false);
    }
    requestAnimationFrame(() => {
      scrollWorkspaceSectionIntoView(visionCompareRef);
    });
  }

  async function handleConfirmDeleteVisionVariant() {
    if (blockArchivedMutation()) {
      return;
    }
    if (!pendingDeleteVisionVariant?.id) {
      return;
    }

    const variantToDelete = pendingDeleteVisionVariant;

    setPendingDeleteVisionVariant(null);
    setStatus('Deleting vision attempt...');
    setToast(null);
    try {
      await deleteVisionVariantByDescriptor(variantToDelete);
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not delete attempt',
        message: requestError.message,
        autoDismissMs: 0,
      });
    } finally {
      setStatus('');
    }
  }

  async function handleExportSocialPack() {
    if (blockArchivedMutation()) {
      return;
    }

    setStatus('Preparing social ad pack export...');
    setToast(null);
    try {
      const response = await generateSocialPack(propertyId);
      const socialPack = response.socialPack;
      setLatestSocialPack(socialPack);
      const blob = new Blob([socialPack?.markdown || ''], {
        type: 'text/markdown;charset=utf-8',
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${property?.title || 'property'}-social-ad-pack.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setToast({
        tone: 'success',
        title: 'Social ad pack exported',
        message: 'The latest social ad pack was refreshed and the markdown export download has started.',
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Social pack failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleImportPhotoFiles(fileList) {
    if (blockArchivedMutation()) {
      return;
    }

    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) {
      return;
    }

    setStatus(`Uploading ${files.length} photo${files.length === 1 ? '' : 's'}...`);
    setToast(null);
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const [, imageBase64 = ''] = dataUrl.split(',');
        await savePhoto(propertyId, {
          roomLabel: photoImportRoomLabel,
          source: photoImportSource,
          notes: photoImportNotes,
          mimeType: file.type || 'image/jpeg',
          imageBase64,
        });
      }

      const nextAssets = await refreshMediaAssets();
      if (nextAssets[0]?.id) {
        await refreshMediaVariants(nextAssets[0].id);
      }
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setPhotoImportNotes('');
      setToast({
        tone: 'success',
        title: 'Photos imported',
        message: `${files.length} photo${files.length === 1 ? '' : 's'} added to this property.`,
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Photo import failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSelectVariant(variantId) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!selectedMediaAsset) {
      return;
    }
    setStatus('Selecting preferred variant...');
    setToast(null);
    try {
      await selectMediaVariant(selectedMediaAsset.id, variantId);
      await Promise.all([refreshMediaAssets(selectedMediaAsset.id), refreshMediaVariants(selectedMediaAsset.id), refreshWorkflow()]);
      setSelectedVariantId(variantId);
      requestAnimationFrame(() => {
        scrollWorkspaceSectionIntoView(visionCompareRef);
      });
      setToast({ tone: 'success', title: 'Preferred variant selected', message: 'Flyer and report generation will now prefer this image variant.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not select variant', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSetChecklistItemStatus(itemId, nextStatus) {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus(nextStatus === 'done' ? 'Marking checklist item done...' : 'Updating checklist item...');
    setToast(null);
    try {
      const response = await updateChecklistItem(itemId, { status: nextStatus });
      queryClient.setQueryData(['property-checklist', propertyId], response.checklist);
      setChecklist(response.checklist);
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setToast({ tone: 'success', title: 'Checklist updated', message: 'Seller prep progress has been saved.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Checklist update failed', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleCreateChecklistTask(event) {
    event.preventDefault();
    if (blockArchivedMutation()) {
      return;
    }
    if (!customChecklistTitle.trim()) {
      setToast({ tone: 'error', title: 'Task title required', message: 'Add a short title before creating a custom checklist task.' });
      return;
    }
    setStatus('Saving custom checklist task...');
    setToast(null);
    try {
      const response = await createChecklistItem(propertyId, { title: customChecklistTitle, detail: customChecklistDetail, category: 'custom', priority: 'medium' });
      queryClient.setQueryData(['property-checklist', propertyId], response.checklist);
      setChecklist(response.checklist);
      await Promise.all([refreshDashboardSnapshot(), refreshWorkflow()]);
      setCustomChecklistTitle('');
      setCustomChecklistDetail('');
      setToast({ tone: 'success', title: 'Task added', message: 'The custom checklist task now appears in the shared property workflow.' });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not add task', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveProvider(providerId) {
    if (blockArchivedMutation()) {
      return;
    }
    setStatus('Saving provider...');
    setToast(null);
    try {
      await saveProvider(propertyId, providerId);
      setProviderRecommendations((current) =>
        current.map((provider) =>
          provider.id === providerId ? { ...provider, saved: true } : provider,
        ),
      );
      setToast({
        tone: 'success',
        title: 'Provider saved',
        message: 'This provider is now attached to the property workflow for later follow-up.',
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not save provider', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleSaveProviderReference(provider, source = 'internal') {
    if (blockArchivedMutation()) {
      return;
    }

    setStatus('Saving provider reference...');
    setToast(null);
    try {
      await createProviderReference(propertyId, {
        source,
        sourceRefId:
          source === 'google_maps'
            ? provider.sourceRefId || provider.id
            : provider.id,
        providerId: source === 'internal' ? provider.id : undefined,
        categoryKey: provider.categoryKey,
        categoryLabel: providerSuggestionTask?.providerCategoryLabel || provider.categoryLabel || '',
        businessName: provider.businessName,
        description: provider.description,
        coverageLabel: provider.coverageLabel,
        city: provider.city,
        state: provider.state,
        email: provider.email,
        phone: provider.phone,
        websiteUrl: provider.websiteUrl,
        mapsUrl: provider.mapsUrl,
        rating: provider.rating,
        reviewCount: provider.reviewCount,
      });
      await refreshProviderReferences();
      setToast({
        tone: 'success',
        title: 'Added to reference sheet',
        message: `${provider.businessName} is now saved for the printable provider reference sheet.`,
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not save provider reference', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleRemoveProviderReference(referenceId) {
    if (blockArchivedMutation()) {
      return;
    }

    setStatus('Removing provider reference...');
    setToast(null);
    try {
      await deleteProviderReference(referenceId);
      await refreshProviderReferences();
      setToast({
        tone: 'success',
        title: 'Reference removed',
        message: 'The provider reference has been removed from the printable shortlist.',
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not remove provider reference', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  async function handleRequestProviderLead(provider) {
    if (blockArchivedMutation()) {
      return;
    }
    if (!providerSuggestionTask) {
      return;
    }

    setStatus('Requesting provider contact...');
    setToast(null);
    try {
      await createProviderLead(propertyId, {
        categoryKey: provider.categoryKey,
        source: 'checklist_task',
        sourceRefId: providerSuggestionTask.systemKey || providerSuggestionTask.id,
        deliveryMode: 'sms_and_email',
        message:
          providerSuggestionTask.providerPrompt ||
          providerSuggestionTask.detail ||
          `Seller requested ${providerSuggestionTask.providerCategoryLabel || provider.categoryKey} support.`,
        maxProviders: 3,
      });
      await refreshProviderLeads();
      await refreshWorkflow();
      setToast({
        tone: 'success',
        title: 'Lead request created',
        message: `The ${provider.categoryKey.replace(/_/g, ' ')} request is now queued for provider outreach.`,
      });
    } catch (requestError) {
      setToast({ tone: 'error', title: 'Could not request provider', message: requestError.message });
    } finally {
      setStatus('');
    }
  }

  function handleDownloadFlyerPdf() {
    return handleFileDownload(
      getFlyerExportUrl(propertyId, flyerType),
      `${property?.slug || property?.title || 'property'}-flyer.pdf`,
      'Flyer PDF downloaded',
    );
  }

  function handleDownloadReportPdf() {
    return handleFileDownload(
      getReportExportUrl(propertyId),
      `${property?.slug || property?.title || 'property'}-seller-report.pdf`,
      'Seller report PDF downloaded',
    );
  }

  function openGenerationPrompt(kind) {
    if (kind === 'flyer') {
      setGenerationPrompt({
        kind,
        title: 'Flyer ready',
        message: 'Your flyer finished generating. You can stay here or download the PDF now.',
        downloadLabel: 'Download PDF',
      });
      return;
    }

    setGenerationPrompt({
      kind,
      title: 'Seller report ready',
      message: 'Your seller intelligence report finished generating. You can stay here or download the PDF now.',
      downloadLabel: 'Download report PDF',
    });
  }

  async function handleDownloadGeneratedDocument() {
    if (!generationPrompt) {
      return;
    }

    if (generationPrompt.kind === 'flyer') {
      await handleDownloadFlyerPdf();
    } else {
      await handleDownloadReportPdf();
    }

    setGenerationPrompt(null);
  }

  function handleDownloadProviderReferenceSheet() {
    return handleFileDownload(
      getProviderReferenceSheetExportUrl(propertyId),
      `${property?.slug || property?.title || 'property'}-provider-reference-sheet.pdf`,
      'Reference sheet PDF downloaded',
    );
  }

  async function handleFileDownload(downloadUrl, fallbackFileName, successTitle) {
    setStatus('Preparing PDF download...');
    setToast(null);
    try {
      const { blob, fileName } = await downloadFile(downloadUrl, fallbackFileName);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName || fallbackFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setToast({
        tone: 'success',
        title: successTitle,
        message: 'Your file download has started.',
      });
    } catch (downloadError) {
      setToast({
        tone: 'error',
        title: 'Could not download PDF',
        message: downloadError.message,
      });
    } finally {
      setStatus('');
    }
  }

  const addressQuery = buildAddressQuery(property);
  const googleMapsUrl = useMemo(
    () => buildGoogleMapsRouteUrl(property, selectedComps),
    [property, selectedComps],
  );

  const renderOverviewTab = () => (
    <div className="workspace-tab-stack">
      <div className="content-card workspace-hero-card">
        <span className="label">Overview</span>
        <h2>Snapshot for this property</h2>
        <p>{latestReport?.executiveSummary || latestPricing?.summary || dashboard?.pricingSummary || 'Use the workspace tabs to move from pricing to photos, brochure, report, and checklist work.'}</p>
        <div className="mini-stats">
          <div className="stat-card">
            <strong>Price band</strong>
            <span>{latestPricing ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(latestPricing.recommendedListHigh)}` : 'Run pricing analysis'}</span>
          </div>
          <div className="stat-card">
            <strong>Chosen list price</strong>
            <span>{property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set yet'}</span>
          </div>
          <div className="stat-card">
            <strong>Confidence</strong>
            <span>{latestPricing?.confidenceScore ? `${Math.round(latestPricing.confidenceScore * 100)}%` : 'Pending'}</span>
          </div>
          <div className="stat-card">
            <strong>Readiness</strong>
            <span>{readinessScore}/100</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">AI summary</span>
        <h2>What the workspace is signaling</h2>
        <p>{latestReport?.payload?.marketingGuidance?.shortDescription || latestPricing?.pricingStrategy || 'The strongest next step is to turn pricing and photo selection into brochure and report output.'}</p>
        <ul className="plain-list">
          <li>{listingCandidateAssets.length} seller-selected photo pick(s)</li>
          <li>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred vision variant(s)</li>
          <li>{checklist?.summary?.completedCount ?? 0} checklist task(s) complete</li>
        </ul>
      </div>

      <div className="content-card">
        <span className="label">Recent outputs</span>
        <h2>Latest deliverables</h2>
        {recentOutputs.length ? (
          <div className="workspace-output-list">
            {recentOutputs.map((output) => (
              <button key={output.key} type="button" className="workspace-output-card" onClick={() => setActiveTab(output.tab)}>
                <span className="label">{output.label}</span>
                <strong>{output.title}</strong>
                <span>{output.detail}</span>
              </button>
            ))}
          </div>
        ) : (
          <p>No brochure or report output has been generated yet.</p>
        )}
      </div>
    </div>
  );

  const renderPricingTab = () => (
    <div className="workspace-tab-stack">
      <div className="workspace-two-column workspace-pricing-grid">
        <div className="content-card property-map-card">
          <div className="property-map-header">
            <div>
              <span className="label">Pricing map</span>
              <h2>Neighborhood context</h2>
              <p>Review the home and nearby comps side by side instead of in a long stack.</p>
            </div>
            {addressQuery ? (
              <div className="property-map-actions">
                <button
                  type="button"
                  className="button-secondary inline-button button-no-wrap property-map-link"
                  onClick={() => setShowExpandedMap(true)}
                  title="Open a larger in-app map with the property and selected comps."
                >
                  Expand map
                </button>
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button button-no-wrap property-map-link"
                    title="Open the subject property and selected comps in Google Maps."
                  >
                    View comps in Maps
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          {addressQuery ? (
            <PropertyLocationMap property={property} comps={selectedComps} mapsApiKey={mapsApiKey} googleMapsUrl={googleMapsUrl} />
          ) : (
            <p>No map available until the property address is complete.</p>
          )}
        </div>

        <div className="content-card workspace-side-panel">
          <div className="section-header-tight">
            <div>
              <span className="label">Selected comps</span>
              <h2>Nearby sales</h2>
            </div>
            <span className="section-header-meta">{selectedComps.length} comps shown</span>
          </div>
          <div className="comp-grid comp-grid-scroll workspace-scroll-panel">
            {selectedComps.length ? (
              selectedComps.map((comp) => (
                <article key={comp.externalId || comp._id || comp.address} className="comp-card">
                  <strong>{comp.address}</strong>
                  <span>{formatCurrency(comp.price)}</span>
                  <span>{(comp.distanceMiles || 0).toFixed(2)} mi away</span>
                  <span>{comp.beds || '--'} bd · {comp.baths || '--'} ba · {comp.sqft || '--'} sqft</span>
                  {comp.saleDate ? <span>Sold/listed: {new Date(comp.saleDate).toLocaleDateString()}</span> : null}
                  {typeof comp.score === 'number' ? <span>Comp score: {Math.round(comp.score * 100)}</span> : null}
                </article>
              ))
            ) : (
              <p>No comps are stored yet. Refresh pricing to build the comp set.</p>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">Selected list price</span>
        <h2>Choose the price you want to market</h2>
        <p>
          The pricing analysis gives you a suggested range. This is where you confirm the actual list
          price that should carry into future brochure and report generation.
        </p>
        <div className="pricing-summary-grid">
          <div className="stat-card pricing-summary-stat">
            <strong>Suggested range</strong>
            <span>
              {latestPricing
                ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(
                    latestPricing.recommendedListHigh,
                  )}`
                : 'Run pricing first'}
            </span>
          </div>
          <div className="stat-card pricing-summary-stat">
            <strong>Recommended midpoint</strong>
            <span>
              {latestPricing?.recommendedListMid
                ? formatCurrency(latestPricing.recommendedListMid)
                : 'Not available yet'}
            </span>
          </div>
          <div className="stat-card pricing-summary-stat">
            <strong>Chosen list price</strong>
            <span>
              {property?.selectedListPrice
                ? formatCurrency(property.selectedListPrice)
                : 'Not set yet'}
            </span>
          </div>
        </div>
        <div className="workspace-inner-card pricing-decision-card">
          <div className="pricing-decision-layout">
            <div className="pricing-decision-copy">
              <span className="label">Quick picks</span>
              <h3>Choose a starting point</h3>
              <p>Pick one of the recommendations or enter your own custom price.</p>
              <div className="pricing-decision-chip-row">
                {pricingQuickPickOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={
                      selectedListPriceSourceDraft === option.key
                        ? 'checklist-action-chip active'
                        : 'checklist-action-chip'
                    }
                    onClick={() => {
                      setSelectedListPriceDraft(String(option.value));
                      setSelectedListPriceSourceDraft(option.key);
                    }}
                  >
                    {option.label}: {formatCurrency(option.value)}
                  </button>
                ))}
                <button
                  type="button"
                  className={
                    selectedListPriceSourceDraft === 'custom'
                      ? 'checklist-action-chip active'
                      : 'checklist-action-chip'
                  }
                  onClick={() => setSelectedListPriceSourceDraft('custom')}
                >
                  Custom
                </button>
              </div>
            </div>
            <div className="pricing-decision-form">
              <label className="workspace-control-field workspace-control-field-full">
                <span>Chosen list price</span>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={selectedListPriceDraft}
                  onChange={(event) => {
                    setSelectedListPriceDraft(event.target.value);
                    setSelectedListPriceSourceDraft('custom');
                  }}
                  placeholder="389000"
                />
              </label>
              <button
                type="button"
                className="button-primary pricing-save-button"
                onClick={handleSaveSelectedListPrice}
                disabled={Boolean(status) || !selectedListPriceDraft || isArchivedProperty}
              >
                Save chosen price
              </button>
              <p className="workspace-control-note">
                This does not change the suggested range. It stores the price you intend to use in future materials.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <span className="label">Pricing narrative</span>
        <h2>Latest analysis</h2>
        <p>{latestPricing?.summary || dashboard?.pricingSummary || 'No stored narrative yet.'}</p>
        {latestPricing?.pricingStrategy ? <p><strong>Strategy:</strong> {latestPricing.pricingStrategy}</p> : null}
      </div>
    </div>
  );

  const renderPhotosTab = () => (
    <div className="workspace-tab-stack">
        {renderCollapsibleSection({
          sectionKey: 'photos_import',
          label: 'Photos',
          title: 'Import photos',
          meta: `${mediaAssets.length} saved`,
          defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.photos_import,
          className: 'content-card workspace-collapsible-section photo-import-section',
          children: (
            <div
              className="workspace-inner-card brochure-control-card photo-import-card-compact"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleImportPhotoFiles(event.dataTransfer?.files);
              }}
            >
              <div className="brochure-control-grid brochure-control-grid-form">
                <label className="workspace-control-field">
                  <span>Import source</span>
                  <select
                    className="select-input"
                    value={photoImportSource}
                    onChange={(event) => setPhotoImportSource(event.target.value)}
                  >
                    {PHOTO_IMPORT_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="workspace-control-field">
                  <span>Room label</span>
                  <input
                    type="text"
                    value={photoImportRoomLabel}
                    onChange={(event) => setPhotoImportRoomLabel(event.target.value)}
                    placeholder="Kitchen"
                  />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Notes</span>
                  <textarea
                    value={photoImportNotes}
                    onChange={(event) => setPhotoImportNotes(event.target.value)}
                    placeholder="Add optional context for imported third-party or web-uploaded photos."
                    maxLength={500}
                  />
                </label>
              </div>
              <label className="button-secondary inline-button" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                Upload or drop photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(event) => handleImportPhotoFiles(event.target.files)}
                />
              </label>
              <p className="workspace-control-note">
                Drag-and-drop works here too. Import first, then choose one room photo and continue into Vision.
              </p>
            </div>
          ),
        })}

        <section className="photo-library-workspace-card">
          {photoCategoryGroups.map((group) => renderPhotoLibrarySection(group))}
        </section>
    </div>
  );

  const renderSellerPicksTab = () => (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'seller_picks_summary',
        label: 'Seller picks',
        title: 'Current listing candidates',
        meta: `${listingCandidateAssets.length} selected`,
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.seller_picks_summary,
        className: 'content-card workspace-collapsible-section',
        children: listingCandidateAssets.length ? (
          <div className="workspace-tab-stack">
            <p className="workspace-control-note">
              These are the photos currently prioritized for the flyer, report, and listing flow.
              Open details for a closer review or continue editing one in the Vision workspace.
            </p>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Seller picks</strong>
                <span>{listingCandidateAssets.length} chosen</span>
              </div>
              <div className="stat-card">
                <strong>Originals</strong>
                <span>
                  {listingCandidateAssets.filter((asset) => asset.assetType !== 'generated').length}
                </span>
              </div>
              <div className="stat-card">
                <strong>Saved from Vision</strong>
                <span>
                  {listingCandidateAssets.filter((asset) => asset.savedFromVision).length}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="workspace-tab-stack">
            <p>No seller picks have been chosen yet.</p>
            <button
              type="button"
              className="button-primary"
              onClick={() => setActiveTab('photos')}
            >
              Go to Photos
            </button>
          </div>
        ),
      })}

      {sellerPickCategoryGroups.map((group) =>
        renderCollapsibleSection({
          sectionKey: `seller_picks_room_${group.key}`,
          label: 'Seller picks',
          title: group.label,
          meta: `${group.assets.length} photo${group.assets.length === 1 ? '' : 's'}`,
          defaultOpen: true,
          className: 'content-card workspace-collapsible-section photo-library-section',
          children: (
            <div className="photo-room-grid">
              {group.assets.map((asset) => (
                <article
                  key={`seller-pick-${asset.id}`}
                  className={
                    asset.id === selectedMediaAsset?.id
                      ? 'photo-library-card active'
                      : 'photo-library-card'
                  }
                >
                  <button
                    type="button"
                    className="photo-library-card-preview"
                    onClick={() => {
                      setSelectedMediaAssetId(asset.id);
                      setActivePhotoDetailsAsset(asset);
                    }}
                  >
                    <img src={asset.imageUrl} alt={asset.roomLabel || 'Seller pick'} />
                  </button>
                  <div className="photo-library-card-body">
                    <div className="photo-card-badge-row">
                      <span className="photo-card-status-pill">
                        {getMediaAssetPrimaryLabel(asset)}
                      </span>
                      <span className="photo-card-action-pill active">Seller Pick</span>
                    </div>
                    <strong>{asset.roomLabel}</strong>
                    <p className="photo-card-summary">{getMediaAssetSummary(asset)}</p>
                    <div className="photo-library-card-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          setSelectedMediaAssetId(asset.id);
                          setActivePhotoDetailsAsset(asset);
                        }}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleOpenAssetInVision(asset)}
                      >
                        Open in Vision
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ),
        }),
      )}
    </div>
  );

  const renderVisionTab = () => (
    <div className="workspace-tab-stack">
      <div ref={visionCompareRef} className="content-card">
        <div className="section-header-tight">
          <div>
            <span className="label">Single-photo vision workspace</span>
            <h2>Before and after</h2>
          </div>
          <span className="section-header-meta">
            {selectedVariant ? `Current workflow draft: ${selectedVariant.label}` : 'No draft selected yet'}
          </span>
        </div>
        {selectedMediaAsset ? (
          <div className="property-media-variant-panel">
            <div className="vision-context-header">
              <div className="vision-context-item">
                <span className="label">Editing</span>
                <strong>
                  {selectedMediaAsset.assetType === 'generated'
                    ? `${selectedMediaAsset.roomLabel || 'Selected photo'} · ${selectedMediaAsset.generationLabel || getMediaAssetPrimaryLabel(selectedMediaAsset)}`
                    : selectedMediaAsset.roomLabel || 'Selected photo'}
                </strong>
              </div>
              <div className="vision-context-item">
                <span className="label">Source</span>
                <strong>
                  {workflowSourceVariant
                    ? workflowSourceVariant.label
                    : selectedGeneratedAssetAsResult
                    ? selectedMediaAssetSourceAsset?.roomLabel || 'Original photo'
                    : 'Original photo'}
                </strong>
              </div>
              <div className="vision-context-item">
                <span className="label">Current stage</span>
                <strong>{activeVisionWorkflowStage.title}</strong>
              </div>
              <div className="vision-context-item">
                <span className="label">Current result</span>
                <strong>{effectiveVisionResultLabel}</strong>
              </div>
            </div>
            {selectedVariant || selectedGeneratedAssetAsResult ? (
              <div className="property-media-slider-card">
                <span className="label">Before / after slider</span>
                <p className="property-media-variant-caption">{effectiveVisionResultSummary}</p>
                <div className="property-media-slider-shell">
                  <ReactCompareSlider
                    itemOne={
                      <ReactCompareSliderImage
                        src={compareSourceImageUrl}
                        alt={compareSourceLabel || 'Current workflow source'}
                      />
                    }
                    itemTwo={
                      <ReactCompareSliderImage
                        src={effectiveVisionResultImageUrl}
                        alt={effectiveVisionResultLabel || 'Generated image variant'}
                      />
                    }
                  />
                </div>
                <div className="tag-row">
                  <span>{compareSourceVariant || selectedGeneratedAssetAsResult ? 'Stage source' : 'Original'}</span>
                  <span>{selectedVariant?.variantCategory === 'concept_preview' ? 'Concept Preview' : 'Enhanced'}</span>
                  <span>{activeVisionWorkflowStage.title}</span>
                </div>
              </div>
            ) : null}
            <div className="property-media-variant-compare">
              <div>
                <span className="label">{compareSourceVariant ? 'Current stage input' : 'Original'}</span>
                <p className="property-media-variant-caption">
                  {compareSourceVariant
                    ? `The selected output was generated from ${compareSourceLabel}.`
                    : 'Untouched mobile capture.'}
                </p>
                <img src={compareSourceImageUrl} alt={compareSourceLabel || 'Original property photo'} className="property-media-variant-image" />
              </div>
              <div>
                <span className="label">Vision output</span>
                <p className="property-media-variant-caption">
                  {effectiveVisionResultSummary}
                </p>
                {effectiveVisionResultImageUrl ? (
                  <img src={effectiveVisionResultImageUrl} alt={effectiveVisionResultLabel || 'Generated image result'} className="property-media-variant-image" />
                ) : (
                  <div className="property-media-variant-empty">Generate your first stage action to start the workspace history for this photo.</div>
                )}
              </div>
            </div>
            {selectedVariant?.metadata?.effects?.length ? (
              <div className="property-media-variant-effects">
                {selectedVariant.metadata.effects.map((effect) => <span key={effect}>{effect}</span>)}
              </div>
            ) : null}
            {selectedVariant?.metadata?.differenceHint ? <p className="property-media-variant-hint">{selectedVariant.metadata.differenceHint}</p> : null}
            {selectedVariant?.metadata?.review?.shouldHideByDefault ? (
              <div className="property-media-review-note">
                <strong>Needs extra review</strong>
                <p>{selectedVariant.metadata.review.summary || 'This output ranked lower due to realism or artifact risk.'}</p>
              </div>
            ) : null}
            {selectedVariant ? <p className="workspace-control-note">{getVariantDisclaimer(selectedVariant)}</p> : null}
            {selectedVariant ? (
              <div className="mini-stats">
                <div className="stat-card">
                  <strong>Stage</strong>
                  <span>{getVisionWorkflowStage(selectedVariant.metadata?.workflowStageKey || getVisionWorkflowStageForPreset(selectedVariant.metadata?.presetKey || selectedVariant.variantType)).title}</span>
                </div>
                <div className="stat-card">
                  <strong>Source</strong>
                  <span>{selectedVariant.metadata?.sourceLabel || compareSourceLabel}</span>
                </div>
                <div className="stat-card">
                  <strong>Quality review</strong>
                  <span>{getVariantReviewScore(selectedVariant) ? `${getVariantReviewScore(selectedVariant)}/100` : 'Pending'}</span>
                </div>
                <div className="stat-card">
                  <strong>Structural realism</strong>
                  <span>{selectedVariant.metadata?.review?.structuralIntegrityScore ? `${selectedVariant.metadata.review.structuralIntegrityScore}/100` : 'Pending'}</span>
                </div>
                <div className="stat-card">
                  <strong>Preset</strong>
                  <span>{selectedVariant.metadata?.presetKey || selectedVariant.variantType}</span>
                </div>
                <div className="stat-card">
                  <strong>Created</strong>
                  <span>{selectedVariant.createdAt ? new Date(selectedVariant.createdAt).toLocaleString() : 'Just now'}</span>
                </div>
              </div>
            ) : null}
            {selectedVariant ? (
              <div className="vision-result-actions-card">
                <div className="workspace-tab-stack">
                  <span className="label">Current result</span>
                  <strong>{selectedVariant.label || 'Generated result'}</strong>
                  <p>
                    {getVariantSummary(selectedVariant)}
                  </p>
                  {savedAssetForSelectedVariant ? (
                    <p className="workspace-control-note">
                      This result is already saved in Photos as <strong>{savedAssetForSelectedVariant.roomLabel}</strong>.
                    </p>
                  ) : null}
                </div>
                <div className="vision-result-actions">
                  <button
                    type="button"
                    className={savedAssetForSelectedVariant ? 'button-secondary' : 'button-primary'}
                    onClick={savedAssetForSelectedVariant ? () => {
                      setSelectedMediaAssetId(savedAssetForSelectedVariant.id);
                      setActiveTab('photos');
                    } : handleSaveCurrentVisionResultToPhotos}
                    disabled={Boolean(status) || isArchivedProperty}
                  >
                    {savedAssetForSelectedVariant ? 'View in Photos' : 'Save as Listing Photo'}
                  </button>
                  {activeVisionWorkflowStage.key !== 'final' ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={handlePromoteVariantToNextStage}
                      disabled={Boolean(status) || isArchivedProperty}
                    >
                      {`Use this result for ${getVisionWorkflowStage(getNextVisionWorkflowStageKey(activeVisionWorkflowStageKey)).title.toLowerCase()}`}
                    </button>
                  ) : null}
                  {latestGeneratedVariant && selectedVariant && latestGeneratedVariant.id !== selectedVariant.id ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setSelectedVariantId(latestGeneratedVariant.id);
                        requestAnimationFrame(() => {
                          scrollWorkspaceSectionIntoView(visionCompareRef);
                        });
                      }}
                    >
                      Return to latest generated result
                    </button>
                  ) : null}
                </div>
              </div>
            ) : selectedGeneratedAssetAsResult ? (
              <div className="vision-result-actions-card">
                <div className="workspace-tab-stack">
                  <span className="label">Current result</span>
                  <strong>{effectiveVisionResultLabel}</strong>
                  <p>{effectiveVisionResultSummary}</p>
                  <p className="workspace-control-note">
                    This saved Vision result is the current source for the next stage. Generate the next step when you are ready, or reopen the original photo if you want to branch from the beginning.
                  </p>
                </div>
                <div className="vision-result-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setActiveTab('photos')}
                  >
                    View in Photos
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setActivePhotoDetailsAsset(selectedMediaAsset)}
                  >
                    View details
                  </button>
                </div>
              </div>
            ) : null}
            {selectedVariant || selectedGeneratedAssetAsResult ? (
              <p className="workspace-control-note">
                Work on one photo at a time here. The current result stays in focus, and older drafts live in the workflow history drawer below.
              </p>
            ) : null}
          </div>
        ) : (
          <p>Select a photo in the Photos tab first to use the Vision workspace.</p>
        )}
      </div>

      <div className="workspace-two-column vision-workflow-layout">
        <div className="content-card vision-workspace-card">
          <span className="label">Workspace steps</span>
          <h2>Guide this photo stage by stage</h2>
          {selectedMediaAsset ? (
            <>
              <div className="workspace-tab-stack">
                <div className="workspace-inner-card brochure-control-card vision-source-card">
                  <span className="label">Editing photo</span>
                  <strong>{selectedMediaAsset.roomLabel || 'Property photo'}</strong>
                  <p>
                    Work on one source photo at a time. Other property photos stay hidden unless you open the photo picker.
                  </p>
                  <div className="tag-row">
                    <span>{workflowSourceVariant ? `Current source: ${workflowSourceVariant.label}` : 'Current source: Original photo'}</span>
                    <span>{activeVisionWorkflowStage.title}</span>
                  </div>
                  <div className="workspace-action-column vision-workflow-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setShowVisionPhotoPicker((current) => !current)}
                    >
                      {showVisionPhotoPicker ? 'Hide photo picker' : 'Choose a different photo'}
                    </button>
                    {selectedVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={handlePromoteVariantToNextStage}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        {activeVisionWorkflowStage.key === 'final'
                          ? 'Keep selected result for final review'
                          : `Use this result for ${getVisionWorkflowStage(getNextVisionWorkflowStageKey(activeVisionWorkflowStageKey)).title.toLowerCase()}`}
                      </button>
                    ) : null}
                    {workflowSourceVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={handleResetVisionWorkflowSource}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        Reset to original photo
                      </button>
                    ) : null}
                  </div>
                  {showVisionPhotoPicker ? (
                    <div className="vision-photo-picker property-media-rail property-photo-grid compact">
                      {mediaAssets.map((asset) => (
                        <button
                          key={`vision-source-${asset.id}`}
                          type="button"
                          className={asset.id === selectedMediaAsset?.id ? 'property-media-thumb active' : 'property-media-thumb'}
                          onClick={() => setSelectedMediaAssetId(asset.id)}
                        >
                          <img src={asset.imageUrl} alt={asset.roomLabel || 'Property photo'} />
                          <div>
                            <strong>{asset.roomLabel}</strong>
                            <small>{asset.generationLabel || getMediaAssetPrimaryLabel(asset)}</small>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="vision-stage-rail">
                  {VISION_WORKFLOW_STAGES.map((stage) => (
                    <button
                      key={stage.key}
                      type="button"
                      className={
                        stage.key === activeVisionWorkflowStageKey
                          ? 'vision-stage-chip active'
                          : 'vision-stage-chip'
                      }
                      onClick={() => setActiveVisionWorkflowStageKey(stage.key)}
                    >
                      <strong>{stage.label}</strong>
                      <span>{stage.title}</span>
                    </button>
                  ))}
                </div>
                {activeVisionWorkflowStage.key !== 'final'
                  ? activeVisionWorkflowPresetGroups.map((group) => (
                  <div key={group.key} className="workspace-inner-card brochure-control-card">
                    <span className="label">{group.label}</span>
                    <div className="property-media-variant-list">
                      {group.items.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          className={
                            activeVisionPresetKey === preset.key
                              ? 'property-media-variant-chip active'
                              : 'property-media-variant-chip'
                          }
                          onClick={() => handleSelectVisionPreset(preset.key)}
                          title={[
                            preset.displayName,
                            preset.helperText,
                            preset.upgradeTier === 'premium' ? 'Premium workflow step.' : 'Included workflow step.',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {preset.displayName}
                          {preset.upgradeTier === 'premium' ? ' · Premium' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                    ))
                  : null}
                <div className="workspace-inner-card brochure-control-card">
                  <span className="label">Stage guidance</span>
                  <strong>{activeVisionWorkflowStage.title}</strong>
                  <p>{activeVisionWorkflowStage.description}</p>
                  <div className="tag-row">
                    <span>{workflowSourceVariant ? 'Using selected draft as the source' : 'Using the original photo as the source'}</span>
                    {selectedVariant || selectedGeneratedAssetAsResult ? <span>Current result: {effectiveVisionResultLabel}</span> : null}
                    {latestGeneratedVariant ? <span>Latest generated: {latestGeneratedVariant.label}</span> : null}
                  </div>
                  {preferredVisionVariant && selectedVariant && preferredVisionVariant.id !== selectedVariant.id ? (
                    <p className="workspace-control-note">
                      Marketing-preferred output: <strong>{preferredVisionVariant.label}</strong>. The workspace is keeping <strong>{selectedVariant.label}</strong> in focus for this step so you can continue editing without losing the preferred pick.
                    </p>
                  ) : null}
                  {latestGeneratedVariant && selectedVariant && latestGeneratedVariant.id !== selectedVariant.id ? (
                    <p className="workspace-control-note">
                      You are viewing an older attempt right now. The newest generated result is <strong>{latestGeneratedVariant.label}</strong> from {formatDateTimeLabel(latestGeneratedVariant.createdAt)}.
                    </p>
                  ) : null}
                  <p className="workspace-control-note">
                    This stage currently has {stageScopedVisionVariants.length} previous attempt{stageScopedVisionVariants.length === 1 ? '' : 's'} for this photo. Open attempt history only when you want to compare, keep, or permanently delete them.
                  </p>
                </div>
              </div>
              {activeVisionWorkflowStage.key !== 'final' ? (
                <>
                  <div
                    ref={visionCurrentActionRef}
                    className="workspace-inner-card brochure-control-card vision-current-action-card"
                  >
                    <span className="label">Current action</span>
                    <strong>{activeVisionPreset?.displayName || 'Select a preset'}</strong>
                    <p>
                      {activeVisionPreset?.helperText ||
                        'Choose the next step for this photo and keep the workspace moving forward one stage at a time.'}
                    </p>
                    <div className="tag-row vision-status-badge-row">
                      <span
                        className="vision-status-badge"
                        title={
                          activeVisionPreset?.category === 'concept_preview'
                            ? 'Concept preview: intended for planning and discussion, not as a representation of completed work.'
                            : 'Listing enhancement: intended as a stronger presentation-oriented improvement.'
                        }
                      >
                        {activeVisionPreset?.category === 'concept_preview'
                          ? 'Concept Preview'
                          : 'Listing Enhancement'}
                      </span>
                      <span
                        className="vision-status-badge"
                        title={
                          activeVisionPreset?.upgradeTier === 'premium'
                            ? 'Premium workflow step. This preset uses the premium vision path when available.'
                            : 'Included workflow step.'
                        }
                      >
                        {activeVisionPreset?.upgradeTier === 'premium'
                          ? 'Premium workflow step'
                          : 'Included workflow'}
                      </span>
                    </div>
                    <div className="vision-current-action-buttons vision-current-action-buttons-primary">
                      <button
                        type="button"
                        className={
                          visionGenerationState
                            ? 'button-primary button-busy vision-generate-button'
                            : 'button-primary vision-generate-button'
                        }
                        onClick={() => handleGenerateVariant(activeVisionPresetKey)}
                        disabled={Boolean(status) || isArchivedProperty || !activeVisionPreset}
                        title={activeVisionPresetTooltip}
                      >
                        {visionGenerationState
                          ? `Generating... ${visionGenerationElapsedSeconds}s`
                          : `Generate ${activeVisionPreset?.displayName || 'enhancement'}`}
                      </button>
                    </div>
                    <p className="workspace-control-note">
                      Generate the next result here. Open attempt history only when you want to compare, keep, or permanently delete older attempts.
                    </p>
                    <div className="vision-current-action-buttons vision-current-action-buttons-secondary">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setShowVisionHistory(true)}
                        disabled={!stageScopedVisionVariants.length}
                      >
                        {`View attempt history (${stageScopedVisionVariants.length})`}
                      </button>
                    </div>
                  </div>
                  {visionGenerationState ? (
                    <div className="vision-generation-status" role="status" aria-live="polite">
                      <div className="vision-generation-status-header">
                        <div>
                          <span className="label">Vision generation in progress</span>
                          <strong>{visionGenerationState.title}</strong>
                        </div>
                        <span className="vision-generation-status-time">{visionGenerationElapsedSeconds}s elapsed</span>
                      </div>
                      <div className="vision-generation-progress" aria-hidden="true">
                        <span className="vision-generation-progress-bar" />
                      </div>
                      <p>{visionGenerationState.detail}</p>
                      <p className="workspace-control-note">
                        Timing varies by preset and whether the job needs a stronger AI fallback, so this indicator tracks elapsed time rather than pretending to know an exact percent complete. A short chime will play when longer runs finish.
                      </p>
                      {visionRecoveryState?.jobId ? (
                        <div className="workspace-action-row">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={handleCancelVisionGeneration}
                            disabled={visionCancellationPending}
                          >
                            {visionCancellationPending ? 'Cancelling...' : 'Cancel generation'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {activeVisionWorkflowStage.allowFreeform ? (
                    <div className="workspace-inner-card brochure-control-card">
                      <span className="label">Natural-language enhancement</span>
                      <textarea
                        value={freeformEnhancementInstructions}
                        onChange={(event) => setFreeformEnhancementInstructions(event.target.value)}
                        placeholder="Please make this cleaned room feel modern and bright while preserving the architecture."
                        maxLength={600}
                      />
                      <div className="workspace-action-column">
                        <button
                          type="button"
                          className={visionGenerationState?.kind === 'freeform' ? 'button-secondary button-busy' : 'button-secondary'}
                          onClick={handleGenerateFreeformVariant}
                          disabled={Boolean(status) || isArchivedProperty || !freeformEnhancementInstructions.trim()}
                        >
                          {visionGenerationState?.kind === 'freeform'
                            ? `Generating... ${visionGenerationElapsedSeconds}s`
                            : 'Generate custom preview'}
                        </button>
                      </div>
                      <p className="workspace-control-note">
                        Use this after the room is cleaned and the major finish changes are in place. It works best for subtle style direction, not starting from a cluttered room.
                      </p>
                      {selectedVariant?.metadata?.mode === 'freeform' ? (
                        <div className="vision-freeform-result-card">
                          <div className="section-header-tight">
                            <div>
                              <span className="label">Latest custom result</span>
                              <strong>{selectedVariant.label || 'Custom enhancement preview'}</strong>
                            </div>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => visionCompareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            >
                              Show compare view
                            </button>
                          </div>
                          <div className="vision-freeform-result-grid">
                            <img
                              src={selectedVariant.imageUrl}
                              alt={selectedVariant.label || 'Generated custom enhancement'}
                              className="vision-freeform-result-thumb"
                            />
                            <div className="workspace-tab-stack">
                              <p className="workspace-control-note">
                                This result is now loaded in the compare view above.
                              </p>
                              {selectedVariant.metadata?.instructions ? (
                                <p>
                                  <strong>Request:</strong> {selectedVariant.metadata.instructions}
                                </p>
                              ) : null}
                              {selectedVariantFreeformHighlights.length ? (
                                <div className="tag-row">
                                  {selectedVariantFreeformHighlights.map((item) => (
                                    <span key={`freeform-highlight-${item}`}>{item}</span>
                                  ))}
                                </div>
                              ) : null}
                              {selectedVariant.metadata?.differenceHint ? (
                                <p className="workspace-control-note">
                                  <strong>What to look for:</strong> {selectedVariant.metadata.differenceHint}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="workspace-inner-card brochure-control-card">
                      <span className="label">Advanced requests</span>
                      <p>
                        Natural-language styling unlocks in the Style concept stage, after the room has been cleaned and the major finish changes are in place.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="workspace-inner-card brochure-control-card">
                  <span className="label">Finalize this photo</span>
                  <strong>{selectedVariant?.label || 'Select the result you want to keep'}</strong>
                  <p>
                    Once this version is the winner, keep it as the preferred output and remove earlier drafts for a clean final workspace.
                  </p>
                  <div className="workspace-action-column">
                    {selectedVariant ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleSelectVariant(selectedVariant.id)}
                        disabled={Boolean(status) || isArchivedProperty || selectedVariant.isSelected}
                      >
                        {selectedVariant.isSelected ? 'Preferred variant selected' : 'Set as preferred variant'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button-secondary button-danger"
                      onClick={handlePruneVisionDraftHistory}
                      disabled={Boolean(status) || isArchivedProperty || !selectedVariant}
                    >
                      Delete earlier saved versions
                    </button>
                  </div>
                  <p className="workspace-control-note">
                    This keeps the selected result and permanently removes the other saved image versions for this photo.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p>No photo is selected yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderBrochureTab = () => (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'brochure_controls',
        label: 'Brochure',
        title: 'Brochure controls',
        meta: latestFlyer ? 'Draft ready' : 'No draft yet',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.brochure_controls,
        className: 'content-card flyer-generator-card',
        children: (
          <div className="workspace-tab-stack">
            <p>Generate a brochure-style flyer from live pricing, selected photos, and the strongest seller-ready language.</p>
            <div className="mode-switch">
              <button type="button" className={flyerType === 'sale' ? 'mode-chip active' : 'mode-chip'} onClick={() => setFlyerType('sale')}>Sale flyer</button>
              <button type="button" className={flyerType === 'rental' ? 'mode-chip active' : 'mode-chip'} onClick={() => setFlyerType('rental')}>Rental flyer</button>
            </div>
            <div className="mini-stats">
              <div className="stat-card"><strong>Listing picks</strong><span>{listingCandidateAssets.length} chosen</span></div>
              <div className="stat-card"><strong>Vision-ready</strong><span>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred variants</span></div>
              <div className="stat-card"><strong>Price source</strong><span>{latestPricing ? 'Live pricing attached' : 'Using latest saved pricing'}</span></div>
            </div>
            <div className="workspace-inner-card brochure-control-card">
              <span className="label">Headline + copy plan</span>
              <div className="brochure-control-grid brochure-control-grid-form">
                <label className="workspace-control-field">
                  <span>Headline</span>
                  <input type="text" value={flyerHeadlineDraft} onChange={(event) => setFlyerHeadlineDraft(event.target.value)} placeholder="Seller-ready headline" maxLength={140} />
                </label>
                <label className="workspace-control-field">
                  <span>Subheadline</span>
                  <input type="text" value={flyerSubheadlineDraft} onChange={(event) => setFlyerSubheadlineDraft(event.target.value)} placeholder="Short positioning line" maxLength={220} />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Summary</span>
                  <textarea value={flyerSummaryDraft} onChange={(event) => setFlyerSummaryDraft(event.target.value)} placeholder="How should this brochure frame the property?" maxLength={600} />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Call to action</span>
                  <input type="text" value={flyerCallToActionDraft} onChange={(event) => setFlyerCallToActionDraft(event.target.value)} placeholder="What should the seller or buyer do next?" maxLength={180} />
                </label>
              </div>
            </div>
            <div className="workspace-inner-card brochure-control-card">
              <span className="label">Image selection</span>
              {brochurePhotoPool.length ? (
                <div className="brochure-photo-plan">
                  {brochurePhotoPool.slice(0, 6).map((asset) => (
                    <button
                      key={`brochure-photo-${asset.id}`}
                      type="button"
                      className={flyerSelectedPhotoIds.includes(asset.id) ? 'brochure-photo-plan-card active' : 'brochure-photo-plan-card'}
                      onClick={() => toggleFlyerPhotoSelection(asset.id)}
                    >
                      <img src={asset.imageUrl} alt={asset.roomLabel || 'Brochure candidate'} />
                      <div>
                        <strong>{asset.roomLabel}</strong>
                        <span>
                          {asset.listingNote ||
                            (asset.selectedVariant
                              ? `${asset.selectedVariant.label || 'Vision-ready'} selected`
                              : 'Available for brochure use')}
                        </span>
                        <em>{flyerSelectedPhotoIds.includes(asset.id) ? 'Included in brochure' : 'Click to include'}</em>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No photos are available yet. Add them in mobile, then return here to shape the brochure.</p>
              )}
              <p className="workspace-control-note">
                Up to 4 photos are used. Seller picks stay prioritized, and preferred vision variants still flow through automatically.
              </p>
            </div>
            <div className="button-stack flyer-generator-actions">
              <button type="button" className={status.includes('Generating') ? 'button-primary button-busy' : 'button-primary'} onClick={handleGenerateFlyer} disabled={Boolean(status) || isArchivedProperty}>
                {status.includes('Generating') ? 'Generating flyer...' : 'Generate flyer'}
              </button>
              <button type="button" className="button-secondary" onClick={handleDownloadFlyerPdf} disabled={Boolean(status)}>Download PDF</button>
            </div>
          </div>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'brochure_preview',
        label: 'Brochure',
        title: 'Live preview',
        meta: latestFlyer ? latestFlyer.flyerType : 'No preview',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.brochure_preview,
        className: 'content-card',
        children: latestFlyer ? (
          <div ref={flyerPreviewRef} className="flyer-preview">
            <div className="flyer-hero">
              <span className="label">{latestFlyer.flyerType} flyer</span>
              <h2>{latestFlyer.headline}</h2>
              <p>{latestFlyer.subheadline}</p>
              <div className="mini-stats">
                <div className="stat-card"><strong>Price</strong><span>{latestFlyer.priceText}</span></div>
                <div className="stat-card"><strong>Location</strong><span>{latestFlyer.locationLine}</span></div>
              </div>
            </div>
            <div className="report-preview-section">
              <strong>Builder selections</strong>
              <div className="tag-row">
                <span>{latestFlyer.customizations?.selectedPhotoAssetIds?.length || latestFlyer.selectedPhotos?.length || 0} selected photos</span>
                <span>{latestFlyer.customizations?.headline ? 'Custom headline' : 'AI headline'}</span>
                <span>{latestFlyer.customizations?.summary ? 'Custom summary' : 'AI summary'}</span>
              </div>
            </div>
            {latestFlyer.selectedPhotos?.length ? (
              <div className="flyer-photo-grid">
                {latestFlyer.selectedPhotos.slice(0, 4).map((photo) => (
                  <div key={photo.assetId || photo.imageUrl} className="flyer-photo-card">
                    {photo.imageUrl ? <img src={photo.imageUrl} alt={photo.roomLabel || 'Property photo'} /> : null}
                    <span>{photo.roomLabel || 'Selected photo'}</span>
                    <div className="flyer-photo-badges">
                      {photo.listingCandidate ? <strong className="flyer-photo-badge">Seller selected</strong> : null}
                      {photo.usesPreferredVariant ? <strong className="flyer-photo-badge flyer-photo-badge-vision">{getPreferredVariantLabel(photo)}</strong> : null}
                    </div>
                    {photo.listingNote ? <em className="flyer-photo-note">{photo.listingNote}</em> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p>{latestFlyer.summary}</p>
            <ul className="plain-list">{(latestFlyer.highlights || []).map((item) => <li key={item}>{item}</li>)}</ul>
            <p><strong>CTA:</strong> {latestFlyer.callToAction}</p>
            <div className="brochure-preview-sections">
              <div className="brochure-preview-card">
                <span className="label">Headline</span>
                <strong>{latestFlyer.headline}</strong>
                <p>{latestFlyer.subheadline}</p>
              </div>
              <div className="brochure-preview-card">
                <span className="label">Highlights</span>
                <ul className="plain-list">
                  {(latestFlyer.highlights || []).slice(0, 4).map((item) => <li key={`highlight-${item}`}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p>No flyer draft yet. Generate one to preview brochure output.</p>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'brochure_social',
        label: 'Brochure',
        title: 'Social ad pack',
        meta: latestSocialPack ? 'Available' : 'Not generated',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.brochure_social,
        className: 'content-card',
        children: (
          <div className="workspace-tab-stack">
            <div className="workspace-action-column">
              <button
                type="button"
                className="button-secondary"
                onClick={handleExportSocialPack}
                disabled={Boolean(status) || isArchivedProperty}
              >
                Export social ad pack
              </button>
            </div>
            {latestSocialPack ? (
              <div className="workspace-tab-stack">
                <p className="workspace-control-note">
                  Select a format chip to inspect the copy, CTA, and guidance for that specific social placement.
                </p>
                <div className="tag-row">
                  {(latestSocialPack.variants || []).map((variant, index) => {
                    const variantKey = getSocialPackVariantKey(variant, index);
                    const isActive = variantKey === activeSocialPackVariantKey;
                    return (
                      <button
                        key={variantKey}
                        type="button"
                        className={isActive ? 'social-pack-chip active' : 'social-pack-chip'}
                        onClick={() => setActiveSocialPackVariantKey(variantKey)}
                      >
                        {getSocialPackVariantLabel(variant)}
                      </button>
                    );
                  })}
                </div>
                {activeSocialPackVariantDetails ? (
                  <div className="social-pack-detail-card">
                    <div className="workspace-tab-stack">
                      <div>
                        <span className="label">Selected format</span>
                        <h3>{activeSocialPackVariantDetails.title}</h3>
                      </div>
                      <p>{activeSocialPackVariantDetails.summary}</p>
                      {activeSocialPackVariantDetails.highlights.length ? (
                        <div className="tag-row">
                          {activeSocialPackVariantDetails.highlights.map((item) => (
                            <span key={`social-pack-highlight-${item}`}>{item}</span>
                          ))}
                        </div>
                      ) : null}
                      <p className="workspace-control-note">
                        <strong>Guidance:</strong> {activeSocialPackVariantDetails.guidance}
                      </p>
                      <div className="social-pack-detail-grid">
                        {activeSocialPackVariantDetails.sections.map((section) => (
                          <div key={`${activeSocialPackVariantDetails.title}-${section.label}`} className="social-pack-detail-block">
                            <strong>{section.label}</strong>
                            <span>{section.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <p><strong>Headline:</strong> {latestSocialPack.headline}</p>
                <p><strong>Primary text:</strong> {latestSocialPack.primaryText}</p>
                <p><strong>Short caption:</strong> {latestSocialPack.shortCaption}</p>
                <p><strong>CTA:</strong> {latestSocialPack.cta}</p>
                {(latestSocialPack.disclaimers || []).length ? (
                  <ul className="plain-list">
                    {(latestSocialPack.disclaimers || []).map((item) => <li key={`social-disclaimer-${item}`}>{item}</li>)}
                  </ul>
                ) : null}
                <pre className="workspace-control-note" style={{ whiteSpace: 'pre-wrap' }}>{latestSocialPack.markdown}</pre>
              </div>
            ) : (
              <p className="workspace-control-note">Generate a social pack to get square/story guidance plus ad-ready headline, caption, CTA, and markdown copy.</p>
            )}
          </div>
        ),
      })}
    </div>
  );

  const renderReportTab = () => (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'report_builder',
        label: 'Report',
        title: 'Report builder',
        meta: latestReport ? 'Draft ready' : 'No report yet',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.report_builder,
        className: 'content-card report-generator-card',
        children: (
          <div className="workspace-tab-stack">
            <p>Make the report feel premium by combining pricing, comps, photos, checklist progress, and marketing guidance into one place.</p>
            <div className="workspace-action-column">
              <button type="button" className={status.includes('report') ? 'button-primary button-busy' : 'button-primary'} onClick={handleGenerateReport} disabled={Boolean(status) || isArchivedProperty}>
                {status.includes('report') ? 'Generating report...' : 'Generate report'}
              </button>
              <button type="button" className="button-secondary" onClick={handleDownloadReportPdf} disabled={Boolean(status)}>Download report PDF</button>
            </div>
            <div className="mini-stats">
              <div className="stat-card"><strong>Status</strong><span>{latestReport ? (latestReport.freshness?.isStale ? 'Refresh recommended' : 'Current report ready') : 'No report generated yet'}</span></div>
              <div className="stat-card"><strong>Photos</strong><span>{latestReport?.selectedPhotos?.length ? `${latestReport.selectedPhotos.length} in latest report` : `${listingCandidateAssets.length || mediaAssets.length} available`}</span></div>
              <div className="stat-card"><strong>Checklist</strong><span>{checklist?.summary?.completedCount ?? 0} complete</span></div>
              <div className="stat-card"><strong>Comps</strong><span>{selectedComps.length} included</span></div>
            </div>
            <div className="workspace-inner-card report-outline-card">
              <span className="label">Title + summary</span>
              <div className="brochure-control-grid brochure-control-grid-form">
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Report title</span>
                  <input type="text" value={reportTitleDraft} onChange={(event) => setReportTitleDraft(event.target.value)} placeholder="Seller-facing report title" maxLength={180} />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Executive summary</span>
                  <textarea value={reportExecutiveSummaryDraft} onChange={(event) => setReportExecutiveSummaryDraft(event.target.value)} placeholder="Lead with the main pricing, readiness, and launch story." maxLength={1200} />
                </label>
                <label className="workspace-control-field workspace-control-field-full">
                  <span>Draft listing description</span>
                  <textarea value={reportListingDescriptionDraft} onChange={(event) => setReportListingDescriptionDraft(event.target.value)} placeholder="Optional seller-facing listing-description draft." maxLength={1200} />
                </label>
              </div>
            </div>
            <div className="workspace-inner-card report-outline-card">
              <span className="label">Section toggles</span>
              <div className="report-outline-grid">
                {REPORT_SECTION_OPTIONS.map((section) => (
                  <button
                    key={`outline-${section.id}`}
                    type="button"
                    className={reportIncludedSections.includes(section.id) ? 'report-outline-item active' : 'report-outline-item'}
                    onClick={() => toggleReportSection(section.id)}
                  >
                    <strong>{section.label}</strong>
                    <span>
                      {reportIncludedSections.includes(section.id)
                        ? 'Included in the generated report'
                        : 'Click to include this section'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="workspace-inner-card brochure-control-card">
              <span className="label">Photo set</span>
              {reportPhotoPool.length ? (
                <div className="brochure-photo-plan">
                  {reportPhotoPool.slice(0, 6).map((asset) => (
                    <button
                      key={`report-photo-${asset.id}`}
                      type="button"
                      className={reportSelectedPhotoIds.includes(asset.id) ? 'brochure-photo-plan-card active' : 'brochure-photo-plan-card'}
                      onClick={() => toggleReportPhotoSelection(asset.id)}
                    >
                      <img src={asset.imageUrl} alt={asset.roomLabel || 'Report candidate'} />
                      <div>
                        <strong>{asset.roomLabel}</strong>
                        <span>
                          {asset.listingNote ||
                            (asset.selectedVariant
                              ? `${asset.selectedVariant.label || 'Vision-ready'} selected`
                              : 'Available for report use')}
                        </span>
                        <em>{reportSelectedPhotoIds.includes(asset.id) ? 'Included in report' : 'Click to include'}</em>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No photos are available yet for report review.</p>
              )}
            </div>
          </div>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'report_preview',
        label: 'Report',
        title: 'Live preview',
        meta: latestReport ? 'Report ready' : 'No preview',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.report_preview,
        className: 'content-card',
        children: latestReport ? (
          <div ref={reportPreviewRef} className="report-preview">
            <div className="flyer-hero">
              <span className="label">{latestReport.reportType}</span>
              <h2>{latestReport.title}</h2>
              <p>{latestReport.executiveSummary}</p>
              <div className="tag-row">
                <span>{latestReport.freshness?.isStale ? 'Stale report' : 'Current report'}</span>
                <span>Version {latestReport.reportVersion || 1}</span>
                <span>{latestReport.payload?.readinessSummary?.label || 'Readiness summary pending'}</span>
              </div>
            </div>
            <div className="report-preview-section">
              <strong>Builder selections</strong>
              <div className="tag-row">
                {(latestReport.payload?.sectionOutline || []).map((item) => <span key={`section-${item}`}>{item}</span>)}
                <span>{latestReport.selectedPhotos?.length || 0} selected photos</span>
              </div>
            </div>
            <div className="mini-stats">
              <div className="stat-card"><strong>Price band</strong><span>{latestReport.pricingSummary?.low ? `${formatCurrency(latestReport.pricingSummary.low)} to ${formatCurrency(latestReport.pricingSummary.high)}` : 'Pricing pending'}</span></div>
              <div className="stat-card"><strong>Chosen list price</strong><span>{latestReport.pricingSummary?.selectedListPrice ? formatCurrency(latestReport.pricingSummary.selectedListPrice) : property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set yet'}</span></div>
              <div className="stat-card"><strong>Readiness</strong><span>{latestReport.payload?.readinessSummary?.overallScore ? `${latestReport.payload.readinessSummary.overallScore}/100` : 'Not included'}</span></div>
            </div>
            {latestReport.freshness?.isStale ? <div className="report-preview-section"><strong>Refresh recommended</strong><ul className="plain-list">{(latestReport.freshness.staleReasons || []).map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            {latestReport.payload?.photoSummary ? <div className="report-preview-section"><strong>Photo review summary</strong><p>{latestReport.payload.photoSummary.summary || 'No photo-review summary is available yet.'}</p></div> : null}
            {latestReport.selectedPhotos?.length ? (
              <div className="report-preview-section">
                <strong>Selected photo set</strong>
                <div className="flyer-photo-grid">
                  {latestReport.selectedPhotos.slice(0, 4).map((photo) => (
                    <div key={`report-preview-photo-${photo.assetId || photo.imageUrl}`} className="flyer-photo-card">
                      {photo.imageUrl ? <img src={photo.imageUrl} alt={photo.roomLabel || 'Report photo'} /> : null}
                      <span>{photo.roomLabel || 'Selected report photo'}</span>
                      <div className="flyer-photo-badges">
                        {photo.listingCandidate ? <strong className="flyer-photo-badge">Seller selected</strong> : null}
                        {photo.usesPreferredVariant ? <strong className="flyer-photo-badge flyer-photo-badge-vision">{getPreferredVariantLabel(photo)}</strong> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {(latestReport.payload?.visionStoryBlocks || []).length ? (
              <div className="report-preview-section">
                <strong>Visual improvement previews</strong>
                <div className="vision-story-grid">
                  {(latestReport.payload?.visionStoryBlocks || []).slice(0, 3).map((story) => (
                    <article key={`vision-story-${story.variantId || story.title}`} className="vision-story-card">
                      <div className="vision-story-images">
                        {story.originalImageUrl ? (
                          <div>
                            <span className="label">Before</span>
                            <img src={story.originalImageUrl} alt={`${story.title || 'Vision preview'} before`} />
                          </div>
                        ) : null}
                        {story.variantImageUrl ? (
                          <div>
                            <span className="label">After</span>
                            <img src={story.variantImageUrl} alt={story.title || 'Vision preview'} />
                          </div>
                        ) : null}
                      </div>
                      <div className="workspace-tab-stack">
                        <strong>{story.title}</strong>
                        <p><strong>What changed:</strong> {story.whatChanged}</p>
                        <p><strong>Why it matters:</strong> {story.whyItMatters}</p>
                        <p><strong>Suggested action:</strong> {story.suggestedAction}</p>
                        <p className="workspace-control-note">{story.disclaimer}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="report-preview-grid">
              {(latestReport.marketingHighlights || []).length ? (
                <div className="report-preview-section">
                  <strong>Marketing highlights</strong>
                  <div className="tag-row">
                    {(latestReport.marketingHighlights || []).slice(0, 6).map((item) => <span key={`marketing-${item}`}>{item}</span>)}
                  </div>
                </div>
              ) : null}
              {(latestReport.checklistItems || []).length ? (
                <div className="report-preview-section">
                  <strong>Top checklist items</strong>
                  <ul className="plain-list">
                    {(latestReport.checklistItems || []).slice(0, 4).map((item) => <li key={`task-${item}`}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
              {(latestReport.improvementItems || []).length ? (
                <div className="report-preview-section">
                  <strong>Top improvements</strong>
                  <ul className="plain-list">
                    {(latestReport.improvementItems || []).slice(0, 4).map((item) => <li key={`improvement-${item}`}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
              {latestReport.payload?.listingDescriptions?.shortDescription || latestReport.payload?.marketingGuidance?.shortDescription ? (
                <div className="report-preview-section">
                  <strong>Draft listing description</strong>
                  <p>{latestReport.payload?.listingDescriptions?.shortDescription || latestReport.payload?.marketingGuidance?.shortDescription}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p>No seller report has been generated yet. Create one to preview the premium report flow.</p>
        ),
      })}
    </div>
  );

  const renderChecklistTab = () => (
    <div className="workspace-tab-stack">
      {renderCollapsibleSection({
        sectionKey: 'checklist_tasks',
        label: 'Checklist',
        title: 'Listing-prep phases',
        meta: `${checklist?.summary?.progressPercent ?? 0}% ready`,
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.checklist_tasks,
        className: 'content-card checklist-card',
        children: checklistGroups.length ? (
          <div className="workspace-accordion-list">
            {checklistGroups.map(([groupName, items]) => {
              const groupSectionKey = `checklist_group_${groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
              const groupOpen = isWorkspaceSectionOpen(groupSectionKey, true);
              return (
                <details
                  key={groupName}
                  className="workspace-accordion"
                  open={groupOpen}
                  onToggle={(event) => setWorkspaceSectionOpen(groupSectionKey, event.currentTarget.open, true)}
                >
                  <summary><span>{groupName}</span><span>{items.length} task(s)</span></summary>
                  <div className="checklist-list">
                    {items.map((item) => (
                      <article key={item.id} className="checklist-item-card">
                        <div className="checklist-item-meta">
                          <span className={`checklist-status checklist-status-${item.status}`}>{formatChecklistStatus(item.status)}</span>
                          <span className={`checklist-chip checklist-chip-${item.priority}`}>{formatChecklistPriority(item.priority)}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.detail || 'No additional guidance is attached to this task yet.'}</p>
                        {item.providerCategoryLabel ? (
                          <div className="checklist-provider-inline">
                            <div>
                              <strong>{item.providerCategoryLabel}</strong>
                              <span>{item.providerPrompt || 'Local provider recommendations are available for this task.'}</span>
                            </div>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => focusProviderSuggestions(item.id)}
                            >
                              Show providers
                            </button>
                          </div>
                        ) : null}
                        <div className="checklist-action-row">
                          {['todo', 'in_progress', 'done'].map((nextStatus) => (
                            <button key={`${item.id}-${nextStatus}`} type="button" className={item.status === nextStatus ? 'checklist-action-chip active' : 'checklist-action-chip'} onClick={() => handleSetChecklistItemStatus(item.id, nextStatus)} disabled={Boolean(status) || isArchivedProperty}>{formatChecklistStatus(nextStatus)}</button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p>No checklist items yet. The shared seller-prep workflow will appear here.</p>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'checklist_summary',
        label: 'Checklist',
        title: 'Progress summary',
        meta: `${readinessScore}/100 readiness`,
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.checklist_summary,
        className: 'content-card workspace-side-panel',
        children: (
          <div className="workspace-tab-stack">
            <div className="mini-stats">
              <button
                type="button"
                className={checklistSummaryMode === 'completed' ? 'stat-card stat-card-button active' : 'stat-card stat-card-button'}
                onClick={() => setChecklistSummaryMode('completed')}
              >
                <strong>Completed</strong>
                <span>{checklist?.summary?.completedCount ?? 0}</span>
              </button>
              <button
                type="button"
                className={checklistSummaryMode === 'open' ? 'stat-card stat-card-button active' : 'stat-card stat-card-button'}
                onClick={() => setChecklistSummaryMode('open')}
              >
                <strong>Open</strong>
                <span>{checklist?.summary?.openCount ?? 0}</span>
              </button>
            </div>
            <p><strong>Next task:</strong> {checklist?.nextTask?.title || 'No open tasks right now'}</p>
            <div className="workspace-inner-card checklist-summary-card">
              <strong>{checklistSummaryMode === 'completed' ? 'Completed items' : 'Open items'}</strong>
              {(checklistSummaryMode === 'completed' ? completedChecklistItems : openChecklistItems).length ? (
                <ul className="plain-list checklist-summary-list">
                  {(checklistSummaryMode === 'completed' ? completedChecklistItems : openChecklistItems)
                    .slice(0, 6)
                    .map((item) => (
                      <li key={`summary-${item.id}`}>
                        <strong>{item.title}</strong>
                        <span>{formatChecklistCategory(item.category)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="workspace-control-note">
                  {checklistSummaryMode === 'completed'
                    ? 'Completed tasks will appear here as you finish them.'
                    : 'Open tasks will appear here until they are completed.'}
                </p>
              )}
            </div>
          </div>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'checklist_custom',
        label: 'Checklist',
        title: 'Add custom task',
        meta: 'Optional',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.checklist_custom,
        className: 'content-card checklist-form',
        children: (
          <form className="workspace-tab-stack" onSubmit={handleCreateChecklistTask}>
            <input type="text" value={customChecklistTitle} onChange={(event) => setCustomChecklistTitle(event.target.value)} placeholder="Example: book pre-listing cleaner" maxLength={80} />
            <input type="text" value={customChecklistDetail} onChange={(event) => setCustomChecklistDetail(event.target.value)} placeholder="Optional context or reminder" maxLength={180} />
            <button type="submit" className="button-secondary" disabled={Boolean(status) || isArchivedProperty}>Save task</button>
          </form>
        ),
      })}

      {renderCollapsibleSection({
        sectionKey: 'checklist_providers',
        label: 'Checklist',
        title: 'Provider suggestions',
        meta: providerSuggestionTask?.providerCategoryLabel || 'No linked task',
        defaultOpen: DEFAULT_WORKSPACE_SECTION_STATE.checklist_providers,
        className: 'content-card workspace-side-panel',
        children: (
          <div ref={providerSuggestionsRef} className="workspace-tab-stack">
            <p>
              {providerSuggestionTask?.providerPrompt ||
                'Provider recommendations appear here when a checklist task has a linked marketplace category.'}
            </p>
            {providerSearchStatus ? (
              <p className="workspace-control-note">{providerSearchStatus}</p>
            ) : null}
            {providerRecommendations.length ? (
              <div className="provider-card-list">
                <div className="section-header-tight">
                  <div>
                    <strong>Workside marketplace providers</strong>
                    <p className="workspace-control-note">
                      Ranked internal providers matched by category, coverage, and marketplace readiness.
                    </p>
                  </div>
                </div>
                {providerRecommendations.map((provider) => (
                <article key={provider.id} className="provider-card">
                  <div className="provider-card-header">
                    <div>
                      <strong>{provider.businessName}</strong>
                      <span>{provider.coverageLabel || [provider.city, provider.state].filter(Boolean).join(', ')}</span>
                    </div>
                    {provider.isSponsored ? <span className="checklist-chip checklist-chip-medium">Sponsored</span> : null}
                  </div>
                  <p>{provider.description || 'No provider description has been added yet.'}</p>
                  <div className="provider-quality-row">
                    <span>{provider.turnaroundLabel || 'Turnaround not listed'}</span>
                    <span>{provider.pricingSummary || 'Pricing summary not listed'}</span>
                    <span>
                      {provider.verification?.review?.level === 'verified'
                        ? 'Verified credentials'
                        : provider.verification?.review?.level === 'details_provided'
                          ? 'Trust details provided'
                          : 'Self-reported trust profile'}
                    </span>
                    <span>
                      {provider.compliance?.licenseStatus === 'verified'
                        ? 'License verified'
                        : provider.verification?.license?.hasLicense
                          ? 'License self-reported'
                        : provider.compliance?.licenseStatus === 'not_required'
                          ? 'License not required'
                          : 'License unverified'}
                    </span>
                    <span>
                      {provider.compliance?.insuranceStatus === 'verified'
                        ? 'Insurance verified'
                        : provider.verification?.insurance?.hasInsurance
                          ? 'Insurance self-reported'
                        : provider.compliance?.insuranceStatus === 'not_required'
                          ? 'Insurance not required'
                          : 'Insurance unverified'}
                    </span>
                  </div>
                  <div className="tag-row">
                    {(provider.rankingBadges || []).map((badge) => (
                      <span key={`${provider.id}-${badge}`}>{badge}</span>
                    ))}
                    {(provider.serviceHighlights || []).map((highlight) => (
                      <span key={`${provider.id}-${highlight}`}>{highlight}</span>
                    ))}
                  </div>
                  <div className="provider-card-actions">
                    <button type="button" className="button-secondary" onClick={() => handleSaveProvider(provider.id)} disabled={Boolean(status) || isArchivedProperty || provider.saved}>
                      {provider.saved ? 'Saved' : 'Save provider'}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleSaveProviderReference(provider, 'internal')}
                      disabled={
                        Boolean(status) ||
                        isArchivedProperty ||
                        providerReferenceIds.has(`internal:${provider.id}`) ||
                        providerReferences.length >= 5
                      }
                    >
                      {providerReferenceIds.has(`internal:${provider.id}`) ? 'On sheet' : 'Add to sheet'}
                    </button>
                    <button type="button" className="button-primary" onClick={() => handleRequestProviderLead(provider)} disabled={Boolean(status) || isArchivedProperty}>
                      Request provider
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setActiveProviderDetails({ ...provider, categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' ') })}>
                      Details
                    </button>
                    {provider.websiteUrl ? (
                      <a href={provider.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                        Visit website
                      </a>
                    ) : null}
                  </div>
                </article>
                ))}
              </div>
            ) : null}
            {unavailableProviderRecommendations.length ? (
              <div className="provider-card-list">
                <div className="section-header-tight">
                  <div>
                    <strong>Matching providers still in setup</strong>
                    <p className="workspace-control-note">
                      These providers match the category and coverage, but they are not fully live in the marketplace yet.
                    </p>
                  </div>
                </div>
                {unavailableProviderRecommendations.map((provider) => (
                <article key={provider.id} className="provider-card provider-card-unavailable">
                  <div className="provider-card-header">
                    <div>
                      <strong>{provider.businessName}</strong>
                      <span>{provider.coverageLabel || [provider.city, provider.state].filter(Boolean).join(', ')}</span>
                    </div>
                    <span className="checklist-chip checklist-chip-medium">
                      {formatProviderStatusLabel(provider.status)}
                    </span>
                  </div>
                  <p>{provider.description || 'This provider matches the category, but their marketplace profile is not fully live yet.'}</p>
                  <div className="provider-quality-row">
                    <span>{provider.turnaroundLabel || 'Turnaround not listed'}</span>
                    <span>{provider.pricingSummary || 'Pricing summary not listed'}</span>
                    <span>
                      {provider.verification?.review?.level === 'verified'
                        ? 'Verified credentials'
                        : provider.verification?.review?.level === 'details_provided'
                          ? 'Trust details provided'
                          : 'Self-reported trust profile'}
                    </span>
                  </div>
                  <div className="tag-row">
                    {(provider.rankingBadges || []).map((badge) => (
                      <span key={`${provider.id}-${badge}`}>{badge}</span>
                    ))}
                  </div>
                  <div className="provider-card-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        setActiveProviderDetails({
                          ...provider,
                          categoryLabel:
                            providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
                        })
                      }
                    >
                      Details
                    </button>
                    {provider.websiteUrl ? (
                      <a href={provider.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                        Visit website
                      </a>
                    ) : null}
                  </div>
                </article>
                ))}
              </div>
            ) : null}
            {providerSource?.googleFallbackEnabled || providerGoogleSearchUrl || providerMapProviders.length ? (
              <div className="provider-card-actions">
                {providerMapProviders.length ? (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      setProviderMapScope(hasInternalProviderResults ? 'internal' : 'all');
                      setShowProviderMap(true);
                    }}
                    disabled={Boolean(status)}
                  >
                    Open provider map
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleBrowseGoogleFallback}
                  disabled={Boolean(status) || Boolean(providerSearchStatus)}
                >
                  {externalProviderRecommendations.length || showExternalProviderFallback
                    ? 'Refresh Google fallback'
                    : 'Browse Google fallback'}
                </button>
                {providerGoogleSearchUrl ? (
                  <a
                    href={providerGoogleSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button"
                  >
                    Open map search
                  </a>
                ) : null}
              </div>
            ) : null}
            {providerCoverageGuidance ? (
              <div className={`workspace-inner-card provider-coverage-card provider-coverage-card-${providerCoverageGuidance.tone}`}>
                <div className="provider-coverage-card-header">
                  <span className="label">{providerCoverageGuidance.eyebrow}</span>
                  <strong>{providerCoverageGuidance.title}</strong>
                </div>
                <p>{providerCoverageGuidance.message}</p>
                {providerCoverageGuidance.highlights?.length ? (
                  <div className="provider-quality-row provider-coverage-highlights">
                    {providerCoverageGuidance.highlights.map((highlight) => (
                      <span key={highlight}>{highlight}</span>
                    ))}
                  </div>
                ) : null}
                {providerCoverageGuidance.nextStep ? (
                  <p className="workspace-control-note provider-coverage-next-step">{providerCoverageGuidance.nextStep}</p>
                ) : null}
              </div>
            ) : null}
            {providerSearchStatus ? <p className="workspace-control-note">{providerSearchStatus}</p> : null}
            {renderExternalProviderList()}
            {providerSource ? (
              <p className="workspace-control-note">
                {buildProviderSourceSummary(providerSource)}
              </p>
            ) : null}
            {providerSource?.googleFallback && !providerCoverageGuidance ? (
              <p className="workspace-control-note">
                {buildGoogleFallbackSummary(providerSource)}
              </p>
            ) : null}
            {hasInternalProviderResults ? (
              <p className="workspace-control-note provider-disclaimer">
                {providerRecommendations[0]?.verification?.disclaimer ||
                  unavailableProviderRecommendations[0]?.verification?.disclaimer ||
                  'Provider credentials are self-reported or verified where indicated. Workside does not guarantee accuracy.'}
              </p>
            ) : null}
            <div className="workspace-inner-card provider-reference-sheet-card">
              <div className="section-header-tight">
                <div>
                  <strong>Provider reference sheet</strong>
                  <p className="workspace-control-note">
                    Save up to 5 internal or Google-discovered contacts here, then export a printable reference sheet.
                  </p>
                </div>
                <span className="section-header-meta">{providerReferences.length}/5 saved</span>
              </div>
              {providerReferences.length ? (
                <div className="provider-reference-list">
                  {providerReferences.map((reference) => (
                  <article key={reference.id} className="provider-reference-item">
                    <div className="provider-reference-copy">
                      <strong>{reference.businessName}</strong>
                      <span>
                        {[reference.categoryLabel || reference.categoryKey, reference.city, reference.state]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span>
                        {reference.phone ||
                          reference.email ||
                          formatProviderReferenceAccessLabel(reference)}
                      </span>
                      {reference.source === 'google_maps' ? (
                        <span className="provider-reference-source">Google-discovered reference</span>
                      ) : null}
                    </div>
                    <div className="provider-reference-actions">
                      {reference.websiteUrl ? (
                        <a
                          href={reference.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="button-secondary inline-button"
                        >
                          Visit website
                        </a>
                      ) : null}
                      {reference.mapsUrl ? (
                        <a
                          href={reference.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="button-secondary inline-button"
                        >
                          Open in Maps
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleRemoveProviderReference(reference.id)}
                        disabled={Boolean(status) || isArchivedProperty}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                  ))}
                </div>
              ) : (
                <p className="workspace-control-note">
                  Save providers from the recommendations above to build a printable shortlist for this property.
                </p>
              )}
              <div className="provider-card-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleDownloadProviderReferenceSheet}
                  disabled={!providerReferences.length}
                >
                  Download reference sheet
                </button>
              </div>
            </div>
            {providerLeads.length ? (
              <div className="provider-lead-list">
                <strong>Recent lead requests</strong>
                {providerLeads.slice(0, 3).map((lead) => (
                <article key={lead.id} className="provider-card provider-lead-card">
                  <div className="provider-card-header">
                    <div>
                      <strong>{String(lead.categoryKey || 'provider').replace(/_/g, ' ')}</strong>
                      <span>
                        {formatProviderLeadStatusLabel(lead.status)}
                        {lead.selectedProviderName ? ` · matched with ${lead.selectedProviderName}` : ''}
                      </span>
                    </div>
                    <span className="checklist-chip">
                      {lead.dispatchSummary?.contacted || lead.dispatches?.length || 0} contacted
                    </span>
                  </div>
                  <div className="provider-quality-row">
                    <span>
                      Latest dispatch: {formatProviderLeadStatusLabel(lead.activity?.latestDispatchStatus || 'queued')}
                    </span>
                    <span>
                      Latest reply: {formatProviderLeadStatusLabel(lead.activity?.latestResponseStatus || 'awaiting response')}
                    </span>
                    <span>
                      Seller notified:{' '}
                      {lead.sellerNotifiedAt
                        ? `${formatDateTimeLabel(lead.sellerNotifiedAt)}`
                        : 'Not yet'}
                    </span>
                  </div>
                  <p className="workspace-control-note">
                    {lead.selectedProviderName
                      ? `${lead.selectedProviderName} currently holds this lead.`
                      : 'Provider outreach is still in progress.'}{' '}
                    {lead.sellerNotificationChannels?.length
                      ? `Notification channels: ${lead.sellerNotificationChannels.join(', ')}.`
                      : ''}
                  </p>
                </article>
                ))}
              </div>
            ) : null}
          </div>
        ),
      })}
    </div>
  );

  function renderExternalProviderList() {
    if (!shouldShowExternalProviderSection) {
      return null;
    }

    return (
      <div className="provider-card-list">
        <div className="section-header-tight">
          <div>
            <strong>External Google fallback results</strong>
            <p className="workspace-control-note">
              Broaden the search outside the Workside marketplace when you need extra local options or backup contacts.
            </p>
          </div>
        </div>
        {externalProviderRecommendations.map((provider) => (
          <article key={provider.id} className="provider-card provider-card-external">
            <div className="provider-card-header">
              <div>
                <strong>{provider.businessName}</strong>
                <span>{provider.description}</span>
              </div>
              <span className="checklist-chip checklist-chip-medium">Google result</span>
            </div>
            <div className="provider-quality-row">
              {provider.rating ? (
                <span>
                  {provider.rating.toFixed(1)} stars{provider.reviewCount ? ` · ${provider.reviewCount} reviews` : ''}
                </span>
              ) : null}
              {provider.phone ? <span>{provider.phone}</span> : null}
              <span>External discovery</span>
            </div>
            <div className="provider-card-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => handleSaveProviderReference(provider, 'google_maps')}
                disabled={
                  Boolean(status) ||
                  isArchivedProperty ||
                  providerReferenceIds.has(`google_maps:${provider.id}`) ||
                  providerReferences.length >= 5
                }
              >
                {providerReferenceIds.has(`google_maps:${provider.id}`) ? 'On sheet' : 'Add to sheet'}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  setActiveProviderDetails({
                    ...provider,
                    categoryLabel: providerSource?.categoryLabel || provider.categoryKey?.replace(/_/g, ' '),
                  })
                }
              >
                Details
              </button>
              {provider.mapsUrl ? (
                <a href={provider.mapsUrl} target="_blank" rel="noreferrer" className="button-primary inline-button">
                  Open in Maps
                </a>
              ) : null}
              {provider.websiteUrl ? (
                <a href={provider.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                  Visit website
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  const renderActiveTab = () => {
    if (activeTab === 'pricing') return renderPricingTab();
    if (activeTab === 'photos') return renderPhotosTab();
    if (activeTab === 'seller_picks') return renderSellerPicksTab();
    if (activeTab === 'vision') return renderVisionTab();
    if (activeTab === 'brochure') return renderBrochureTab();
    if (activeTab === 'report') return renderReportTab();
    if (activeTab === 'checklist') return renderChecklistTab();
    return renderOverviewTab();
  };

  const visibleWorkspaceTabs =
    activeTab === 'vision'
      ? [...WORKSPACE_TABS.slice(0, 3), ...HIDDEN_WORKSPACE_TABS, ...WORKSPACE_TABS.slice(3)]
      : WORKSPACE_TABS;

  return (
    <AppFrame busy={Boolean(status)}>
      <Toast
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        autoDismissMs={toast?.autoDismissMs}
        actionLabel={toast?.actionLabel}
        onAction={toast?.onAction}
        onClose={() => setToast(null)}
      />
      {resolvedActivePhotoDetailsAsset ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setActivePhotoDetailsAsset(null)}>
          <div
            className="workspace-modal-card photo-details-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Photo details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header-tight">
              <div>
                <span className="label">Photo details</span>
                <h2>{resolvedActivePhotoDetailsAsset.roomLabel || 'Selected photo'}</h2>
              </div>
              <button
                type="button"
                className="button-secondary inline-button"
                onClick={() => setActivePhotoDetailsAsset(null)}
              >
                Close
              </button>
            </div>
            <div className="workspace-modal-preview-row photo-details-modal-preview">
              <img
                src={resolvedActivePhotoDetailsAsset.imageUrl}
                alt={resolvedActivePhotoDetailsAsset.roomLabel || 'Selected property photo'}
                className="workspace-modal-preview-image"
              />
              <div className="workspace-modal-preview-copy">
                <div className="photo-card-badge-row photo-card-badge-row-large">
                  <span className="photo-card-status-pill">{getMediaAssetPrimaryLabel(resolvedActivePhotoDetailsAsset)}</span>
                  {resolvedActivePhotoDetailsAsset.savedFromVision ? <span className="photo-card-status-pill">Saved from Vision</span> : null}
                  <button
                    type="button"
                    className={resolvedActivePhotoDetailsAsset.listingCandidate ? 'photo-card-action-pill active' : 'photo-card-action-pill'}
                    onClick={() => handleToggleListingCandidateForAsset(resolvedActivePhotoDetailsAsset)}
                    disabled={Boolean(status) || isArchivedProperty}
                  >
                    {resolvedActivePhotoDetailsAsset.listingCandidate ? 'Seller Pick' : 'Add Seller Pick'}
                  </button>
                </div>
                <strong>
                  {resolvedActivePhotoDetailsAsset.assetType === 'generated'
                    ? resolvedActivePhotoDetailsAsset.generationLabel || getMediaAssetPrimaryLabel(resolvedActivePhotoDetailsAsset)
                    : resolvedActivePhotoDetailsAsset.roomLabel || 'Original photo'}
                </strong>
                <span>{getMediaAssetSummary(resolvedActivePhotoDetailsAsset)}</span>
                <span>
                  Saved {new Date(resolvedActivePhotoDetailsAsset.createdAt).toLocaleString()}
                  {resolvedActivePhotoDetailsAsset.assetType === 'generated'
                    ? ' · Added from Vision'
                    : resolvedActivePhotoDetailsAsset.analysis?.roomGuess
                    ? ` · AI sees ${resolvedActivePhotoDetailsAsset.analysis.roomGuess.toLowerCase()}`
                    : ''}
                </span>
                {resolvedActivePhotoDetailsAsset.assetType === 'generated' ? (
                  <span>
                    Stage:{' '}
                    {resolvedActivePhotoDetailsAsset.generationStage === 'clean_room'
                      ? 'Clean room'
                      : resolvedActivePhotoDetailsAsset.generationStage === 'finishes'
                      ? 'Buyer appeal previews'
                      : resolvedActivePhotoDetailsAsset.generationStage === 'style'
                      ? 'Style concept'
                      : 'Saved image version'}
                  </span>
                ) : null}
                {resolvedActivePhotoDetailsAsset.assetType !== 'generated' &&
                typeof resolvedActivePhotoDetailsAsset.analysis?.overallQualityScore === 'number' ? (
                  <div className="property-media-badges">
                    <span>Quality {resolvedActivePhotoDetailsAsset.analysis.overallQualityScore}/100</span>
                    {typeof resolvedActivePhotoDetailsAsset.analysis?.lightingScore === 'number' ? <span>Light {resolvedActivePhotoDetailsAsset.analysis.lightingScore}/100</span> : null}
                    {typeof resolvedActivePhotoDetailsAsset.analysis?.compositionScore === 'number' ? <span>Composition {resolvedActivePhotoDetailsAsset.analysis.compositionScore}/100</span> : null}
                    {resolvedActivePhotoDetailsAsset.analysis?.retakeRecommended ? <span>Retake suggested</span> : <span>Ready for listing review</span>}
                  </div>
                ) : null}
                {resolvedActivePhotoDetailsAsset.selectedVariant ? (
                  <span>
                    Marketing-preferred Vision output: {resolvedActivePhotoDetailsAsset.selectedVariant.label || 'Preferred result'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => handleOpenPhotoVariations(resolvedActivePhotoDetailsAsset)}
              >
                Variations
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  handleOpenAssetInVision(resolvedActivePhotoDetailsAsset);
                  setActivePhotoDetailsAsset(null);
                }}
                disabled={Boolean(status) || isArchivedProperty}
              >
                Open in Vision
              </button>
              {resolvedActivePhotoDetailsAsset.assetType === 'generated' && resolvedActivePhotoDetailsAsset.sourceMediaId ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setSelectedMediaAssetId(resolvedActivePhotoDetailsAsset.sourceMediaId);
                    setActivePhotoDetailsAsset(null);
                    setActiveTab('photos');
                  }}
                >
                  View original photo
                </button>
              ) : null}
              <button
                type="button"
                className="button-secondary button-danger"
                onClick={() => {
                  setPendingDeleteAsset(resolvedActivePhotoDetailsAsset);
                  setActivePhotoDetailsAsset(null);
                }}
                disabled={Boolean(status) || isArchivedProperty}
              >
                {resolvedActivePhotoDetailsAsset.assetType === 'generated' ? 'Delete saved version' : 'Delete original photo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resolvedActivePhotoVariationsAsset ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={closePhotoVariationsModal}
        >
          <div
            className="workspace-modal-card photo-variations-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Photo variations"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="photo-variations-modal-header">
              <div className="photo-variations-modal-topbar">
                <div className="photo-variations-modal-title">
                  <span className="label">Photo variations</span>
                  <h2>{resolvedActivePhotoVariationsAsset.roomLabel || 'Selected photo'}</h2>
                </div>
                <div className="workspace-modal-actions photo-variations-modal-actions">
                  <button
                    type="button"
                    className={
                      selectedPhotoVariationIds.length
                        ? 'button-secondary button-danger'
                        : 'button-secondary'
                    }
                    onClick={() => {
                      if (selectedPhotoVariationIds.length) {
                        setPendingDeletePhotoVariationIds([...selectedPhotoVariationIds]);
                        return;
                      }
                      setIsSelectingPhotoVariations((current) => !current);
                      setSelectedPhotoVariationIds([]);
                    }}
                    disabled={Boolean(status) || isArchivedProperty || !photoVariations.length}
                  >
                    {selectedPhotoVariationIds.length
                      ? `Delete Selected (${selectedPhotoVariationIds.length})`
                      : 'Select'}
                  </button>
                  <button
                    type="button"
                    className="button-secondary inline-button"
                    onClick={closePhotoVariationsModal}
                  >
                    Close
                  </button>
                </div>
              </div>
              <p className="workspace-control-note">
                Review every generated variation for this source photo. Use the best one as the
                baseline for Vision, or permanently delete the variations you do not need.
              </p>
              <div className="photo-variations-sort-row">
                <label className="photo-variations-sort-control">
                  <span>Sort by</span>
                  <select
                    className="select-input"
                    value={photoVariationSortKey}
                    onChange={(event) => setPhotoVariationSortKey(event.target.value)}
                    disabled={!photoVariations.length}
                  >
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                  </select>
                </label>
                <label className="photo-variations-sort-control">
                  <span>Order</span>
                  <select
                    className="select-input"
                    value={photoVariationSortDirection}
                    onChange={(event) => setPhotoVariationSortDirection(event.target.value)}
                    disabled={!photoVariations.length}
                  >
                    {photoVariationSortKey === 'date' ? (
                      <>
                        <option value="desc">Newest first</option>
                        <option value="asc">Oldest first</option>
                      </>
                    ) : (
                      <>
                        <option value="asc">A to Z</option>
                        <option value="desc">Z to A</option>
                      </>
                    )}
                  </select>
                </label>
              </div>
              {isSelectingPhotoVariations ? (
                <p className="workspace-control-note">
                  Select one or more variations, then use <strong>Delete Selected</strong>. This action cannot be reversed.
                </p>
              ) : null}
              {photoVariationsError ? (
                <div className="workspace-tab-stack">
                  <p>{photoVariationsError}</p>
                  <p className="workspace-control-note">
                    The modal did not lock up, but the variations request did not complete successfully.
                  </p>
                </div>
              ) : photoVariations.length || isLoadingPhotoVariations ? (
                <div className="vision-variation-loading-card">
                  <div className="vision-variation-loading-header">
                    <strong>
                      {photoVariationsTotalCount
                        ? `Loaded ${photoVariationsLoadedCount} of ${photoVariationsTotalCount} variations`
                        : isLoadingPhotoVariations
                          ? 'Loading variations'
                          : 'Variations ready'}
                    </strong>
                    {photoVariationsTotalCount ? <span>{photoVariationsProgressPercent}%</span> : null}
                  </div>
                  <div className="vision-variation-loading-progress" aria-hidden="true">
                    <span
                      className="vision-variation-loading-progress-bar"
                      style={{ width: `${photoVariationsProgressPercent || 8}%` }}
                    />
                  </div>
                  <p className="workspace-control-note">
                    {isLoadingPhotoVariations
                      ? 'We are loading saved variations in batches so you can start reviewing them without waiting for the entire history to finish.'
                      : 'All currently saved variations for this photo are loaded below.'}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="photo-variations-modal-body">
              {photoVariationsError ? null : photoVariations.length || isLoadingPhotoVariations ? (
                <div className="vision-attempt-grid">
                  {sortedPhotoVariations.map((variant) => {
                    const savedPhotoForVariant = mediaAssets.find(
                      (asset) => String(asset?.sourceVariantId || '') === String(variant.id),
                    );
                    const isCurrentVariant = variant.id === selectedVariant?.id;
                    const isMarkedForDelete = selectedPhotoVariationIds.includes(variant.id);
                    return (
                      <article
                        key={`photo-variation-${variant.id}`}
                        className={isCurrentVariant ? 'vision-attempt-card active' : 'vision-attempt-card'}
                      >
                        <img
                          src={variant.imageUrl}
                          alt={variant.label || 'Photo variation'}
                          className="vision-attempt-card-image"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="vision-attempt-card-copy">
                          <div className="vision-attempt-card-header">
                            <strong>{variant.label || 'Saved variation'}</strong>
                            {isSelectingPhotoVariations ? (
                              <label
                                className="vision-attempt-select-toggle"
                                aria-label={`Select ${variant.label || 'variation'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isMarkedForDelete}
                                  onChange={() => togglePhotoVariationSelection(variant.id)}
                                  disabled={Boolean(status) || isArchivedProperty}
                                />
                              </label>
                            ) : null}
                          </div>
                          <div className="tag-row compact">
                            <span>{getVisionWorkflowStage(getVisionWorkflowStageKeyForVariant(variant)).title}</span>
                            {isCurrentVariant ? <span>Viewing now</span> : null}
                            {variant.isSelected ? <span>Kept</span> : null}
                            {savedPhotoForVariant ? <span>Saved in Photos</span> : null}
                            {getVariantReviewScore(variant) ? <span>{getVariantReviewScore(variant)}/100</span> : null}
                          </div>
                          <p className="workspace-control-note vision-attempt-card-timestamp">
                            {formatDateTimeLabel(variant.createdAt)}
                          </p>
                          <p className="workspace-control-note">{getVariantSummary(variant)}</p>
                          <div className="vision-attempt-actions">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() =>
                                handleUseVariantAsVisionBaseline(
                                  resolvedActivePhotoVariationsAsset,
                                  variant,
                                )
                              }
                            >
                              Use as Vision baseline
                            </button>
                            <button
                              type="button"
                              className="button-secondary button-danger"
                              onClick={() => handleDeleteVisionVariant(variant)}
                              disabled={Boolean(status) || isArchivedProperty}
                            >
                              Delete permanently
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="workspace-tab-stack">
                  <p>No generated variations exist for this photo yet.</p>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => {
                      handleOpenAssetInVision(resolvedActivePhotoVariationsAsset);
                      closePhotoVariationsModal();
                    }}
                  >
                    Open in Vision
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeletePhotoVariationIds.length ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setPendingDeletePhotoVariationIds([])}
        >
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-variations-title"
            aria-describedby="delete-photo-variations-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete selected variations</span>
            <h2 id="delete-photo-variations-title">
              Delete {pendingDeletePhotoVariationIds.length} selected variation{pendingDeletePhotoVariationIds.length === 1 ? '' : 's'} permanently?
            </h2>
            <p id="delete-photo-variations-description">
              This action cannot be reversed. The selected variations will be removed from this photo&apos;s saved variation history.
            </p>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingDeletePhotoVariationIds([])}
                disabled={Boolean(status)}
              >
                Keep selected
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={handleConfirmDeleteSelectedPhotoVariations}
                disabled={Boolean(status)}
              >
                {status?.startsWith('Deleting ')
                  ? status
                  : 'Delete selected permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showVisionHistory ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setShowVisionHistory(false)}
        >
          <div
            className="workspace-modal-card vision-history-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Vision attempt history"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header-tight">
              <div>
                <span className="label">Previous attempts</span>
                <h2>Attempt history</h2>
              </div>
              <button
                type="button"
                className="button-secondary inline-button"
                onClick={() => setShowVisionHistory(false)}
              >
                Close
              </button>
            </div>
            {stageScopedVisionVariants.length ? (
              <div className="workspace-tab-stack">
                <p className="workspace-control-note">
                  These are the saved attempts for this stage. View one in the compare area, keep a winner, or permanently delete the ones you do not need.
                </p>
                {stageScopedVisionVariants.length > visibleVisionVariants.length ? (
                  <div className="workspace-action-column">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setShowMoreVisionVariants((current) => !current)}
                    >
                      {showMoreVisionVariants
                        ? 'Show fewer attempts'
                        : hiddenVisionVariantCount
                          ? `Show more attempts (${hiddenVisionVariantCount} lower-confidence hidden in this stage)`
                          : 'Show more attempts'}
                    </button>
                  </div>
                ) : null}
                <div className="vision-attempt-grid">
                  {visibleVisionVariants.map((variant) => {
                    const savedPhotoForVariant = mediaAssets.find(
                      (asset) => String(asset?.sourceVariantId || '') === String(variant.id),
                    );
                    const isCurrentVariant = variant.id === selectedVariant?.id;
                    return (
                      <article
                        key={`vision-history-${variant.id}`}
                        className={isCurrentVariant ? 'vision-attempt-card active' : 'vision-attempt-card'}
                      >
                        <img
                          src={variant.imageUrl}
                          alt={variant.label || 'Vision attempt'}
                          className="vision-attempt-card-image"
                        />
                        <div className="vision-attempt-card-copy">
                          <strong>{variant.label}</strong>
                          <div className="tag-row compact">
                            {isCurrentVariant ? <span>Viewing now</span> : null}
                            {latestGeneratedVariant?.id === variant.id ? <span>Latest generated</span> : null}
                            {variant.isSelected ? <span>Kept</span> : null}
                            {savedPhotoForVariant ? <span>Saved in Photos</span> : null}
                            {getVariantReviewScore(variant) ? <span>{getVariantReviewScore(variant)}/100</span> : null}
                            {variant.metadata?.review?.shouldHideByDefault ? <span>Lower confidence</span> : null}
                          </div>
                          <p className="workspace-control-note vision-attempt-card-timestamp">
                            {formatDateTimeLabel(variant.createdAt)}
                          </p>
                          <p className="workspace-control-note">
                            {getVariantSummary(variant)}
                          </p>
                          <div className="vision-attempt-actions">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => handleViewVisionVariant(variant, { closeHistory: true })}
                            >
                              {isCurrentVariant ? 'Viewing' : 'View in compare'}
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => handleSelectVariant(variant.id)}
                              disabled={Boolean(status) || isArchivedProperty || variant.isSelected}
                            >
                              {variant.isSelected ? 'Kept' : 'Keep'}
                            </button>
                            <button
                              type="button"
                              className="button-secondary button-danger"
                              onClick={() => handleDeleteVisionVariant(variant)}
                              disabled={Boolean(status) || isArchivedProperty}
                            >
                              Delete permanently
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p>No attempts exist for this stage yet. Generate the first result and it will appear here.</p>
            )}
          </div>
        </div>
      ) : null}

      {pendingDeleteAsset ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setPendingDeleteAsset(null)}>
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-title"
            aria-describedby="delete-photo-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete photo</span>
            <h2 id="delete-photo-title">Remove {pendingDeleteAsset.roomLabel || 'this photo'}?</h2>
            <p id="delete-photo-description">
              This will permanently remove the photo from the property gallery and also delete any generated vision variants tied to it.
            </p>
            <div className="workspace-modal-preview-row">
              <img src={pendingDeleteAsset.imageUrl} alt={pendingDeleteAsset.roomLabel || 'Selected property photo'} className="workspace-modal-preview-image" />
              <div className="workspace-modal-preview-copy">
                <strong>{pendingDeleteAsset.roomLabel || 'Property photo'}</strong>
                <span>{pendingDeleteAsset.listingCandidate ? 'Currently marked as a listing candidate.' : 'This photo is part of the shared property gallery.'}</span>
                <span>{pendingDeleteAsset.selectedVariant ? 'A preferred vision variant is attached and will also be removed.' : 'No preferred vision variant is attached.'}</span>
              </div>
            </div>
            <div className="workspace-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setPendingDeleteAsset(null)} disabled={Boolean(status)}>
                Keep photo
              </button>
              <button type="button" className="button-secondary button-danger" onClick={handleDeleteSelectedPhoto} disabled={Boolean(status)}>
                {status === 'Deleting photo...' ? 'Deleting...' : 'Delete photo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteProperty ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setPendingDeleteProperty(null)}>
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-property-title"
            aria-describedby="delete-property-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete property</span>
            <h2 id="delete-property-title">Delete {pendingDeleteProperty.title || 'this property'} permanently?</h2>
            <p id="delete-property-description">
              This action is irreversible. The property, pricing history, photos, brochures, reports, social pack, saved providers, provider outreach, and linked activity records will be removed permanently.
            </p>
            <div className="workspace-modal-preview-copy">
              <strong>{pendingDeleteProperty.title || 'Archived property'}</strong>
              <span>{buildPropertyAddressLabel(pendingDeleteProperty) || 'Address not listed'}</span>
              <span>Only archived properties can be deleted permanently.</span>
            </div>
            <div className="workspace-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setPendingDeleteProperty(null)} disabled={Boolean(status)}>
                Cancel
              </button>
              <button type="button" className="button-danger" onClick={handleDeleteArchivedProperty} disabled={Boolean(status)}>
                {status === 'Deleting property...' ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteVisionVariant ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setPendingDeleteVisionVariant(null)}
        >
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-vision-variant-title"
            aria-describedby="delete-vision-variant-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete attempt</span>
            <h2 id="delete-vision-variant-title">
              Delete {pendingDeleteVisionVariant.label || 'this vision attempt'} permanently?
            </h2>
            <p id="delete-vision-variant-description">
              This will remove the attempt from Vision history for this photo.
              {pendingDeleteVisionVariant.savedPhotoLabel
                ? ` The saved Photos copy for ${pendingDeleteVisionVariant.savedPhotoLabel} will stay in the library.`
                : ''}
            </p>
            <div className="workspace-modal-preview-row">
              <img
                src={pendingDeleteVisionVariant.imageUrl}
                alt={pendingDeleteVisionVariant.label || 'Vision attempt'}
                className="workspace-modal-preview-image"
              />
              <div className="workspace-modal-preview-copy">
                <strong>{pendingDeleteVisionVariant.label || 'Vision attempt'}</strong>
                {pendingDeleteVisionVariant.reviewScore ? (
                  <span>{pendingDeleteVisionVariant.reviewScore}/100 reviewed</span>
                ) : null}
                <span>{pendingDeleteVisionVariant.summary || 'This generated attempt is no longer needed.'}</span>
              </div>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingDeleteVisionVariant(null)}
                disabled={Boolean(status)}
              >
                Keep attempt
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={handleConfirmDeleteVisionVariant}
                disabled={Boolean(status)}
              >
                {status === 'Deleting vision attempt...' ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingPruneVisionDrafts ? (
        <div
          className="workspace-modal-backdrop"
          role="presentation"
          onClick={() => setPendingPruneVisionDrafts(null)}
        >
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prune-vision-drafts-title"
            aria-describedby="prune-vision-drafts-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Delete earlier drafts</span>
            <h2 id="prune-vision-drafts-title">
              Keep only {pendingPruneVisionDrafts.variantLabel || 'the selected version'}?
            </h2>
            <p id="prune-vision-drafts-description">
              Every earlier Vision draft for {pendingPruneVisionDrafts.roomLabel || 'this photo'} will be removed permanently.
              The current selected version will stay in place.
            </p>
            <div className="workspace-modal-preview-copy">
              <strong>{pendingPruneVisionDrafts.roomLabel || 'Selected photo'}</strong>
              <span>{pendingPruneVisionDrafts.variantLabel || 'Selected version'} will remain as the kept draft.</span>
            </div>
            <div className="workspace-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingPruneVisionDrafts(null)}
                disabled={Boolean(status)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={handleConfirmPruneVisionDraftHistory}
                disabled={Boolean(status)}
              >
                {status === 'Deleting earlier vision drafts...' ? 'Deleting...' : 'Delete earlier drafts'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {generationPrompt ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setGenerationPrompt(null)}>
          <div
            className="workspace-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="generation-prompt-title"
            aria-describedby="generation-prompt-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">{generationPrompt.kind === 'flyer' ? 'Brochure output' : 'Seller report'}</span>
            <h2 id="generation-prompt-title">{generationPrompt.title}</h2>
            <p id="generation-prompt-description">{generationPrompt.message}</p>
            <div className="workspace-modal-actions">
              <button type="button" className="button-secondary" onClick={() => setGenerationPrompt(null)}>
                Stay here
              </button>
              <button type="button" className="button-primary" onClick={handleDownloadGeneratedDocument}>
                {generationPrompt.downloadLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showProviderMap ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setShowProviderMap(false)}>
          <div
            className="workspace-modal-card workspace-map-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-map-title"
            aria-describedby="provider-map-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-map-modal-header">
              <div>
                <span className="label">Provider map</span>
                <h2 id="provider-map-title">
                  {providerSource?.categoryLabel || providerSuggestionTask?.providerCategoryLabel || 'Provider coverage'}
                </h2>
                <p id="provider-map-description">
                  {hasInternalProviderResults
                    ? 'Review matched Workside marketplace providers around the property in a controlled map view.'
                    : 'Review Google fallback providers around the property in a controlled map view.'}
                </p>
                {providerMapProviders.some((provider) => provider.isExternalFallback) && hasInternalProviderResults ? (
                  <div className="workspace-map-scope-toggle" role="group" aria-label="Provider map coverage scope">
                    <button
                      type="button"
                      className={providerMapScope === 'internal' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapScope('internal')}
                    >
                      Workside only
                    </button>
                    <button
                      type="button"
                      className={providerMapScope === 'all' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapScope('all')}
                    >
                      Include Google
                    </button>
                  </div>
                ) : null}
                {providerMapViewportProviders.length > 6 ? (
                  <div className="workspace-map-scope-toggle" role="group" aria-label="Provider map density">
                    <button
                      type="button"
                      className={providerMapDensity === 'compact' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapDensity('compact')}
                    >
                      Top matches
                    </button>
                    <button
                      type="button"
                      className={providerMapDensity === 'expanded' ? 'mode-chip active' : 'mode-chip'}
                      onClick={() => setProviderMapDensity('expanded')}
                    >
                      Expanded view
                    </button>
                  </div>
                ) : null}
                <div className="mini-stats provider-map-metrics">
                  <div className="stat-card">
                    <strong>Shown on map</strong>
                    <span>{providerMapDisplayedProviders.length}</span>
                  </div>
                  <div className="stat-card">
                    <strong>Workside</strong>
                    <span>{providerMapInternalCount}</span>
                  </div>
                  {providerMapExternalCount ? (
                    <div className="stat-card">
                      <strong>Google</strong>
                      <span>{providerMapExternalCount}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="workspace-modal-actions">
                {providerGoogleSearchUrl ? (
                  <a
                    href={providerGoogleSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button"
                  >
                    Open map search
                  </a>
                ) : null}
                <button type="button" className="button-secondary" onClick={() => setShowProviderMap(false)}>
                  Close map
                </button>
              </div>
            </div>
            <ProviderResultsMap
              propertyId={property?.id}
              categoryKey={providerSuggestionTask?.providerCategoryKey || providerSource?.categoryKey || ''}
              taskKey={providerSuggestionTask?.systemKey || providerSuggestionTask?.id || ''}
              includeExternal={providerMapScope === 'all'}
              limit={providerMapResultLimit}
              googleMapsUrl={providerGoogleSearchUrl}
              frameClassName="property-map-frame-expanded"
            />
            {providerMapDisplayedProviders.length ? (
              <div className="provider-map-summary-list">
                {providerMapScope === 'internal' && providerMapViewportProviders.length !== providerMapProviders.length ? (
                  <p className="workspace-control-note provider-map-summary-note">
                    The map is focused on matched Workside providers so the view stays local. Google fallback results remain available in the checklist list and through Google Maps.
                  </p>
                ) : null}
                {hiddenProviderMapCount ? (
                  <p className="workspace-control-note provider-map-summary-note">
                    Showing the top {providerMapDisplayedProviders.length} provider markers to keep the map readable. Switch to Expanded view to include {hiddenProviderMapCount} more.
                  </p>
                ) : null}
                {providerMapDisplayedProviders.map((provider) => (
                  <article key={`provider-map-summary-${provider.id}`} className="provider-map-summary-item">
                    <div>
                      <strong>{provider.businessName}</strong>
                      <span>
                        {provider.isExternalFallback ? 'Google fallback' : 'Workside marketplace'}
                        {provider.coverageLabel ? ` · ${provider.coverageLabel}` : ''}
                        {!provider.isExternalFallback && provider.status ? ` · ${provider.status.replace(/_/g, ' ')}` : ''}
                      </span>
                    </div>
                    <div className="provider-map-summary-meta">
                      {provider.turnaroundLabel ? <span>{provider.turnaroundLabel}</span> : null}
                      {provider.pricingSummary ? <span>{provider.pricingSummary}</span> : null}
                      {provider.phone ? <span>{provider.phone}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {activeProviderDetails ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setActiveProviderDetails(null)}>
          <div
            className="workspace-modal-card provider-details-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="label">Provider details</span>
            <h2 id="provider-details-title">{activeProviderDetails.businessName}</h2>
            <p>
              {activeProviderDetails.description || 'No additional description is available for this provider yet.'}
            </p>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Category</strong>
                <span>{activeProviderDetails.categoryLabel || activeProviderDetails.categoryKey?.replace(/_/g, ' ') || 'Provider'}</span>
              </div>
              <div className="stat-card">
                <strong>Coverage</strong>
                <span>{activeProviderDetails.coverageLabel || 'Coverage not listed'}</span>
              </div>
              <div className="stat-card">
                <strong>Contact</strong>
                <span>{activeProviderDetails.phone || activeProviderDetails.email || 'Not listed'}</span>
              </div>
              <div className="stat-card">
                <strong>Source</strong>
                <span>{activeProviderDetails.isExternalFallback ? 'Google fallback' : 'Workside marketplace'}</span>
              </div>
            </div>
            <div className="provider-quality-row">
              {activeProviderDetails.turnaroundLabel ? <span>{activeProviderDetails.turnaroundLabel}</span> : null}
              {activeProviderDetails.pricingSummary ? <span>{activeProviderDetails.pricingSummary}</span> : null}
              {typeof activeProviderDetails.rating === 'number' && activeProviderDetails.rating > 0 ? (
                <span>
                  {activeProviderDetails.rating.toFixed(1)} stars
                  {activeProviderDetails.reviewCount ? ` · ${activeProviderDetails.reviewCount} reviews` : ''}
                </span>
              ) : null}
              {activeProviderDetails.serviceArea?.radiusMiles ? (
                <span>{activeProviderDetails.serviceArea.radiusMiles} mile radius</span>
              ) : null}
            </div>
            {activeProviderDetails.serviceHighlights?.length ? (
              <div className="tag-row">
                {activeProviderDetails.serviceHighlights.map((highlight) => (
                  <span key={`${activeProviderDetails.id}-${highlight}`}>{highlight}</span>
                ))}
              </div>
            ) : null}
            {!activeProviderDetails.isExternalFallback && activeProviderDetails.verification?.disclaimer ? (
              <p className="workspace-control-note provider-disclaimer">
                {activeProviderDetails.verification.disclaimer}
              </p>
            ) : null}
            <div className="workspace-modal-actions">
              {activeProviderDetails.websiteUrl ? (
                <a href={activeProviderDetails.websiteUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                  Visit website
                </a>
              ) : null}
              {activeProviderDetails.mapsUrl ? (
                <a href={activeProviderDetails.mapsUrl} target="_blank" rel="noreferrer" className="button-secondary inline-button">
                  Open in Maps
                </a>
              ) : null}
              <button type="button" className="button-secondary" onClick={() => setActiveProviderDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showExpandedMap ? (
        <div className="workspace-modal-backdrop" role="presentation" onClick={() => setShowExpandedMap(false)}>
          <div
            className="workspace-modal-card workspace-map-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-map-title"
            aria-describedby="expanded-map-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-map-modal-header">
              <div>
                <span className="label">Expanded map</span>
                <h2 id="expanded-map-title">Neighborhood context</h2>
                <p id="expanded-map-description">
                  Review the subject property and nearby comps in a larger map view without leaving the workspace.
                </p>
              </div>
              <div className="workspace-modal-actions">
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary inline-button"
                  >
                    View comps in Maps
                  </a>
                ) : null}
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowExpandedMap(false)}
                >
                  Close map
                </button>
              </div>
            </div>
            <PropertyLocationMap
              property={property}
              comps={selectedComps}
              mapsApiKey={mapsApiKey}
              googleMapsUrl={googleMapsUrl}
              frameClassName="property-map-frame-expanded"
            />
          </div>
        </div>
      ) : null}

      <section className="workspace-shell">
        <section className="workspace-page-header">
          <div className="workspace-page-header-copy">
            <span className="label">Property workspace</span>
            <h1>{property?.title || 'Property'}</h1>
            <p className="workspace-address-line">{[property?.addressLine1, property?.city, property?.state, property?.zip].filter(Boolean).join(', ')}</p>
          <div className="tag-row">
            <span>{latestPricing ? `${formatCurrency(latestPricing.recommendedListLow)} to ${formatCurrency(latestPricing.recommendedListHigh)}` : 'Pricing pending'}</span>
            {property?.selectedListPrice ? <span>Chosen {formatCurrency(property.selectedListPrice)}</span> : null}
            <span>{readinessScore}/100 readiness</span>
            <span>{mediaAssets.length} photo{mediaAssets.length === 1 ? '' : 's'}</span>
            {isArchivedProperty ? <span>Archived · read-only</span> : null}
          </div>
          </div>

          <div className="workspace-page-header-actions">
            <button type="button" className={status.includes('Refreshing') ? 'button-primary button-busy' : 'button-primary'} onClick={handleAnalyzePricing} disabled={Boolean(status) || isArchivedProperty}>{status.includes('Refreshing') ? 'Refreshing analysis...' : 'Refresh pricing'}</button>
            <Link href="/dashboard" className="button-secondary inline-button">Back to dashboard</Link>
          </div>
        </section>

        <section className="workspace-body-layout">
          <aside className="workspace-workflow-nav">
            <div className="content-card workspace-workflow-card">
              <span className="label">Workflow navigator</span>
              <h2>{guidedWorkflow?.completionPercent ?? 0}% complete</h2>
              <p>
                {guidedWorkflow?.currentPhaseLabel || 'Workflow'} ·{' '}
                {guidedWorkflow?.role === 'agent' ? 'Realtor guide' : 'Seller guide'}
              </p>
              <div className="mini-stats">
                <div className="stat-card">
                  <strong>Market-ready</strong>
                  <span>{guidedWorkflow?.marketReadyScore ?? readinessScore}/100</span>
                </div>
                <div className="stat-card">
                  <strong>Active step</strong>
                  <span>{workflowPreviewStep?.title || workflowNextStep?.title || 'Ready to review'}</span>
                </div>
              </div>
            </div>
            <div className="content-card workspace-workflow-card workspace-wizard-card workspace-workflow-nav-card">
              <span className="label">Guided steps</span>
              <div className="workspace-step-list workspace-step-list-compact">
                {workflowSteps.map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    className={`workspace-step-item workspace-step-item-${step.status}${workflowNextStep?.key === step.key ? ' active' : ''}${workflowPreviewStep?.key === step.key ? ' preview' : ''}${(!step.actionTarget && !step.actionHref) ? ' noninteractive' : ''}`}
                    onClick={() => {
                      setWorkflowPreviewStepKey(step.key);
                      openWorkflowStep(step);
                    }}
                    onMouseEnter={() => setWorkflowPreviewStepKey(step.key)}
                    onFocus={() => setWorkflowPreviewStepKey(step.key)}
                    aria-disabled={Boolean(status) || (!step.actionTarget && !step.actionHref)}
                  >
                    <div className="workspace-step-copy">
                      <strong>{step.title}</strong>
                      <span>{step.actionTarget ? getWorkspaceTabLabel(step.actionTarget) : 'Not ready yet'}</span>
                    </div>
                    <em className={`workspace-workflow-status workspace-workflow-status-${step.status}`}>{formatWorkflowStatus(step.status)}</em>
                  </button>
                ))}
              </div>
              <div className="workspace-workflow-hover-card">
                <strong>{workflowPreviewStep?.title || 'Hover over a step'}</strong>
                <p>{workflowPreviewStep?.description || 'Each workflow step explains what to do next and can jump you to the right part of the workspace.'}</p>
                {workflowPreviewStep?.status === 'locked' ? (
                  <p className="workspace-control-note">
                    Locked means an earlier required step still needs attention before this one opens.
                    {workflowPreviewStep?.lockedReason ? ` ${workflowPreviewStep.lockedReason}` : ''}
                  </p>
                ) : null}
                {workflowPreviewStep?.helperText ? (
                  <p className="workspace-control-note">{workflowPreviewStep.helperText}</p>
                ) : null}
                {workflowPreviewStep ? (
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => openWorkflowStep(workflowPreviewStep)}
                    disabled={Boolean(status) || (!workflowPreviewStep.actionTarget && !workflowPreviewStep.actionHref)}
                  >
                    {workflowPreviewStep?.ctaLabel || 'Open this step'}
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
          <div ref={workspaceBodyMainRef} className="workspace-body-main">
            <section className="workspace-tab-bar" aria-label="Workspace tabs">
              {visibleWorkspaceTabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </section>

            {status ? <p className="status-copy">{status}</p> : null}
            {isArchivedProperty ? (
              <section className="workspace-archive-banner">
                <strong>Archived property</strong>
                <p>
                  This workspace remains viewable, but new pricing runs, media updates, checklist edits, provider actions,
                  and fresh brochure/report generation are disabled until the property is restored from the dashboard.
                </p>
                <p className="workspace-archive-detail">
                  Archiving frees an active-property slot. Restoring this workspace will use a slot again, and permanent delete will remove all linked outputs, providers, and activity records tied to this property.
                </p>
                <div className="workspace-archive-actions">
                  <Link href="/dashboard" className="button-secondary inline-button">
                    Manage on dashboard
                  </Link>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => setPendingDeleteProperty(property)}
                    disabled={Boolean(status)}
                  >
                    Delete permanently
                  </button>
                </div>
              </section>
            ) : null}

            <section className="workspace-content-layout">
              <div className="workspace-tab-main">{renderActiveTab()}</div>
              <aside className="workspace-quick-rail">
                {homeAdvisorGuide ? (
                  <div className="content-card workspace-quick-card workspace-guide-card">
                    <div className="workspace-guide-header">
                      <span className="label">Home Advisor Agent</span>
                      <button
                        type="button"
                        className="button-ghost workspace-guide-dismiss"
                        onClick={() => setIsHomeAdvisorGuideHidden(true)}
                        aria-label="Dismiss Home Advisor guide"
                      >
                        Hide
                      </button>
                    </div>
                    <h3>{homeAdvisorGuide.title}</h3>
                    <p>{homeAdvisorGuide.body}</p>
                    {homeAdvisorGuide.highlights?.length ? (
                      <div className="workspace-guide-chip-list">
                        {homeAdvisorGuide.highlights.map((highlight) => (
                          <span key={highlight} className="metric-pill">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="button-primary"
                      onClick={homeAdvisorGuide.ctaAction}
                      disabled={Boolean(status)}
                    >
                      {homeAdvisorGuide.ctaLabel}
                    </button>
                  </div>
                ) : (
                  <div className="content-card workspace-quick-card workspace-guide-card workspace-guide-card-muted">
                    <span className="label">Home Advisor Agent</span>
                    <p>The guide is hidden for this property. Bring it back any time if you want a simpler next-step prompt.</p>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setIsHomeAdvisorGuideHidden(false)}
                    >
                      Show guide
                    </button>
                  </div>
                )}
                <div className="content-card workspace-quick-card">
                  <span className="label">Next step</span>
                  <h3>{workflowNextStep?.title || nextBestAction.title}</h3>
                  <p>{workflowNextStep?.description || nextBestAction.detail}</p>
                  {workflowNextStep?.helperText ? (
                    <p className="workspace-control-note">{workflowNextStep.helperText}</p>
                  ) : null}
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => (workflowNextStep ? openWorkflowStep(workflowNextStep) : setActiveTab(nextBestAction.tab))}
                    disabled={Boolean(status)}
                  >
                    {workflowNextStep?.ctaLabel || `Open ${getWorkspaceTabLabel(nextBestAction.tab)}`}
                  </button>
                </div>
                <div className="content-card workspace-quick-card"><span className="label">Quick stats</span><ul className="plain-list"><li>{selectedComps.length} comp(s) loaded</li><li>{listingCandidateAssets.length} listing photo pick(s)</li><li>{mediaAssets.filter((asset) => asset.selectedVariant).length} preferred vision variant(s)</li><li>{checklist?.summary?.completedCount ?? 0} task(s) complete</li><li>{providerRecommendations.length} provider recommendation(s)</li></ul></div>
              </aside>
            </section>
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
