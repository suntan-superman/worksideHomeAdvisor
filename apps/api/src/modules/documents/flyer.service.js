import mongoose from 'mongoose';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { formatCurrency } from '@workside/utils';

import { env } from '../../config/env.js';
import { generateMarketingInsights } from '../../services/aiWorkflowService.js';
import { generateStructuredJson, isOpenAiConfigured } from '../../services/openaiClient.js';
import { buildMediaVariantUrl } from '../../services/storageService.js';
import {
  getMediaAssetMarketplaceState,
  listMediaAssets,
  sortMarketplaceReadyAssets,
} from '../media/media.service.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { FlyerModel } from './flyer.model.js';
import { renderMarketingReportPdf } from './html-pdf.service.js';
import {
  createPdfPalette,
  drawBrandHeader,
  drawBulletList,
  drawContainedImageFrame,
  drawDocumentFooter,
  drawDocumentFrame,
  drawMetricCard,
  drawSectionEyebrow,
  drawWrappedText,
  fetchPdfImage,
  PDF_PAGE_WIDTH,
  PDF_PAGE_HEIGHT,
  PDF_PAGE_MARGIN,
  sanitizeFilePart,
  wrapText,
} from './pdf-theme.js';
import {
  buildFlyerCtaMetadata,
  buildFlyerModeCopy,
  chooseEnhancedFlyerAssets,
  deriveFlyerReadiness,
  flyerModeLabel,
  resolveFlyerModeDecision,
  selectFlyerMode,
} from './flyer-enhancement-helpers.js';

