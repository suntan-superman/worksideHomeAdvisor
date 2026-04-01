import mongoose from 'mongoose';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCurrency } from '@workside/utils';

import { generateImprovementInsights, generateMarketingInsights } from '../../services/aiWorkflowService.js';
import { buildMediaVariantUrl } from '../../services/storageService.js';
import { buildVariantStoryBlock } from '../media/media-ai.service.js';
import { listMediaAssets } from '../media/media.service.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { getOrCreatePropertyChecklist } from '../tasks/tasks.service.js';
import { getLatestPropertyFlyer } from './flyer.service.js';
import { ReportModel } from './report.model.js';

const CORE_ROOM_LABELS = ['Living room', 'Kitchen', 'Primary bedroom', 'Bathroom', 'Exterior'];
const REPORT_SECTION_LABELS = {
  executive_summary: 'Executive Summary',
  pricing_analysis: 'Pricing Analysis',
  comparable_properties: 'Comparable Properties',
  photo_review: 'Photo Review Summary',
  visual_improvement_previews: 'Visual Improvement Previews',
  readiness_score: 'Listing Readiness Score',
  improvement_recommendations: 'Improvement Recommendations',
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

function buildReportPayload({
  property,
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
    reportVersion: 2,
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
        propertyType: property.propertyType,
      },
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
      marketingGuidance: includedSectionSet.has('marketing_guidance')
        ? {
            headline: marketingGuidance?.headline || flyer?.headline || property.title,
            shortDescription:
              marketingGuidance?.shortDescription ||
              flyer?.summary ||
              customizedListingDescriptions.shortDescription,
            featureHighlights: marketingHighlights,
            photoSuggestions: marketingGuidance?.photoSuggestions || [],
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

  const reportPayload = buildReportPayload({
    property,
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

function wrapText(text, maxChars = 84) {
  if (!text) {
    return [];
  }

  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function drawWrappedText(page, font, text, options) {
  const { x, y, size = 12, color = rgb(0, 0, 0), lineHeight = size * 1.5, maxChars = 84 } = options;
  let cursorY = y;

  for (const line of wrapText(text, maxChars)) {
    page.drawText(line, {
      x,
      y: cursorY,
      size,
      font,
      color,
    });
    cursorY -= lineHeight;
  }

  return cursorY;
}

async function fetchPdfImage(pdfDoc, imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    const isPng =
      contentType.includes('png') ||
      imageUrl.toLowerCase().includes('.png') ||
      (bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47);
    const isJpeg =
      contentType.includes('jpeg') ||
      contentType.includes('jpg') ||
      imageUrl.toLowerCase().includes('.jpg') ||
      imageUrl.toLowerCase().includes('.jpeg') ||
      (bytes[0] === 0xff && bytes[1] === 0xd8);

    if (isPng) {
      return pdfDoc.embedPng(bytes);
    }

    if (isJpeg) {
      return pdfDoc.embedJpg(bytes);
    }

    const convertedBytes = await sharp(bytes).png().toBuffer();
    return pdfDoc.embedPng(convertedBytes);
  } catch {
    return null;
  }
}

function drawBulletList(page, font, items, options) {
  const { x, y, size = 11, color = rgb(0, 0, 0), maxChars = 42, limit = items.length } = options;
  let cursor = y;

  for (const item of items.slice(0, limit)) {
    cursor = drawWrappedText(page, font, `- ${item}`, {
      x,
      y: cursor,
      size,
      color,
      maxChars,
      lineHeight: size * 1.4,
    }) - 6;
  }

  return cursor;
}

function sanitizeFilePart(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export async function exportPropertyReportPdf({ propertyId }) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const report = (await getLatestPropertyReport(propertyId)) || (await generatePropertyReport({ propertyId }));
  const pdfDoc = await PDFDocument.create();
  const coverPage = pdfDoc.addPage([612, 792]);
  const detailPage = pdfDoc.addPage([612, 792]);
  const visionStoryBlocks = report.payload?.visionStoryBlocks || [];
  const visionPage = visionStoryBlocks.length ? pdfDoc.addPage([612, 792]) : null;
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const colors = {
    ink: rgb(0.1, 0.13, 0.17),
    muted: rgb(0.36, 0.41, 0.38),
    clay: rgb(0.78, 0.45, 0.28),
    moss: rgb(0.27, 0.39, 0.31),
    panel: rgb(0.98, 0.95, 0.91),
    line: rgb(0.87, 0.82, 0.75),
    sky: rgb(0.91, 0.95, 0.99),
  };

  const heroPhoto = report.selectedPhotos?.[0] || null;
  const embeddedHero = heroPhoto?.imageUrl ? await fetchPdfImage(pdfDoc, heroPhoto.imageUrl) : null;
  const readinessSummary = report.payload?.readinessSummary || {};
  const photoSummary = report.payload?.photoSummary || {};

  for (const page of [coverPage, detailPage, visionPage].filter(Boolean)) {
    page.drawRectangle({
      x: 30,
      y: 30,
      width: 552,
      height: 732,
      color: colors.panel,
      borderColor: colors.line,
      borderWidth: 1,
    });
  }

  coverPage.drawText('WORKSIDE SELLER INTELLIGENCE REPORT', {
    x: 54,
    y: 732,
    size: 11,
    font: headingFont,
    color: colors.moss,
  });
  coverPage.drawText(report.title, {
    x: 54,
    y: 690,
    size: 24,
    font: headingFont,
    color: colors.ink,
    maxWidth: 340,
  });

  let coverCursor = drawWrappedText(coverPage, bodyFont, report.executiveSummary, {
    x: 54,
    y: 636,
    size: 12,
    color: colors.muted,
    maxChars: 52,
    lineHeight: 18,
  });

  coverPage.drawText(`${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`, {
    x: 54,
    y: coverCursor - 18,
    size: 12,
    font: bodyFont,
    color: colors.ink,
    maxWidth: 300,
  });

  coverPage.drawRectangle({
    x: 54,
    y: 462,
    width: 250,
    height: 84,
    color: colors.sky,
    borderColor: colors.line,
    borderWidth: 1,
  });
  coverPage.drawText('READINESS SCORE', {
    x: 72,
    y: 516,
    size: 10,
    font: headingFont,
    color: colors.moss,
  });
  coverPage.drawText(`${readinessSummary.overallScore || 0}/100`, {
    x: 72,
    y: 486,
    size: 24,
    font: headingFont,
    color: colors.ink,
  });
  coverPage.drawText(readinessSummary.label || 'Needs Work', {
    x: 170,
    y: 492,
    size: 14,
    font: headingFont,
    color: colors.clay,
  });

  if (embeddedHero) {
    const frame = { x: 370, y: 436, width: 160, height: 220 };
    const dims = embeddedHero.scale(1);
    const ratio = Math.min(frame.width / dims.width, frame.height / dims.height);
    const width = dims.width * ratio;
    const height = dims.height * ratio;

    coverPage.drawRectangle({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      color: rgb(1, 1, 1),
      borderColor: colors.line,
      borderWidth: 1,
    });
    coverPage.drawImage(embeddedHero, {
      x: frame.x + (frame.width - width) / 2,
      y: frame.y + (frame.height - height) / 2,
      width,
      height,
    });
  }

  coverPage.drawText('REPORT OUTLINE', {
    x: 54,
    y: 412,
    size: 11,
    font: headingFont,
    color: colors.moss,
  });
  drawBulletList(coverPage, bodyFont, report.payload?.sectionOutline || [], {
    x: 60,
    y: 388,
    size: 10,
    color: colors.ink,
    maxChars: 40,
    limit: 8,
  });

  detailPage.drawText('REPORT SNAPSHOT', {
    x: 54,
    y: 732,
    size: 12,
    font: headingFont,
    color: colors.moss,
  });

  let detailCursor = 700;
  detailPage.drawText('Pricing Narrative', {
    x: 54,
    y: detailCursor,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  detailCursor = drawWrappedText(detailPage, bodyFont, report.pricingSummary?.narrative || 'No pricing narrative is currently stored.', {
    x: 54,
    y: detailCursor - 22,
    size: 11,
    color: colors.muted,
    maxChars: 42,
    lineHeight: 16,
  });

  detailPage.drawText('Photo Summary', {
    x: 54,
    y: detailCursor - 10,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  detailCursor = drawBulletList(detailPage, bodyFont, [
    photoSummary.summary || 'No photo summary available.',
    `${photoSummary.totalPhotos || 0} uploaded photo(s)`,
    `${photoSummary.listingCandidateCount || 0} listing candidate photo(s)`,
    `${photoSummary.selectedPreferredVariantCount || 0} preferred vision variant(s) in the report set`,
    `${photoSummary.missingRooms?.length || 0} core room(s) still missing`,
  ], {
    x: 60,
    y: detailCursor - 34,
    size: 10,
    color: colors.ink,
    maxChars: 42,
    limit: 5,
  });

  detailPage.drawText('Checklist + Improvements', {
    x: 54,
    y: detailCursor - 10,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  drawBulletList(detailPage, bodyFont, [...(report.checklistItems || []).slice(0, 3), ...(report.improvementItems || []).slice(0, 2)], {
    x: 60,
    y: detailCursor - 34,
    size: 10,
    color: colors.ink,
    maxChars: 42,
    limit: 5,
  });

  detailPage.drawText('Selected Comps', {
    x: 330,
    y: 700,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  let compCursor = 676;
  for (const comp of report.selectedComps.slice(0, 4)) {
    compCursor = drawWrappedText(detailPage, bodyFont, `${comp.address || 'Comparable property'} - ${formatCurrency(comp.price || 0)} - ${(comp.distanceMiles || 0).toFixed(2)} mi`, {
      x: 330,
      y: compCursor,
      size: 10,
      color: colors.ink,
      maxChars: 34,
      lineHeight: 14,
    }) - 6;
  }

  detailPage.drawText('Marketing Guidance', {
    x: 330,
    y: compCursor - 10,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  drawWrappedText(detailPage, bodyFont, report.payload?.marketingGuidance?.shortDescription || report.payload?.listingDescriptions?.shortDescription || '', {
    x: 330,
    y: compCursor - 34,
    size: 10,
    color: colors.muted,
    maxChars: 34,
    lineHeight: 14,
  });

  drawWrappedText(detailPage, bodyFont, report.disclaimer, {
    x: 54,
    y: 82,
    size: 9,
    color: colors.muted,
    maxChars: 94,
    lineHeight: 12,
  });

  if (visionPage) {
    visionPage.drawText('VISUAL IMPROVEMENT PREVIEWS', {
      x: 54,
      y: 732,
      size: 12,
      font: headingFont,
      color: colors.moss,
    });

    let storyCursor = 696;
    for (const storyBlock of visionStoryBlocks.slice(0, 2)) {
      const embeddedOriginal = await fetchPdfImage(pdfDoc, storyBlock.originalImageUrl);
      const embeddedVariant = await fetchPdfImage(pdfDoc, storyBlock.variantImageUrl);
      visionPage.drawText(storyBlock.title || 'Visual Preview', {
        x: 54,
        y: storyCursor,
        size: 14,
        font: headingFont,
        color: colors.ink,
      });

      const imageTop = storyCursor - 22;
      const imageFrame = { width: 120, height: 92 };
      const drawImageInFrame = (embeddedImage, x, y) => {
        visionPage.drawRectangle({
          x,
          y,
          width: imageFrame.width,
          height: imageFrame.height,
          color: rgb(1, 1, 1),
          borderColor: colors.line,
          borderWidth: 1,
        });

        if (!embeddedImage) {
          return;
        }

        const dims = embeddedImage.scale(1);
        const ratio = Math.min(imageFrame.width / dims.width, imageFrame.height / dims.height);
        const width = dims.width * ratio;
        const height = dims.height * ratio;
        visionPage.drawImage(embeddedImage, {
          x: x + (imageFrame.width - width) / 2,
          y: y + (imageFrame.height - height) / 2,
          width,
          height,
        });
      };

      drawImageInFrame(embeddedOriginal, 54, imageTop - imageFrame.height);
      drawImageInFrame(embeddedVariant, 190, imageTop - imageFrame.height);
      visionPage.drawText('Before', {
        x: 54,
        y: imageTop + 4,
        size: 9,
        font: headingFont,
        color: colors.moss,
      });
      visionPage.drawText('After', {
        x: 190,
        y: imageTop + 4,
        size: 9,
        font: headingFont,
        color: colors.clay,
      });

      let copyCursor = drawWrappedText(visionPage, bodyFont, `What changed: ${storyBlock.whatChanged}`, {
        x: 334,
        y: storyCursor - 2,
        size: 10,
        color: colors.ink,
        maxChars: 34,
        lineHeight: 14,
      }) - 4;
      copyCursor = drawWrappedText(visionPage, bodyFont, `Why it matters: ${storyBlock.whyItMatters}`, {
        x: 334,
        y: copyCursor,
        size: 10,
        color: colors.muted,
        maxChars: 34,
        lineHeight: 14,
      }) - 4;
      copyCursor = drawWrappedText(visionPage, bodyFont, `Suggested action: ${storyBlock.suggestedAction}`, {
        x: 334,
        y: copyCursor,
        size: 10,
        color: colors.ink,
        maxChars: 34,
        lineHeight: 14,
      }) - 4;
      drawWrappedText(visionPage, bodyFont, storyBlock.disclaimer, {
        x: 334,
        y: copyCursor,
        size: 9,
        color: colors.muted,
        maxChars: 34,
        lineHeight: 12,
      });

      storyCursor -= 280;
    }
  }

  const bytes = await pdfDoc.save();
  return {
    bytes,
    filename: `${sanitizeFilePart(property.title, 'property')}-seller-report.pdf`,
    report,
  };
}
