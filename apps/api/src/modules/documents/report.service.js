import mongoose from 'mongoose';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { formatCurrency } from '@workside/utils';

import { env } from '../../config/env.js';
import { generateImprovementInsights, generateMarketingInsights } from '../../services/aiWorkflowService.js';
import { buildMediaVariantUrl } from '../../services/storageService.js';
import { buildVariantStoryBlock } from '../media/media-ai.service.js';
import { listMediaAssets } from '../media/media.service.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { listProvidersForProperty } from '../providers/providers.service.js';
import { getOrCreatePropertyChecklist } from '../tasks/tasks.service.js';
import { getLatestPropertyFlyer } from './flyer.service.js';
import { renderPropertySummaryPdf } from './html-pdf.service.js';
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
  PDF_PAGE_HEIGHT,
  PDF_PAGE_MARGIN,
  sanitizeFilePart,
} from './pdf-theme.js';
import { ReportModel } from './report.model.js';

const CORE_ROOM_LABELS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const REPORT_SECTION_LABELS = {
  executive_summary: 'Executive Summary',
  property_details: 'Property Details',
  pricing_analysis: 'Pricing Analysis',
  comparable_properties: 'Comparable Properties',
  photo_review: 'Photo Review Summary',
  visual_improvement_previews: 'Visual Improvement Previews',
  readiness_score: 'Listing Readiness Score',
  improvement_recommendations: 'Improvement Recommendations',
  provider_recommendations: 'Provider Recommendations',
  risk_opportunity: 'Risk and Opportunity',
  next_steps: 'Next Steps',
  seller_checklist: 'Seller Checklist',
  marketing_guidance: 'Marketing Guidance',
  draft_listing_description: 'Draft Listing Description',
};
const DEFAULT_REPORT_SECTION_IDS = Object.keys(REPORT_SECTION_LABELS);