function serializeFlyer(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    flyerType: document.flyerType,
    headline: document.headline,
    subheadline: document.subheadline,
    priceText: document.priceText,
    locationLine: document.locationLine,
    summary: document.summary,
    highlights: document.highlights || [],
    selectedPhotos: document.selectedPhotos || [],
    mode: document.mode || 'launch_ready',
    modeLabel: document.modeLabel || '',
    readinessScore: Number(document.readinessScore || 0),
    readinessSignals: document.readinessSignals || {},
    ctaMetadata: document.ctaMetadata || {},
    callToAction: document.callToAction,
    disclaimer: document.disclaimer,
    customizations: document.customizations || {},
    source: document.source || 'fallback',
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function sortFlyerAssets(assets) {
  return sortMarketplaceReadyAssets(assets || []);
}

function chooseFlyerPhotos(
  assets,
  selectedPhotoAssetIds = [],
  brochureVariantByAssetId = new Map(),
) {
  const rankedAssets = sortFlyerAssets(assets);
  const selectedAssets = chooseEnhancedFlyerAssets(rankedAssets, selectedPhotoAssetIds, {
    maxCount: 8,
  });
  const overflowAssets = rankedAssets.filter(
    (asset) => !selectedAssets.some((selectedAsset) => selectedAsset.id === asset.id),
  );
  const candidateAssets = [...selectedAssets, ...overflowAssets].slice(0, 16);

  const mapAssetToPhoto = (asset) => {
      const selectedVariant =
        brochureVariantByAssetId.get(asset.id) || asset.selectedVariant || null;
      const marketplaceState = getMediaAssetMarketplaceState(asset, {
        preferredVariant: selectedVariant,
      });

      return {
        assetId: asset.id,
        roomLabel: asset.roomLabel,
        imageUrl: selectedVariant?.imageUrl || asset.imageUrl || asset.imageDataUrl || null,
        score: asset.analysis?.overallQualityScore || null,
        listingCandidate: marketplaceState.publishable,
        listingNote: asset.listingNote || '',
        usesPreferredVariant: Boolean(selectedVariant),
        variantLabel: selectedVariant?.label || '',
        variantType: selectedVariant?.variantType || '',
        qualityLabel: marketplaceState.qualityLabel || '',
        marketplaceStatus: marketplaceState.publishable ? 'Marketplace ready' : 'Review draft',
      };
    };

  const mappedPhotos = candidateAssets.map(mapAssetToPhoto);
  const getPhotoIdentity = (photo) => {
    const url = String(photo?.imageUrl || '').trim();
    const normalizedUrl = url.split('?')[0].toLowerCase();
    const fileName = normalizedUrl.split('/').pop() || '';
    return String(photo?.assetId || fileName || normalizedUrl || '').toLowerCase();
  };
  const roomBucket = (roomLabel = '') => {
    const room = normalizeRoomLabel(roomLabel);
    if (!room) {
      return 'other';
    }
    if (room.includes('exterior') || room.includes('front') || room.includes('backyard') || room.includes('yard')) {
      return 'exterior';
    }
    if (room.includes('kitchen')) {
      return 'kitchen';
    }
    if (room.includes('living') || room.includes('family') || room.includes('great room')) {
      return 'living';
    }
    if (room.includes('bedroom') || room.includes('primary')) {
      return 'bedroom';
    }
    return 'other';
  };

  const uniquePhotos = [];
  const seenIdentities = new Set();
  for (const photo of mappedPhotos) {
    if (!photo?.imageUrl) {
      continue;
    }
    const identity = getPhotoIdentity(photo);
    if (!identity || seenIdentities.has(identity)) {
      continue;
    }
    seenIdentities.add(identity);
    uniquePhotos.push(photo);
    if (uniquePhotos.length >= 8) {
      break;
    }
  }

  const prioritizedBuckets = ['exterior', 'kitchen', 'living'];
  const diversified = [];
  for (const bucket of prioritizedBuckets) {
    const candidate = uniquePhotos.find(
      (photo) =>
        roomBucket(photo.roomLabel) === bucket &&
        !diversified.some((entry) => getPhotoIdentity(entry) === getPhotoIdentity(photo)),
    );
    if (!candidate) {
      continue;
    }
    diversified.push(candidate);
  }

  for (const photo of uniquePhotos) {
    if (diversified.length >= 8) {
      break;
    }
    if (diversified.some((entry) => getPhotoIdentity(entry) === getPhotoIdentity(photo))) {
      continue;
    }
    diversified.push(photo);
  }

  return diversified.slice(0, 8);
}

function buildPriceText(property, pricing, flyerType) {
  if (flyerType === 'rental') {
    return 'Contact for rental pricing';
  }

  if (property?.selectedListPrice) {
    return formatCurrency(property.selectedListPrice);
  }

  if (!pricing?.recommendedListLow || !pricing?.recommendedListHigh) {
    return 'Pricing available on request';
  }

  return `${formatCurrency(pricing.recommendedListLow)} to ${formatCurrency(pricing.recommendedListHigh)}`;
}

function normalizeRoomLabel(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasRoomSignal(roomLabels = [], pattern) {
  return (roomLabels || []).some((label) => pattern.test(label));
}

function buildSignalBundle({ property, selectedPhotos = [] }) {
  const roomLabels = (selectedPhotos || []).map((photo) => normalizeRoomLabel(photo?.roomLabel));
  const listingNotes = (selectedPhotos || [])
    .map((photo) => String(photo?.listingNote || '').toLowerCase())
    .join(' ');
  const hasKitchen = hasRoomSignal(roomLabels, /kitchen/);
  const hasLiving = hasRoomSignal(roomLabels, /living|family|great room/);
  const hasExterior = hasRoomSignal(roomLabels, /exterior|front|backyard|yard/);
  const hasPrimaryBed = hasRoomSignal(roomLabels, /primary|bedroom/);
  const hasNaturalLight = listingNotes.includes('light') || listingNotes.includes('bright') || (selectedPhotos || []).some((photo) => Number(photo?.score || 0) >= 78);
  const squareFeet = Number(property?.squareFeet || 0);
  const hasLot = Number(property?.lotSizeSqFt || 0) > 0;

  const layoutLine = squareFeet >= 2400
    ? 'Expansive floor plan with clearly separated living zones.'
    : squareFeet >= 1500
      ? 'Balanced layout connecting kitchen flow and everyday living space.'
      : 'Practical layout designed for efficient daily flow.';
  const kitchenLine = hasKitchen
    ? hasNaturalLight
      ? 'Kitchen photos show bright prep surfaces and clear workspace definition.'
      : 'Kitchen photos highlight practical counter workspace and storage flow.'
    : '';
  const livingLine = hasLiving
    ? 'Main living area reads clean and functional for showing conversations.'
    : '';
  const exteriorLine = hasExterior
    ? 'Exterior views support curb-first appeal and stronger first impressions.'
    : hasLot
      ? 'Lot footprint supports flexible outdoor use and staging potential.'
      : '';
  const primaryBedLine = hasPrimaryBed
    ? 'Primary sleeping area presents as straightforward and ready for staging continuity.'
    : '';

  const signalLines = [kitchenLine, livingLine, exteriorLine, primaryBedLine, layoutLine]
    .filter(Boolean);

  const subheadline = hasKitchen && hasLiving
    ? 'Bright kitchen and connected living layout'
    : hasExterior && hasLiving
      ? 'Curb appeal paired with practical interior flow'
      : hasKitchen
        ? 'Kitchen-forward layout with practical room flow'
        : hasExterior
          ? 'Curb-first presentation with clear interior flow'
          : 'Practical layout with clean room-to-room flow';

  const highlightCandidates = [
    kitchenLine || 'Kitchen layout supports practical prep and hosting use.',
    livingLine || 'Main living zone presents clean lines for first-showing walkthroughs.',
    exteriorLine || 'Exterior presentation supports stronger first impressions.',
    layoutLine,
    hasNaturalLight ? 'Natural light support is visible across key rooms.' : '',
    hasPrimaryBed ? 'Bedroom sequence supports clear buyer walk-through pacing.' : '',
  ].filter(Boolean);
  const dedupedHighlights = [];
  const seen = new Set();
  for (const line of highlightCandidates) {
    const key = String(line || '').toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    dedupedHighlights.push(line);
  }

  return {
    subheadline,
    primarySignal: signalLines[0] || layoutLine,
    secondarySignal: signalLines[1] || '',
    tertiarySignal: signalLines[2] || '',
    highlights: dedupedHighlights.slice(0, 4),
  };
}

function buildSpecificModeCopy({
  property,
  flyerType,
  mode,
  locationLine,
  selectedPhotos,
}) {
  const title = property?.title || 'This property';
  const signalBundle = buildSignalBundle({ property, selectedPhotos });
  const listingContext = locationLine ? ` ${locationLine}.` : '';

  if (flyerType === 'rental') {
    if (mode === 'preview') {
      return {
        subheadline: `Early rental preview: ${signalBundle.subheadline}.`,
        summary: `${title} preview highlights ${signalBundle.primarySignal.toLowerCase()}${signalBundle.secondarySignal ? ` ${signalBundle.secondarySignal}` : ''}${listingContext} Early inquiries are prioritized for this listing.`,
      };
    }
    if (mode === 'launch_ready') {
      return {
        subheadline: `Rental-ready marketing: ${signalBundle.subheadline}.`,
        summary: `${title} is positioned with ${signalBundle.primarySignal.toLowerCase()}${signalBundle.tertiarySignal ? ` ${signalBundle.tertiarySignal}` : ''}${listingContext} Use this flyer to convert qualified tour requests quickly.`,
      };
    }
    return {
      subheadline: `Priority rental launch: ${signalBundle.subheadline}.`,
      summary: `${title} is marketed with ${signalBundle.primarySignal.toLowerCase()} and polished renter-facing sequencing.${listingContext} Prioritize qualified tour requests while demand is active.`,
    };
  }

  if (mode === 'preview') {
    return {
      subheadline: `Early preview: ${signalBundle.subheadline}.`,
      summary: `${title} preview highlights ${signalBundle.primarySignal.toLowerCase()}${signalBundle.secondarySignal ? ` ${signalBundle.secondarySignal}` : ''}${listingContext} Early inquiries are prioritized for this listing.`,
    };
  }
  if (mode === 'launch_ready') {
    return {
      subheadline: `Launch-ready positioning: ${signalBundle.subheadline}.`,
      summary: `${title} is positioned with ${signalBundle.primarySignal.toLowerCase()}${signalBundle.tertiarySignal ? ` ${signalBundle.tertiarySignal}` : ''}${listingContext} Request a showing to review full property details.`,
    };
  }
  return {
    subheadline: `Premium launch positioning: ${signalBundle.subheadline}.`,
    summary: `${title} is presented with ${signalBundle.primarySignal.toLowerCase()} and high-clarity marketing sequencing.${listingContext} Use this format for high-intent buyer conversations and showing conversion.`,
  };
}

function tightenFlyerText(text = '', signalBundle = {}) {
  let value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) {
    return '';
  }
  const replacementSignal = String(signalBundle?.primarySignal || 'clear room-to-room layout and stronger first-impression cues')
    .replace(/\.$/, '');
  const replacements = [
    { pattern: /comfortable and spacious/gi, replacement: replacementSignal.toLowerCase() },
    { pattern: /beautiful home/gi, replacement: 'well-presented property' },
    { pattern: /comfort and flow/gi, replacement: 'layout clarity and room flow' },
    { pattern: /everyday livability/gi, replacement: 'practical day-to-day function' },
    { pattern: /welcoming tone/gi, replacement: 'clear buyer-facing positioning' },
    { pattern: /kitchen photos? (show|highlight)[^.]*/gi, replacement: 'the kitchen anchors prep, hosting, and day-to-day flow' },
    { pattern: /main living area reads clean and functional[^.]*/gi, replacement: 'the main living area feels bright, open, and showing-ready' },
    { pattern: /exterior views support curb-first appeal[^.]*/gi, replacement: 'curb presence creates a strong first impression on arrival' },
    { pattern: /primary sleeping area presents as straightforward[^.]*/gi, replacement: 'the primary suite supports calm, practical daily use' },
  ];
  for (const { pattern, replacement } of replacements) {
    value = value.replace(pattern, replacement);
  }
  return value;
}

function buildFallbackFlyer({ property, pricing, flyerType, selectedPhotos }) {
  const readinessSignals = deriveFlyerReadiness(selectedPhotos);
  const modeDecision = resolveFlyerModeDecision(readinessSignals);
  const mode = modeDecision.mode || selectFlyerMode(readinessSignals);
  const modeLabel = flyerModeLabel(mode);
  const locationLine = `${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`;
  const modeCopy = buildFlyerModeCopy({
    flyerType,
    mode,
    propertyTitle: property.title,
    locationLine,
  });
  const specificCopy = buildSpecificModeCopy({
    property,
    flyerType,
    mode,
    locationLine,
    selectedPhotos,
  });
  const signalBundle = buildSignalBundle({ property, selectedPhotos });
  const ctaMetadata = buildFlyerCtaMetadata({
    flyerType,
    mode,
    propertyId: property?.id || property?._id?.toString?.() || '',
  });
  const propertyId = property?.id || property?._id?.toString?.() || '';
  console.info(
    `[flyer] mode_selected propertyId=${propertyId} mode=${mode} reason="${modeDecision.reason || 'none'}" readiness=${readinessSignals.readinessScore} marketplaceReady=${readinessSignals.marketplaceReadyCount}`,
  );

  return {
    flyerType,
    mode,
    modeLabel,
    readinessScore: readinessSignals.readinessScore,
    readinessSignals: {
      ...readinessSignals,
      modeDecisionReason: modeDecision.reason || '',
    },
    headline:
      mode === 'preview'
        ? 'Featured Property Opportunity'
        : property.title,
    subheadline: tightenFlyerText(specificCopy.subheadline || modeCopy.subheadline, signalBundle),
    priceText: buildPriceText(property, pricing, flyerType),
    locationLine,
    summary: tightenFlyerText(specificCopy.summary || modeCopy.summary, signalBundle),
    highlights: signalBundle.highlights.length
      ? signalBundle.highlights
      : [
          `${property.bedrooms || '--'} bedrooms`,
          `${property.bathrooms || '--'} bathrooms`,
          `${property.squareFeet || '--'} square feet`,
          property.propertyType || 'single family',
        ],
    selectedPhotos,
    ctaMetadata,
    callToAction: modeCopy.callToAction || ctaMetadata.label,
    disclaimer:
      'Information is believed to be reliable but should be independently verified. Generated marketing content should be reviewed before public use.',
    source: 'fallback',
  };
}

function normalizeFlyerCustomizations(customizations = {}) {
  return {
    headline: customizations.headline?.trim() || '',
    subheadline: customizations.subheadline?.trim() || '',
    summary: customizations.summary?.trim() || '',
    callToAction: customizations.callToAction?.trim() || '',
    selectedPhotoAssetIds: (customizations.selectedPhotoAssetIds || []).filter(Boolean),
  };
}

const FLYER_COPY_SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          subheadline: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['subheadline', 'summary'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

function toShortText(value, maxLength, fallback = '') {
  const normalized = String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return '';
  }

  return normalized.slice(0, maxLength);
}

function buildPropertyLocationLine(property = {}) {
  return [property.addressLine1, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(', ');
}

function buildFallbackFlyerCopySuggestions({
  property,
  flyerType,
  headline,
  fallbackFlyer,
  count,
}) {
  const propertyTitle = toShortText(headline, 140, property?.title || 'This property');
  const location = buildPropertyLocationLine(property);
  const bedBathText = `${property?.bedrooms || '--'} bed / ${property?.bathrooms || '--'} bath`;
  const squareFeetText = property?.squareFeet ? `${property.squareFeet} sqft` : '';
  const inventoryContext = [bedBathText, squareFeetText].filter(Boolean).join(' • ');
  const listingContext = [location, inventoryContext].filter(Boolean).join(' • ');
  const listingSummary = listingContext ? ` ${listingContext}.` : '';
  const signalBundle = buildSignalBundle({ property, selectedPhotos: fallbackFlyer?.selectedPhotos || [] });
  const primarySignal = signalBundle.primarySignal.toLowerCase();
  const secondarySignal = signalBundle.secondarySignal ? ` ${signalBundle.secondarySignal}` : '';
  const urgencyLine = 'Early inquiries are currently prioritized for this listing.';

  const optionSet =
    flyerType === 'rental'
      ? [
          {
            subheadline: `Rental preview: ${signalBundle.subheadline}.`,
            summary: `${propertyTitle} emphasizes ${primarySignal}${secondarySignal}.${listingSummary} ${urgencyLine}`,
          },
          {
            subheadline: 'Practical rental layout with clear room sequencing.',
            summary: `${propertyTitle} positions renters around kitchen-to-living flow, cleaner room framing, and straightforward tour readiness.${listingSummary} Invite qualified renters to request full property details.`,
          },
          {
            subheadline: 'Tour-ready rental with clearer first-impression signals.',
            summary: `${propertyTitle} highlights actionable presentation strengths across key rooms and exterior touchpoints.${listingSummary} Keep messaging specific and direct: layout quality, light, and showing readiness.`,
          },
        ]
      : [
          {
            subheadline: `Listing preview: ${signalBundle.subheadline}.`,
            summary: `${propertyTitle} highlights ${primarySignal}${secondarySignal}.${listingSummary} ${urgencyLine}`,
          },
          {
            subheadline: 'Kitchen-to-living flow with cleaner buyer walk-through pacing.',
            summary: `${propertyTitle} focuses buyers on room-to-room clarity, stronger first-photo impact, and practical launch sequencing.${listingSummary} Use direct language tied to visible property signals.`,
          },
          {
            subheadline: 'Curb-first impression supported by practical interior presentation.',
            summary: `${propertyTitle} pairs exterior and interior signals to support clearer showing conversations.${listingSummary} End with a strong CTA: Request Showing or Get Property Details.`,
          },
        ];

  return optionSet.slice(0, count).map((option, index) => ({
    id: `fallback-${index + 1}`,
    subheadline: toShortText(option.subheadline, 220, fallbackFlyer?.subheadline || ''),
    summary: toShortText(option.summary, 600, fallbackFlyer?.summary || ''),
  }));
}

function normalizeFlyerCopySuggestions(rawSuggestions = [], fallbackSuggestions = []) {
  const normalized = rawSuggestions
    .filter(Boolean)
    .map((option, index) => ({
      id: `ai-${index + 1}`,
      subheadline: toShortText(
        option?.subheadline,
        220,
        fallbackSuggestions[index]?.subheadline || fallbackSuggestions[0]?.subheadline || '',
      ),
      summary: toShortText(
        option?.summary,
        600,
        fallbackSuggestions[index]?.summary || fallbackSuggestions[0]?.summary || '',
      ),
    }))
    .filter((option) => option.subheadline && option.summary);

  return normalized;
}

export async function suggestPropertyFlyerCopy({
  propertyId,
  flyerType = 'sale',
  headline = '',
  count = 3,
}) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const safeCount = Math.max(1, Math.min(5, Number(count) || 3));
  const pricing = await getLatestPricingAnalysis(propertyId);
  const fallbackFlyer = buildFallbackFlyer({
    property,
    pricing,
    flyerType,
    selectedPhotos: [],
  });
  const fallbackSuggestions = buildFallbackFlyerCopySuggestions({
    property,
    flyerType,
    headline,
    fallbackFlyer,
    count: safeCount,
  });

  if (!isOpenAiConfigured()) {
    return {
      suggestions: fallbackSuggestions,
      source: 'fallback',
    };
  }

  const promptPayload = {
    objective:
      'Generate high-quality brochure copy ideas for subheadline and summary that are fair-housing-safe, conversion-focused, and grounded in specific property signals.',
    flyerType,
    requestedSuggestionCount: safeCount,
    providedHeadline: toShortText(headline, 140, property?.title || ''),
    property: {
      title: property?.title || '',
      locationLine: buildPropertyLocationLine(property),
      propertyType: property?.propertyType || '',
      bedrooms: property?.bedrooms || null,
      bathrooms: property?.bathrooms || null,
      squareFeet: property?.squareFeet || null,
    },
    pricing: pricing
      ? {
          low: pricing.recommendedListLow || null,
          mid: pricing.recommendedListMid || null,
          high: pricing.recommendedListHigh || null,
          confidence: pricing.confidenceScore || null,
        }
      : null,
    constraints: {
      subheadlineMaxChars: 220,
      summaryMaxChars: 600,
      summaryStyle:
        '2-4 concise sentences using specific property details (layout, kitchen, light, exterior cues) without exaggerated claims or guaranteed outcomes.',
      avoid: [
        'fair housing violations',
        'guaranteed returns',
        'unverifiable superlatives',
        'all-caps promotional language',
        'comfortable and spacious',
        'beautiful home',
        'generic filler language',
      ],
    },
  };

  try {
    const aiResult = await generateStructuredJson({
      schemaName: 'flyer_copy_suggestions',
      schema: FLYER_COPY_SUGGESTIONS_SCHEMA,
      systemPrompt:
        'You are Workside Home Seller Assistant. Produce fair-housing-safe, seller-ready brochure copy ideas. Return only structured JSON that follows the schema.',
      userPrompt: JSON.stringify(promptPayload, null, 2),
    });

    const normalizedSuggestions = normalizeFlyerCopySuggestions(
      aiResult?.suggestions || [],
      fallbackSuggestions,
    ).slice(0, safeCount);

    if (!normalizedSuggestions.length) {
      return {
        suggestions: fallbackSuggestions,
        source: 'fallback',
      };
    }

    return {
      suggestions: normalizedSuggestions,
      source: 'openai',
    };
  } catch (error) {
    return {
      suggestions: fallbackSuggestions,
      source: 'fallback',
      warning: error.message,
    };
  }
}

export async function generatePropertyFlyer({
  propertyId,
  flyerType = 'sale',
  customizations = {},
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate flyers.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const [pricing, mediaAssets] = await Promise.all([
    getLatestPricingAnalysis(propertyId),
    listMediaAssets(propertyId),
  ]);

  const normalizedCustomizations = normalizeFlyerCustomizations(customizations);
  const assetIds = mediaAssets.map((asset) => asset.id).filter(Boolean);
  const brochureVariants = assetIds.length
    ? await MediaVariantModel.find({
        mediaId: { $in: assetIds },
        useInBrochure: true,
      })
        .sort({ createdAt: -1 })
        .lean()
    : [];
  const brochureVariantByAssetId = new Map();
  for (const variant of brochureVariants) {
    const mediaId = variant.mediaId?.toString?.() || String(variant.mediaId);
    if (!brochureVariantByAssetId.has(mediaId)) {
      brochureVariantByAssetId.set(mediaId, {
        ...variant,
        id: variant._id?.toString?.() || String(variant._id),
        imageUrl:
          variant.imageUrl ||
          buildMediaVariantUrl(variant._id?.toString?.() || String(variant._id)),
      });
    }
  }
  const selectedPhotos = chooseFlyerPhotos(
    mediaAssets,
    normalizedCustomizations.selectedPhotoAssetIds,
    brochureVariantByAssetId,
  );
  const signalBundle = buildSignalBundle({ property, selectedPhotos });
  const fallbackFlyer = buildFallbackFlyer({
    property,
    pricing,
    flyerType,
    selectedPhotos,
  });
  const modeCopy = buildFlyerModeCopy({
    flyerType,
    mode: fallbackFlyer.mode,
    propertyTitle: property.title,
    locationLine: fallbackFlyer.locationLine,
  });
  const baseCtaMetadata = buildFlyerCtaMetadata({
    flyerType,
    mode: fallbackFlyer.mode,
    propertyId,
  });
  const ctaMetadata = {
    ...baseCtaMetadata,
    ...(fallbackFlyer.ctaMetadata || {}),
    label:
      normalizedCustomizations.callToAction ||
      fallbackFlyer.ctaMetadata?.label ||
      baseCtaMetadata.label,
  };

  let marketing;
  try {
    marketing = await generateMarketingInsights({
      property,
      pricingAnalysis: pricing
        ? {
            pricing: {
              range: {
                low: pricing.recommendedListLow,
                mid: pricing.recommendedListMid,
                high: pricing.recommendedListHigh,
              },
              confidence: pricing.confidenceScore,
            },
          }
        : null,
    });
  } catch {
    marketing = null;
  }

  const flyerPayload = marketing
    ? {
        flyerType,
        mode: fallbackFlyer.mode,
        modeLabel: fallbackFlyer.modeLabel,
        readinessScore: fallbackFlyer.readinessScore,
        readinessSignals: fallbackFlyer.readinessSignals,
        headline:
          normalizedCustomizations.headline ||
          (fallbackFlyer.mode === 'preview' ? fallbackFlyer.headline : marketing.headline) ||
          fallbackFlyer.headline,
        subheadline:
          tightenFlyerText(
            normalizedCustomizations.subheadline ||
            (fallbackFlyer.mode === 'preview' ? fallbackFlyer.subheadline : marketing.shortDescription) ||
            fallbackFlyer.subheadline,
            signalBundle,
          ),
        priceText: buildPriceText(property, pricing, flyerType),
        locationLine: fallbackFlyer.locationLine,
        summary:
          tightenFlyerText(
            normalizedCustomizations.summary ||
            (fallbackFlyer.mode === 'preview' ? fallbackFlyer.summary : marketing.shortDescription) ||
            fallbackFlyer.summary,
            signalBundle,
          ),
        highlights: marketing.featureHighlights?.length
          ? marketing.featureHighlights.map((item) => tightenFlyerText(item, signalBundle))
          : fallbackFlyer.highlights,
        selectedPhotos,
        ctaMetadata,
        callToAction:
          normalizedCustomizations.callToAction || modeCopy.callToAction || fallbackFlyer.callToAction,
        disclaimer: marketing.disclaimer || fallbackFlyer.disclaimer,
        customizations: normalizedCustomizations,
        source: marketing.source || 'fallback',
        rawMarketing: marketing,
      }
    : {
        ...fallbackFlyer,
        ctaMetadata,
        headline: normalizedCustomizations.headline || fallbackFlyer.headline,
        subheadline: tightenFlyerText(normalizedCustomizations.subheadline || fallbackFlyer.subheadline, signalBundle),
        summary: tightenFlyerText(normalizedCustomizations.summary || fallbackFlyer.summary, signalBundle),
        callToAction:
          normalizedCustomizations.callToAction ||
          modeCopy.callToAction ||
          fallbackFlyer.callToAction,
        customizations: normalizedCustomizations,
        rawMarketing: null,
      };

  const document = await FlyerModel.create({
    propertyId,
    ...flyerPayload,
  });

  return serializeFlyer(document.toObject());
}

export async function getLatestPropertyFlyer(propertyId, flyerType) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const filter = flyerType ? { propertyId, flyerType } : { propertyId };
  const flyer = await FlyerModel.findOne(filter).sort({ createdAt: -1 }).lean();
  return serializeFlyer(flyer);
}

async function renderFallbackMarketingFlyerPdf({ property, flyer, filename }) {
  const pdfDoc = await PDFDocument.create();
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const colors = createPdfPalette();
  const page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  const selectedPhotos = (flyer.selectedPhotos || []).slice(0, 4);
  const embeddedPhotos = await Promise.all(
    selectedPhotos.map((photo) => fetchPdfImage(pdfDoc, photo?.imageUrl)),
  );

  drawDocumentFrame(page, colors);
  drawBrandHeader(page, { headingFont, bodyFont }, {
    title: flyer.headline || property.title || 'Marketing Report',
    subtitle: flyer.locationLine || [property.addressLine1, property.city, property.state, property.zip].filter(Boolean).join(', '),
    pageNumber: 1,
    totalPages: 1,
    colors,
  });

  const galleryX = PDF_PAGE_MARGIN;
  const galleryY = 430;
  const galleryWidth = PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2;
  const galleryHeight = 210;
  const gridGap = 8;
  const photoCount = embeddedPhotos.length;

  if (photoCount >= 4) {
    const cellWidth = (galleryWidth - gridGap) / 2;
    const cellHeight = (galleryHeight - gridGap) / 2;
    drawContainedImageFrame(page, embeddedPhotos[0], {
      x: galleryX,
      y: galleryY + cellHeight + gridGap,
      width: cellWidth,
      height: cellHeight,
      colors,
    });
    drawContainedImageFrame(page, embeddedPhotos[1], {
      x: galleryX + cellWidth + gridGap,
      y: galleryY + cellHeight + gridGap,
      width: cellWidth,
      height: cellHeight,
      colors,
    });
    drawContainedImageFrame(page, embeddedPhotos[2], {
      x: galleryX,
      y: galleryY,
      width: cellWidth,
      height: cellHeight,
      colors,
    });
    drawContainedImageFrame(page, embeddedPhotos[3], {
      x: galleryX + cellWidth + gridGap,
      y: galleryY,
      width: cellWidth,
      height: cellHeight,
      colors,
    });
  } else if (photoCount === 3) {
    const largeWidth = Math.max(220, Math.floor((galleryWidth - gridGap) * 0.62));
    const stackWidth = galleryWidth - largeWidth - gridGap;
    const stackHeight = (galleryHeight - gridGap) / 2;
    drawContainedImageFrame(page, embeddedPhotos[0], {
      x: galleryX,
      y: galleryY,
      width: largeWidth,
      height: galleryHeight,
      colors,
    });
    drawContainedImageFrame(page, embeddedPhotos[1], {
      x: galleryX + largeWidth + gridGap,
      y: galleryY + stackHeight + gridGap,
      width: stackWidth,
      height: stackHeight,
      colors,
    });
    drawContainedImageFrame(page, embeddedPhotos[2], {
      x: galleryX + largeWidth + gridGap,
      y: galleryY,
      width: stackWidth,
      height: stackHeight,
      colors,
    });
  } else if (photoCount === 2) {
    const cellWidth = (galleryWidth - gridGap) / 2;
    drawContainedImageFrame(page, embeddedPhotos[0], {
      x: galleryX,
      y: galleryY,
      width: cellWidth,
      height: galleryHeight,
      colors,
    });
    drawContainedImageFrame(page, embeddedPhotos[1], {
      x: galleryX + cellWidth + gridGap,
      y: galleryY,
      width: cellWidth,
      height: galleryHeight,
      colors,
    });
  } else {
    drawContainedImageFrame(page, embeddedPhotos[0] || null, {
      x: galleryX,
      y: galleryY,
      width: galleryWidth,
      height: galleryHeight,
      colors,
    });
  }

  drawMetricCard(page, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 332,
    width: 160,
    label: 'List price',
    value: flyer.priceText || 'Pricing on request',
    colors,
    tone: 'accent',
  });
  drawMetricCard(page, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN + 176,
    y: 332,
    width: 160,
    label: 'Home details',
    value: `${property?.bedrooms || '--'} bd • ${property?.bathrooms || '--'} ba`,
    supportText: [
      property?.squareFeet ? `${property.squareFeet} sqft` : '',
      flyer?.modeLabel ? `${flyer.modeLabel} mode` : '',
    ].filter(Boolean).join(' · '),
    colors,
  });
  drawMetricCard(page, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN + 352,
    y: 332,
    width: 176,
    label: 'Call to action',
    value: '',
    colors,
    tone: 'moss',
  });
  const ctaCardX = PDF_PAGE_MARGIN + 352;
  const ctaCardY = 332;
  const ctaCardWidth = 176;
  const ctaText = flyer.callToAction || flyer?.ctaMetadata?.label || 'Request Showing';
  const ctaLines = wrapText(ctaText, 20);
  const ctaVisibleLines = ctaLines.slice(0, 3);
  if (ctaLines.length > ctaVisibleLines.length && ctaVisibleLines.length) {
    const lastLineIndex = ctaVisibleLines.length - 1;
    ctaVisibleLines[lastLineIndex] = `${ctaVisibleLines[lastLineIndex].slice(0, 18).trimEnd()}…`;
  }

  let ctaCursorY = ctaCardY + 38;
  for (const line of ctaVisibleLines) {
    page.drawText(line, {
      x: ctaCardX + 14,
      y: ctaCursorY,
      size: 12,
      font: headingFont,
      color: colors.ink,
      maxWidth: ctaCardWidth - 24,
    });
    ctaCursorY -= 13;
  }

  drawSectionEyebrow(page, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 306,
    text: 'Marketing Summary',
    colors,
  });
  drawWrappedText(page, bodyFont, flyer.summary || 'Marketing summary unavailable.', {
    x: PDF_PAGE_MARGIN,
    y: 286,
    size: 12,
    color: colors.muted,
    maxChars: 88,
    lineHeight: 17,
  });

  drawSectionEyebrow(page, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 180,
    text: 'Highlights',
    colors,
  });
  drawBulletList(page, bodyFont, flyer.highlights || [], {
    x: PDF_PAGE_MARGIN,
    y: 160,
    size: 11,
    color: colors.muted,
    maxChars: 82,
    limit: 6,
    gap: 5,
  });

  drawDocumentFooter(page, { headingFont, bodyFont }, {
    colors,
    footerNote: 'Fallback marketing PDF generated because the full browser renderer was unavailable in the current backend environment.',
  });

  return {
    bytes: await pdfDoc.save(),
    filename,
  };
}

export async function exportPropertyFlyerPdf({ propertyId, flyerType = 'sale' }) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const flyer =
    (await getLatestPropertyFlyer(propertyId, flyerType)) ||
    (await generatePropertyFlyer({ propertyId, flyerType }));
  const filename = `${sanitizeFilePart(property.title, 'property')}-${sanitizeFilePart(
    flyer.flyerType,
    'flyer',
  )}.pdf`;
  let bytes;
  try {
    ({ bytes } = await renderMarketingReportPdf({
      property,
      flyer,
      filename,
    }));
  } catch (error) {
    const renderFailureMessage = error?.message || String(error);
    console.warn(
      `Marketing brochure browser render failed${
        env.NODE_ENV === 'production' ? ' in production' : ''
      }; using pdf-lib fallback export.`,
      renderFailureMessage,
    );
    ({ bytes } = await renderFallbackMarketingFlyerPdf({
      property,
      flyer,
      filename,
    }));
  }

  return {
    bytes,
    filename,
    flyer,
  };
}