function serializeReport(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    reportType: document.reportType,
    status: document.status || 'completed',
    reportVersion: Number(document.reportVersion || 1),
    title: document.title,
    executiveSummary: document.executiveSummary,
    pricingSummary: document.pricingSummary || {},
    selectedComps: document.selectedComps || [],
    selectedPhotos: document.selectedPhotos || [],
    checklistItems: document.checklistItems || [],
    improvementItems: document.improvementItems || [],
    marketingHighlights: document.marketingHighlights || [],
    freshness: document.payload?.freshness || null,
    customizations: document.customizations || document.payload?.customizations || {},
    disclaimer: document.disclaimer,
    source: document.source || 'system',
    payload: document.payload || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function normalizeDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function sortPhotosForReport(assets) {
  return [...(assets || [])].sort((left, right) => {
    if (Boolean(left.listingCandidate) !== Boolean(right.listingCandidate)) {
      return left.listingCandidate ? -1 : 1;
    }

    return Number(right.analysis?.overallQualityScore || 0) - Number(left.analysis?.overallQualityScore || 0);
  });
}

function selectReportPhotos(assets) {
  return sortPhotosForReport(assets).slice(0, 4).map((asset) => {
    const selectedVariant = asset.selectedVariant || null;

    return {
      assetId: asset.id,
      roomLabel: asset.roomLabel,
      imageUrl: selectedVariant?.imageUrl || asset.imageUrl || null,
      score: asset.analysis?.overallQualityScore || null,
      listingCandidate: Boolean(asset.listingCandidate),
      listingNote: asset.listingNote || '',
      usesPreferredVariant: Boolean(selectedVariant),
      variantLabel: selectedVariant?.label || '',
      variantType: selectedVariant?.variantType || '',
    };
  });
}

function chooseReportPhotos(
  assets,
  selectedPhotoAssetIds = [],
  reportVariantByAssetId = new Map(),
) {
  const rankedAssets = sortPhotosForReport(assets);
  const requestedPhotoIds = (selectedPhotoAssetIds || []).filter(Boolean);
  const manualSelection = requestedPhotoIds.length
    ? requestedPhotoIds
        .map((assetId) => rankedAssets.find((asset) => asset.id === assetId))
        .filter(Boolean)
    : [];
  const fallbackSelection = rankedAssets.filter(
    (asset) => !manualSelection.some((selectedAsset) => selectedAsset.id === asset.id),
  );

  return [...manualSelection, ...fallbackSelection].slice(0, 4).map((asset) => {
    const selectedVariant =
      reportVariantByAssetId.get(asset.id) || asset.selectedVariant || null;

    return {
      assetId: asset.id,
      roomLabel: asset.roomLabel,
      imageUrl: selectedVariant?.imageUrl || asset.imageUrl || null,
      score: asset.analysis?.overallQualityScore || null,
      listingCandidate: Boolean(asset.listingCandidate),
      listingNote: asset.listingNote || '',
      usesPreferredVariant: Boolean(selectedVariant),
      variantLabel: selectedVariant?.label || '',
      variantType: selectedVariant?.variantType || '',
    };
  });
}

function buildPhotoSummary(mediaAssets, selectedPhotos) {
  const scoredAssets = mediaAssets.filter((asset) => typeof asset.analysis?.overallQualityScore === 'number');
  const coveredRooms = CORE_ROOM_LABELS.filter((roomLabel) => mediaAssets.some((asset) => asset.roomLabel === roomLabel));
  const missingRooms = CORE_ROOM_LABELS.filter((roomLabel) => !coveredRooms.includes(roomLabel));
  const preferredVariantCount = mediaAssets.filter((asset) => asset.selectedVariant).length;
  const selectedPreferredVariantCount = selectedPhotos.filter((photo) => photo.usesPreferredVariant).length;

  return {
    totalPhotos: mediaAssets.length,
    listingCandidateCount: mediaAssets.filter((asset) => asset.listingCandidate).length,
    selectedPhotoCount: selectedPhotos.length,
    preferredVariantCount,
    selectedPreferredVariantCount,
    retakeCount: mediaAssets.filter((asset) => asset.analysis?.retakeRecommended).length,
    averageQualityScore: scoredAssets.length
      ? Math.round(scoredAssets.reduce((sum, asset) => sum + Number(asset.analysis?.overallQualityScore || 0), 0) / scoredAssets.length)
      : 0,
    roomCoverageCount: coveredRooms.length,
    missingRooms,
    summary: mediaAssets.length
      ? `${selectedPhotos.length} top report photo${selectedPhotos.length === 1 ? '' : 's'} selected, including ${selectedPreferredVariantCount} preferred vision variant${selectedPreferredVariantCount === 1 ? '' : 's'}. ${coveredRooms.length}/${CORE_ROOM_LABELS.length} core rooms covered. ${mediaAssets.filter((asset) => asset.analysis?.retakeRecommended).length} retake recommendation${mediaAssets.filter((asset) => asset.analysis?.retakeRecommended).length === 1 ? '' : 's'} remaining.`
      : 'No saved property photos are available yet for a richer listing-ready photo review.',
  };
}

function buildReadinessSummary({ pricing, checklist, photoSummary, flyer }) {
  const pricingConfidenceScore = pricing?.confidenceScore ? Math.round(pricing.confidenceScore * 100) : 25;
  const photoQualityScore = photoSummary.averageQualityScore || 35;
  const roomCoverageScore = Math.round((photoSummary.roomCoverageCount / CORE_ROOM_LABELS.length) * 100);
  const taskCompletionScore = checklist?.summary?.progressPercent || 0;
  const marketingReadinessScore = Math.min(
    100,
    (photoSummary.listingCandidateCount >= 3 ? 70 : photoSummary.listingCandidateCount * 20) + (flyer ? 30 : 0),
  );
  const overallScore = Math.round(
    (pricingConfidenceScore + photoQualityScore + roomCoverageScore + taskCompletionScore + marketingReadinessScore) / 5,
  );

  return {
    overallScore,
    label: overallScore >= 80 ? 'Listing Ready' : overallScore >= 60 ? 'Almost Ready' : 'Needs Work',
    pricingConfidenceScore,
    photoQualityScore,
    roomCoverageScore,
    taskCompletionScore,
    marketingReadinessScore,
  };
}

function buildSourceSnapshot({ property, pricing, mediaAssets, checklist, flyer, customizations }) {
  const mediaUpdatedAt = mediaAssets.reduce((latest, asset) => {
    const timestamp = normalizeDate(asset.updatedAt || asset.createdAt);
    return !timestamp || (latest && latest > timestamp) ? latest : timestamp;
  }, null);
  const variantUpdatedAt = mediaAssets.reduce((latest, asset) => {
    const timestamp = normalizeDate(
      asset.selectedVariant?.updatedAt || asset.selectedVariant?.createdAt,
    );
    return !timestamp || (latest && latest > timestamp) ? latest : timestamp;
  }, null);

  return {
    propertyUpdatedAt: normalizeDate(property?.updatedAt || property?.createdAt),
    pricingUpdatedAt: normalizeDate(pricing?.updatedAt || pricing?.createdAt),
    mediaUpdatedAt,
    mediaCount: mediaAssets.length,
    listingCandidateCount: mediaAssets.filter((asset) => asset.listingCandidate).length,
    selectedVariantCount: mediaAssets.filter((asset) => asset.selectedVariant).length,
    variantUpdatedAt,
    checklistUpdatedAt: normalizeDate(checklist?.updatedAt || checklist?.createdAt),
    checklistProgress: checklist?.summary?.progressPercent || 0,
    flyerUpdatedAt: normalizeDate(flyer?.updatedAt || flyer?.createdAt),
    customizations: customizations || null,
  };
}

function compareSourceSnapshots(saved = {}, current = {}) {
  const staleReasons = [];

  if (saved.pricingUpdatedAt && current.pricingUpdatedAt && saved.pricingUpdatedAt !== current.pricingUpdatedAt) {
    staleReasons.push('Pricing analysis changed after this report was generated.');
  }

  if (
    saved.mediaUpdatedAt !== current.mediaUpdatedAt ||
    Number(saved.mediaCount || 0) !== Number(current.mediaCount || 0) ||
    Number(saved.listingCandidateCount || 0) !== Number(current.listingCandidateCount || 0) ||
    Number(saved.selectedVariantCount || 0) !== Number(current.selectedVariantCount || 0) ||
    saved.variantUpdatedAt !== current.variantUpdatedAt
  ) {
    staleReasons.push('Property media or selected listing photos changed after this report was generated.');
  }

  if (
    saved.checklistUpdatedAt !== current.checklistUpdatedAt ||
    Number(saved.checklistProgress || 0) !== Number(current.checklistProgress || 0)
  ) {
    staleReasons.push('Checklist progress changed after this report was generated.');
  }

  if (
    JSON.stringify(saved.customizations || null) !==
    JSON.stringify(current.customizations || null)
  ) {
    staleReasons.push('Report builder selections changed after this report was generated.');
  }

  return staleReasons;
}

function buildListingDescriptions({ property, marketingGuidance, pricing, readinessSummary }) {
  const shortDescription =
    marketingGuidance?.shortDescription ||
    `${property.title} combines livability, presentation upside, and a clearer path to market.`;
  const chosenPriceText = property?.selectedListPrice
    ? `Selected list price is ${formatCurrency(property.selectedListPrice)}.`
    : pricing?.recommendedListMid
      ? `Positioned around ${formatCurrency(pricing.recommendedListMid)}.`
      : 'Pricing guidance is included in this report.';

  return {
    shortDescription,
    longDescription: [
      shortDescription,
      chosenPriceText,
      `${readinessSummary.label} with an overall readiness score of ${readinessSummary.overallScore}/100.`,
      `Highlight ${(marketingGuidance?.featureHighlights || []).slice(0, 3).join(', ') || 'the strongest presentation features'} in listing materials.`,
    ].join(' '),
  };
}

function buildPropertyDetails(property, marketingHighlights = []) {
  const featureTags = [
    property?.propertyType,
    property?.bedrooms ? `${property.bedrooms} bedrooms` : '',
    property?.bathrooms ? `${property.bathrooms} bathrooms` : '',
    property?.squareFeet ? `${property.squareFeet} sqft` : '',
    property?.lotSizeSqFt ? `${property.lotSizeSqFt} lot sqft` : '',
    property?.yearBuilt ? `Built ${property.yearBuilt}` : '',
    ...(marketingHighlights || []).slice(0, 4),
  ].filter(Boolean);

  return {
    bedrooms: property?.bedrooms || null,
    bathrooms: property?.bathrooms || null,
    squareFeet: property?.squareFeet || null,
    lotSizeSqFt: property?.lotSizeSqFt || null,
    yearBuilt: property?.yearBuilt || null,
    propertyType: property?.propertyType || '',
    featureTags: [...new Set(featureTags)].slice(0, 6),
  };
}

function buildImprovementEconomics({ property, improvementItems = [], photoSummary, checklist }) {
  const budgetCeiling = Number(property?.sellerProfile?.budgetMax || 0);
  const openChecklistCount = Number(checklist?.summary?.openCount || 0);
  const retakeCount = Number(photoSummary?.retakeCount || 0);
  const roughImprovementCount = Math.max(1, improvementItems.length || openChecklistCount || retakeCount || 1);
  const estimatedCost =
    budgetCeiling > 0
      ? Math.round(Math.min(budgetCeiling, Math.max(600, roughImprovementCount * 350)))
      : Math.round(Math.max(750, roughImprovementCount * 425));
  const estimatedRoi =
    estimatedCost > 0 ? Math.round(estimatedCost * 1.6) : 0;

  return {
    estimatedCost,
    estimatedRoi,
    summary:
      estimatedCost > 0
        ? `A focused pre-listing investment of about ${formatCurrency(estimatedCost)} could support roughly ${formatCurrency(estimatedRoi)} in presentation-driven value protection or upside.`
        : 'Improvement economics are directional only and should be reviewed before committing budget.',
  };
}

function buildRiskOpportunitySummary({ pricing, photoSummary, improvementItems = [], checklist }) {
  const biggestRisk = photoSummary?.retakeCount
    ? `${photoSummary.retakeCount} photo retake recommendation${photoSummary.retakeCount === 1 ? '' : 's'} still need attention before launch.`
    : pricing?.risks?.[0] || 'The launch plan still needs review before going to market.';
  const biggestOpportunity =
    improvementItems[0] ||
    checklist?.nextTask?.title ||
    pricing?.strengths?.[0] ||
    'Tighten presentation and pricing alignment before publishing the listing.';

  return {
    biggestRisk,
    biggestOpportunity,
    narrative: `Primary risk: ${biggestRisk} Primary opportunity: ${biggestOpportunity}`,
  };
}

function buildBuyerPersonaSummary({ property, marketingGuidance, pricing }) {
  const buyerPersona = property?.bedrooms >= 3
    ? 'Move-up household seeking functional space, natural light, and a turnkey-feeling home.'
    : 'Efficiency-focused buyer looking for a clean, well-positioned home with manageable prep requirements.';

  const topReasonsToBuy = [
    ...(marketingGuidance?.featureHighlights || []),
    pricing?.strengths?.[0] || '',
    property?.squareFeet ? `${property.squareFeet} square feet with a practical layout.` : '',
  ]
    .filter(Boolean)
    .slice(0, 5);

  return {
    buyerPersona,
    topReasonsToBuy,
  };
}

function buildNextStepPlan({ checklist, improvementItems = [], providerRecommendations = [], photoSummary }) {
  const openChecklistItems = (checklist?.items || [])
    .filter((item) => item.status !== 'done')
    .slice(0, 3)
    .map((item, index) => ({
      order: index + 1,
      title: item.title,
      eta: item.status === 'in_progress' ? '1-2 days' : '2-4 days',
      owner: item.ownerRole || 'seller',
    }));

  const providerSteps = providerRecommendations.slice(0, 2).map((provider, index) => ({
    order: openChecklistItems.length + index + 1,
    title: `Contact ${provider.businessName}`,
    eta: 'Same day',
    owner: 'seller',
  }));

  const fallbackSteps = improvementItems.slice(0, 2).map((title, index) => ({
    order: openChecklistItems.length + providerSteps.length + index + 1,
    title,
    eta: photoSummary?.retakeCount ? '2-5 days' : '1-3 days',
    owner: 'seller',
  }));

  return [...openChecklistItems, ...providerSteps, ...fallbackSteps].slice(0, 5);
}

async function buildProviderRecommendations(propertyId) {
  const recommendationConfigs = [
    {
      categoryKey: 'photographer',
      reason: 'Use for final listing photography and cleaner hero images.',
    },
    {
      categoryKey: 'cleaning_service',
      reason: 'Useful before photography, brochure generation, and early showings.',
    },
    {
      categoryKey: 'staging_company',
      reason: 'Helpful when key rooms still need stronger presentation and buyer clarity.',
    },
  ];

  const results = await Promise.all(
    recommendationConfigs.map(async (config) => {
      try {
        const result = await listProvidersForProperty(propertyId, {
          categoryKey: config.categoryKey,
          limit: 2,
          includeExternal: false,
        });
        return { config, result };
      } catch {
        return { config, result: null };
      }
    }),
  );

  return results
    .flatMap(({ config, result }) =>
      (result?.items || []).slice(0, 1).map((provider) => ({
        categoryKey: config.categoryKey,
        categoryLabel: result?.source?.categoryLabel || provider.categoryKey,
        businessName: provider.businessName,
        coverageLabel: provider.coverageLabel || '',
        phone: provider.phone || '',
        email: provider.email || '',
        ratingLabel: provider.qualityScore ? `${provider.qualityScore}/100 Workside score` : '',
        turnaroundLabel: provider.turnaroundLabel || '',
        pricingSummary: provider.pricingSummary || '',
        reason: config.reason,
      })),
    )
    .slice(0, 3);
}

function normalizeReportCustomizations(customizations = {}) {
  const includedSections = (customizations.includedSections || []).filter(
    (sectionId) => REPORT_SECTION_LABELS[sectionId],
  );

  return {
    title: customizations.title?.trim() || '',
    executiveSummary: customizations.executiveSummary?.trim() || '',
    listingDescription: customizations.listingDescription?.trim() || '',
    selectedPhotoAssetIds: (customizations.selectedPhotoAssetIds || []).filter(Boolean),
    includedSections: includedSections.length ? includedSections : DEFAULT_REPORT_SECTION_IDS,
  };
}

function buildExecutiveSummary({ property, pricing, photoSummary, checklist, readinessSummary, strongestOpportunity, biggestRisk }) {
  return [
    `${property.title} is currently rated ${readinessSummary.label.toLowerCase()} at ${readinessSummary.overallScore}/100.`,
    property?.selectedListPrice
      ? `Selected list price is ${formatCurrency(property.selectedListPrice)}. Recommended pricing confidence remains ${Math.round((pricing?.confidenceScore || 0) * 100)}%.`
      : pricing?.recommendedListMid
        ? `Pricing centers around ${formatCurrency(pricing.recommendedListMid)} with ${Math.round((pricing.confidenceScore || 0) * 100)}% confidence.`
        : 'Pricing still needs a fresh analysis.',
    photoSummary.summary,
    checklist?.summary?.totalCount
      ? `${checklist.summary.completedCount} of ${checklist.summary.totalCount} checklist items are complete.`
      : 'Checklist guidance is included for launch planning.',
    strongestOpportunity ? `Top opportunity: ${strongestOpportunity}.` : 'There is room to strengthen launch readiness.',
    biggestRisk ? `Top risk: ${biggestRisk}.` : 'No single launch risk currently dominates the report.',
  ].join(' ');
}

function buildVisionStoryBlocks({
  mediaAssets,
  selectedPhotos,
  reportVariantByAssetId,
}) {
  const assetById = new Map((mediaAssets || []).map((asset) => [asset.id, asset]));
  const selectedPhotoIds = new Set((selectedPhotos || []).map((photo) => photo.assetId).filter(Boolean));
  const variantPool = [];
  const seenVariantIds = new Set();

  for (const [assetId, variant] of reportVariantByAssetId.entries()) {
    if (!variant?.id || seenVariantIds.has(variant.id)) {
      continue;
    }
    seenVariantIds.add(variant.id);
    variantPool.push({
      asset: assetById.get(assetId) || null,
      variant,
      selected: selectedPhotoIds.has(assetId),
    });
  }

  for (const asset of mediaAssets || []) {
    if (!asset?.selectedVariant?.id || seenVariantIds.has(asset.selectedVariant.id)) {
      continue;
    }

    seenVariantIds.add(asset.selectedVariant.id);
    variantPool.push({
      asset,
      variant: asset.selectedVariant,
      selected: selectedPhotoIds.has(asset.id),
    });
  }

  return variantPool
    .sort((left, right) => {
      if (Boolean(left.selected) !== Boolean(right.selected)) {
        return left.selected ? -1 : 1;
      }
      if (left.variant?.variantCategory !== right.variant?.variantCategory) {
        return left.variant?.variantCategory === 'concept_preview' ? -1 : 1;
      }
      const leftScore = Number(left.variant?.metadata?.review?.overallScore || 0);
      const rightScore = Number(right.variant?.metadata?.review?.overallScore || 0);
      return rightScore - leftScore;
    })
    .slice(0, 3)
    .map(({ asset, variant }) => buildVariantStoryBlock({ asset, variant }));
}

async function buildReportPayload({
  property,
  propertyId,
  pricing,
  mediaAssets,
  flyer,
  checklist,
  marketingGuidance,
  improvementGuidance,
  sourceSnapshot,
  customizations,
  reportVariantByAssetId,
}) {
  const selectedPhotos = chooseReportPhotos(
    mediaAssets,
    customizations.selectedPhotoAssetIds,
    reportVariantByAssetId,
  );
  const photoSummary = buildPhotoSummary(mediaAssets, selectedPhotos);
  const readinessSummary = buildReadinessSummary({ pricing, checklist, photoSummary, flyer });
  const listingDescriptions = buildListingDescriptions({
    property,
    marketingGuidance,
    pricing,
    readinessSummary,
  });
  const improvementItems = improvementGuidance?.recommendations?.length
    ? improvementGuidance.recommendations.slice(0, 5).map((item) => item.title)
    : (checklist?.items || []).filter((item) => item.status !== 'done').slice(0, 5).map((item) => item.title);
  const checklistItems = (checklist?.items || []).map((item) => item.title);
  const marketingHighlights = marketingGuidance?.featureHighlights?.length
    ? marketingGuidance.featureHighlights
    : flyer?.highlights || [];
  const selectedComps = (pricing?.selectedComps || []).slice(0, 5).map((comp) => ({
    address: comp.address,
    price: comp.price,
    beds: comp.beds,
    baths: comp.baths,
    sqft: comp.sqft,
    distanceMiles: comp.distanceMiles,
    score: comp.score,
  }));
  const generatedAt = new Date().toISOString();
  const strongestOpportunity = improvementItems[0] || checklist?.nextTask?.title || null;
  const biggestRisk = photoSummary.retakeCount
    ? `${photoSummary.retakeCount} photo retake recommendation${photoSummary.retakeCount === 1 ? '' : 's'} remain`
    : pricing?.risks?.[0] || null;
  const includedSectionSet = new Set(customizations.includedSections);
  const customizedListingDescriptions = {
    ...listingDescriptions,
    shortDescription:
      customizations.listingDescription || listingDescriptions.shortDescription,
  };
  const sectionOutline = customizations.includedSections.map(
    (sectionId) => REPORT_SECTION_LABELS[sectionId],
  );
  const propertyDetails = buildPropertyDetails(property, marketingHighlights);
  const providerRecommendations = includedSectionSet.has('provider_recommendations')
    ? await buildProviderRecommendations(propertyId)
    : [];
  const improvementEconomics = buildImprovementEconomics({
    property,
    improvementItems,
    photoSummary,
    checklist,
  });
  const riskOpportunity = buildRiskOpportunitySummary({
    pricing,
    photoSummary,
    improvementItems,
    checklist,
  });
  const buyerPersonaSummary = buildBuyerPersonaSummary({
    property,
    marketingGuidance,
    pricing,
  });
  const nextSteps = buildNextStepPlan({
    checklist,
    improvementItems,
    providerRecommendations,
    photoSummary,
  });
  const visionStoryBlocks = includedSectionSet.has('visual_improvement_previews')
    ? buildVisionStoryBlocks({
        mediaAssets,
        selectedPhotos,
        reportVariantByAssetId,
      })
    : [];

  return {
    reportType: 'seller_intelligence_report',
    status: 'completed',
    reportVersion: 3,
    title: customizations.title || `${property.title} Seller Intelligence Report`,
    executiveSummary:
      customizations.executiveSummary ||
      buildExecutiveSummary({
        property,
        pricing,
        photoSummary,
        checklist,
        readinessSummary,
        strongestOpportunity,
        biggestRisk,
      }),
    pricingSummary: includedSectionSet.has('pricing_analysis')
      ? {
          selectedListPrice: property?.selectedListPrice || null,
          selectedListPriceSource: property?.selectedListPriceSource || '',
          low: pricing?.recommendedListLow || null,
          mid: pricing?.recommendedListMid || null,
          high: pricing?.recommendedListHigh || null,
          confidence: pricing?.confidenceScore || null,
          narrative: pricing?.summary || '',
          strategy: pricing?.pricingStrategy || '',
          strengths: pricing?.strengths || [],
          risks: pricing?.risks || [],
        }
      : {},
    selectedComps: includedSectionSet.has('comparable_properties') ? selectedComps : [],
    selectedPhotos: includedSectionSet.has('photo_review') ? selectedPhotos : [],
    checklistItems: includedSectionSet.has('seller_checklist') ? checklistItems : [],
    improvementItems: includedSectionSet.has('improvement_recommendations')
      ? improvementItems
      : [],
    marketingHighlights: includedSectionSet.has('marketing_guidance')
      ? marketingHighlights
      : [],
    disclaimer:
      'This report is informational only. Pricing is not an appraisal, provider guidance is not a guarantee, and AI-generated outputs should be independently reviewed before use.',
    customizations,
    payload: {
      generatedAt,
      customizations,
      property: {
        title: property.title,
        addressLine1: property.addressLine1,
        city: property.city,
        state: property.state,
        zip: property.zip,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: property.squareFeet,
        lotSizeSqFt: property.lotSizeSqFt,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
      },
      propertyDetails: includedSectionSet.has('property_details') ? propertyDetails : null,
      sectionOutline,
      checklistSummary: includedSectionSet.has('seller_checklist')
        ? checklist?.summary || null
        : null,
      nextTask: includedSectionSet.has('seller_checklist') ? checklist?.nextTask || null : null,
      photoSummary: includedSectionSet.has('photo_review') ? photoSummary : null,
      visionStoryBlocks,
      readinessSummary: includedSectionSet.has('readiness_score')
        ? readinessSummary
        : null,
      providerRecommendations: includedSectionSet.has('provider_recommendations')
        ? providerRecommendations
        : [],
      riskOpportunity: includedSectionSet.has('risk_opportunity')
        ? riskOpportunity
        : null,
      nextSteps: includedSectionSet.has('next_steps')
        ? nextSteps
        : [],
      improvementEconomics: includedSectionSet.has('improvement_recommendations')
        ? improvementEconomics
        : null,
      buyerPersonaSummary: includedSectionSet.has('marketing_guidance')
        ? buyerPersonaSummary
        : null,
      marketingGuidance: includedSectionSet.has('marketing_guidance')
        ? {
            headline: marketingGuidance?.headline || flyer?.headline || property.title,
            shortDescription:
              marketingGuidance?.shortDescription ||
              flyer?.summary ||
              customizedListingDescriptions.shortDescription,
            featureHighlights: marketingHighlights,
            photoSuggestions: marketingGuidance?.photoSuggestions || [],
            buyerPersona: buyerPersonaSummary.buyerPersona,
            topReasonsToBuy: buyerPersonaSummary.topReasonsToBuy,
          }
        : null,
      improvementGuidance: includedSectionSet.has('improvement_recommendations')
        ? {
            summary:
              improvementGuidance?.summary ||
              'Complete the remaining checklist and photo recommendations before launch.',
            recommendations: improvementGuidance?.recommendations || [],
          }
        : null,
      listingDescriptions: includedSectionSet.has('draft_listing_description')
        ? customizedListingDescriptions
        : null,
      sourceSnapshot,
      freshness: {
        isStale: false,
        staleReasons: [],
        generatedAt,
        comparedAt: generatedAt,
        sourceSnapshot,
      },
    },
  };
}

function attachFreshness(report, sourceSnapshot) {
  const staleReasons = compareSourceSnapshots(report?.payload?.sourceSnapshot || {}, sourceSnapshot);
  const freshness = {
    isStale: staleReasons.length > 0,
    staleReasons,
    generatedAt: report?.payload?.generatedAt || report?.createdAt || null,
    comparedAt: new Date().toISOString(),
    sourceSnapshot,
  };

  return {
    ...report,
    freshness,
    payload: {
      ...(report?.payload || {}),
      freshness,
    },
  };
}

export async function getPropertyReportInputSignature(propertyId, customizations = {}) {
  const [property, pricing, mediaAssets, checklist, flyer] = await Promise.all([
    getPropertyById(propertyId),
    getLatestPricingAnalysis(propertyId),
    listMediaAssets(propertyId),
    getOrCreatePropertyChecklist(propertyId),
    getLatestPropertyFlyer(propertyId),
  ]);

  if (!property) {
    throw new Error('Property not found.');
  }

  return buildSourceSnapshot({
    property,
    pricing,
    mediaAssets,
    checklist,
    flyer,
    customizations: normalizeReportCustomizations(customizations),
  });
}

export async function generatePropertyReport({ propertyId, customizations = {} }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate reports.');
  }

  const [property, pricing, mediaAssets, flyer, checklist] = await Promise.all([
    getPropertyById(propertyId),
    getLatestPricingAnalysis(propertyId),
    listMediaAssets(propertyId),
    getLatestPropertyFlyer(propertyId),
    getOrCreatePropertyChecklist(propertyId),
  ]);

  if (!property) {
    throw new Error('Property not found.');
  }

  const normalizedCustomizations = normalizeReportCustomizations(customizations);
  const assetIds = mediaAssets.map((asset) => asset.id).filter(Boolean);
  const reportVariants = assetIds.length
    ? await MediaVariantModel.find({
        mediaId: { $in: assetIds },
        useInReport: true,
      })
        .sort({ createdAt: -1 })
        .lean()
    : [];
  const reportVariantByAssetId = new Map();
  for (const variant of reportVariants) {
    const mediaId = variant.mediaId?.toString?.() || String(variant.mediaId);
    if (!reportVariantByAssetId.has(mediaId)) {
      reportVariantByAssetId.set(mediaId, {
        ...variant,
        id: variant._id?.toString?.() || String(variant._id),
        imageUrl:
          variant.imageUrl ||
          buildMediaVariantUrl(variant._id?.toString?.() || String(variant._id)),
      });
    }
  }

  const simplifiedMedia = mediaAssets.map((asset) => ({
    roomLabel: asset.roomLabel,
    listingCandidate: asset.listingCandidate,
    listingNote: asset.listingNote,
    analysis: asset.analysis,
  }));

  const [marketingGuidance, improvementGuidance] = await Promise.all([
    generateMarketingInsights({
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
    }),
    generateImprovementInsights({
      property,
      rooms: simplifiedMedia.map((asset) => asset.roomLabel).filter(Boolean),
      budget: property?.sellerProfile?.budgetMax || 5000,
      media: simplifiedMedia,
    }),
  ]);

  const sourceSnapshot = buildSourceSnapshot({
    property,
    pricing,
    mediaAssets,
    checklist,
    flyer,
    customizations: normalizedCustomizations,
  });

  const reportPayload = await buildReportPayload({
    property,
    propertyId,
    pricing,
    mediaAssets,
    flyer,
    checklist,
    marketingGuidance,
    improvementGuidance,
    sourceSnapshot,
    customizations: normalizedCustomizations,
    reportVariantByAssetId,
  });

  const document = await ReportModel.create({
    propertyId,
    ...reportPayload,
    source: marketingGuidance?.source || improvementGuidance?.source || flyer?.source || pricing?.source || 'system',
  });

  return serializeReport(document.toObject());
}

export async function getLatestPropertyReport(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const report = await ReportModel.findOne({ propertyId }).sort({ createdAt: -1 }).lean();
  const serialized = serializeReport(report);

  if (!serialized) {
    return null;
  }

  const sourceSnapshot = await getPropertyReportInputSignature(
    propertyId,
    serialized.customizations || {},
  );
  return attachFreshness(serialized, sourceSnapshot);
}

function buildComparableMapImageUrl(property, comps = []) {
  if (!env.GOOGLE_MAPS_SERVER_API_KEY || !property) {
    return '';
  }

  const propertyQuery = [
    property.addressLine1,
    property.city,
    property.state,
    property.zip,
  ]
    .filter(Boolean)
    .join(', ');
  if (!propertyQuery) {
    return '';
  }

  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_API_KEY);
  url.searchParams.set('size', '1200x760');
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.append('markers', `color:0xc87447|label:S|${propertyQuery}`);
  url.searchParams.append('visible', propertyQuery);

  comps.slice(0, 5).forEach((comp, index) => {
    if (!comp?.address) {
      return;
    }

    const label = String.fromCharCode(65 + index);
    url.searchParams.append('markers', `color:0x4f7b62|label:${label}|${comp.address}`);
    url.searchParams.append('visible', comp.address);
  });

  return url.toString();
}

async function renderFallbackPropertyReportPdf({ property, report, filename }) {
  const pdfDoc = await PDFDocument.create();
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const colors = createPdfPalette();
  const heroPhoto = await fetchPdfImage(pdfDoc, report.selectedPhotos?.[0]?.imageUrl);
  const compMapImage = await fetchPdfImage(
    pdfDoc,
    buildComparableMapImageUrl(property, report.selectedComps || []),
  );
  const pageOne = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  const pageTwo = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);

  drawDocumentFrame(pageOne, colors);
  drawBrandHeader(pageOne, { headingFont, bodyFont }, {
    title: report.title || `${property.title} Seller Intelligence Report`,
    subtitle: [property.addressLine1, property.city, property.state, property.zip].filter(Boolean).join(', '),
    pageNumber: 1,
    totalPages: 2,
    colors,
  });

  drawSectionEyebrow(pageOne, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 646,
    text: 'Executive Summary',
    colors,
  });
  drawWrappedText(pageOne, bodyFont, report.executiveSummary || 'Seller intelligence summary unavailable.', {
    x: PDF_PAGE_MARGIN,
    y: 624,
    size: 12,
    color: colors.muted,
    maxChars: 88,
    lineHeight: 17,
  });

  drawMetricCard(pageOne, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 494,
    width: 160,
    label: 'Suggested range',
    value:
      report.pricingSummary?.low && report.pricingSummary?.high
        ? `${formatCurrency(report.pricingSummary.low)} - ${formatCurrency(report.pricingSummary.high)}`
        : 'Unavailable',
    colors,
  });
  drawMetricCard(pageOne, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN + 176,
    y: 494,
    width: 160,
    label: 'Chosen price',
    value: property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set',
    colors,
  });
  drawMetricCard(pageOne, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN + 352,
    y: 494,
    width: 176,
    label: 'Readiness',
    value: `${report.payload?.readinessSummary?.overallScore || 0}/100`,
    supportText: report.payload?.readinessSummary?.label || 'Needs work',
    colors,
    tone: 'moss',
  });

  drawContainedImageFrame(pageOne, heroPhoto, {
    x: PDF_PAGE_MARGIN,
    y: 250,
    width: 250,
    height: 210,
    colors,
  });
  drawContainedImageFrame(pageOne, compMapImage, {
    x: PDF_PAGE_MARGIN + 266,
    y: 250,
    width: 264,
    height: 210,
    colors,
  });

  drawSectionEyebrow(pageOne, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 222,
    text: 'Next Steps',
    colors,
  });
  drawBulletList(
    pageOne,
    bodyFont,
    report.payload?.nextSteps?.length
      ? report.payload.nextSteps.map((step) => `${step.title} (${step.eta}, ${step.owner})`)
      : report.improvementItems || [],
    {
      x: PDF_PAGE_MARGIN,
      y: 202,
      size: 11,
      color: colors.muted,
      maxChars: 84,
      limit: 5,
      gap: 5,
    },
  );

  drawDocumentFooter(pageOne, { headingFont, bodyFont }, {
    colors,
    footerNote: 'Fallback PDF generated because the full browser renderer was unavailable in the current backend environment.',
  });

  drawDocumentFrame(pageTwo, colors);
  drawBrandHeader(pageTwo, { headingFont, bodyFont }, {
    title: 'Comparable Properties and Recommendations',
    subtitle: 'A simplified export generated from the latest saved report data.',
    pageNumber: 2,
    totalPages: 2,
    colors,
  });

  drawSectionEyebrow(pageTwo, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: 646,
    text: 'Comparable Properties',
    colors,
  });
  let compCursorY = 624;
  const compRows = (report.selectedComps || []).slice(0, 5);
  if (!compRows.length) {
    drawWrappedText(pageTwo, bodyFont, 'No comparable properties were available in the saved report.', {
      x: PDF_PAGE_MARGIN,
      y: compCursorY,
      size: 11,
      color: colors.muted,
      maxChars: 88,
      lineHeight: 15,
    });
    compCursorY -= 24;
  } else {
    for (const comp of compRows) {
      pageTwo.drawRectangle({
        x: PDF_PAGE_MARGIN,
        y: compCursorY - 44,
        width: PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2,
        height: 52,
        color: colors.white,
        borderColor: colors.line,
        borderWidth: 1,
      });
      pageTwo.drawText(comp.address || 'Comparable property', {
        x: PDF_PAGE_MARGIN + 12,
        y: compCursorY - 16,
        size: 11,
        font: headingFont,
        color: colors.ink,
      });
      pageTwo.drawText(comp.price ? formatCurrency(comp.price) : 'Price unavailable', {
        x: PDF_PAGE_MARGIN + 12,
        y: compCursorY - 32,
        size: 10,
        font: bodyFont,
        color: colors.muted,
      });
      pageTwo.drawText(
        `${comp.beds || '--'} bd • ${comp.baths || '--'} ba • ${comp.sqft || '--'} sqft • ${Number(comp.distanceMiles || 0).toFixed(2)} mi`,
        {
          x: PDF_PAGE_MARGIN + 220,
          y: compCursorY - 32,
          size: 10,
          font: bodyFont,
          color: colors.muted,
        },
      );
      compCursorY -= 64;
    }
  }

  drawSectionEyebrow(pageTwo, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN,
    y: Math.max(300, compCursorY - 10),
    text: 'Provider Recommendations',
    colors,
  });
  drawBulletList(
    pageTwo,
    bodyFont,
    (report.payload?.providerRecommendations || []).length
      ? report.payload.providerRecommendations.map(
          (provider) =>
            `${provider.businessName}${provider.categoryLabel ? ` (${provider.categoryLabel})` : ''}${provider.coverageLabel ? ` - ${provider.coverageLabel}` : ''}`,
        )
      : ['No internal provider recommendations were available in this report.'],
    {
      x: PDF_PAGE_MARGIN,
      y: Math.max(280, compCursorY - 30),
      size: 11,
      color: colors.muted,
      maxChars: 84,
      limit: 5,
      gap: 5,
    },
  );

  drawDocumentFooter(pageTwo, { headingFont, bodyFont }, {
    colors,
    footerNote: 'Workside Home Advisor seller intelligence fallback export.',
  });

  return {
    bytes: await pdfDoc.save(),
    filename,
  };
}

export async function exportPropertyReportPdf({ propertyId }) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const report =
    (await getLatestPropertyReport(propertyId)) ||
    (await generatePropertyReport({ propertyId }));
  const filename = `${sanitizeFilePart(property.title, 'property')}-seller-report.pdf`;
  let bytes;
  try {
    ({ bytes } = await renderPropertySummaryPdf({
      property,
      report,
      filename,
    }));
  } catch (error) {
    console.warn('Falling back to pdf-lib seller report export:', error?.message || error);
    ({ bytes } = await renderFallbackPropertyReportPdf({
      property,
      report,
      filename,
    }));
  }

  return {
    bytes,
    filename,
    report,
  };
}
