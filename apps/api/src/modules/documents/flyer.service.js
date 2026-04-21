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
} from './pdf-theme.js';

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
  const requestedPhotoIds = (selectedPhotoAssetIds || []).filter(Boolean);
  const manualSelection = requestedPhotoIds.length
    ? requestedPhotoIds
        .map((assetId) => rankedAssets.find((asset) => asset.id === assetId))
        .filter(Boolean)
    : [];
  const fallbackSelection = rankedAssets.filter(
    (asset) => !manualSelection.some((selectedAsset) => selectedAsset.id === asset.id),
  );

  return [...manualSelection, ...fallbackSelection]
    .slice(0, 4)
    .map((asset) => {
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
    });
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

function buildFallbackFlyer({ property, pricing, flyerType, selectedPhotos }) {
  return {
    flyerType,
    headline: property.title,
    subheadline:
      flyerType === 'rental'
        ? 'A move-in-ready rental opportunity with strong everyday livability.'
        : 'A seller-ready home with pricing, presentation, and prep guidance already in motion.',
    priceText: buildPriceText(property, pricing, flyerType),
    locationLine: `${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`,
    summary:
      flyerType === 'rental'
        ? 'This home offers a practical layout, strong curb appeal, and a set of features that should market well to qualified renters.'
        : 'This home combines a practical layout, neighborhood alignment, and seller-ready prep opportunities that support a confident launch.',
    highlights: [
      `${property.bedrooms || '--'} bedrooms`,
      `${property.bathrooms || '--'} bathrooms`,
      `${property.squareFeet || '--'} square feet`,
      property.propertyType || 'single family',
    ],
    selectedPhotos,
    callToAction:
      flyerType === 'rental'
        ? 'Schedule a tour or request rental details.'
        : 'Schedule a showing or request the full property package.',
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

  const optionSet =
    flyerType === 'rental'
      ? [
          {
            subheadline: 'Move-in-ready rental with bright everyday flow.',
            summary: `${propertyTitle} stands out as a practical rental option with balanced room flow and strong natural light.${listingSummary} Position this as a clean, well-kept home suited for qualified renters seeking comfort and convenience.`,
          },
          {
            subheadline: 'Comfort-first layout with strong renter appeal.',
            summary: `Frame ${propertyTitle} as a rental that combines usable square footage, approachable styling, and dependable day-to-day livability.${listingSummary} Keep the narrative focused on ease, functionality, and immediate move-in readiness.`,
          },
          {
            subheadline: 'A polished rental opportunity ready for tours.',
            summary: `Present ${propertyTitle} as a rental listing that shows clean presentation, practical space planning, and a welcoming tone.${listingSummary} Emphasize clear photos, simple positioning, and a direct invitation to request rental details.`,
          },
        ]
      : [
          {
            subheadline: 'Seller-ready positioning with market-friendly presentation.',
            summary: `${propertyTitle} is presented as a move-in-ready home with strong everyday livability and a clear path to market confidence.${listingSummary} Highlight the balanced layout, clean visual presentation, and practical value story for qualified buyers.`,
          },
          {
            subheadline: 'Practical layout, polished visuals, and listing momentum.',
            summary: `Position ${propertyTitle} as a well-prepared listing that blends functionality with buyer-friendly presentation.${listingSummary} Focus the copy on clean rooms, strong light, and a straightforward value narrative that supports showing activity.`,
          },
          {
            subheadline: 'Confident listing story built around comfort and flow.',
            summary: `Frame ${propertyTitle} as a home that already presents well and can launch with confidence.${listingSummary} Use the brochure to spotlight livable space, clear condition cues, and the next step for buyers to schedule a showing.`,
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
      'Generate high-quality brochure copy ideas for subheadline and summary that are fair-housing-safe and practical for residential marketing.',
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
        '2-4 concise sentences, clear and market-ready without exaggerated claims or guaranteed outcomes.',
      avoid: [
        'fair housing violations',
        'guaranteed returns',
        'unverifiable superlatives',
        'all-caps promotional language',
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
  const fallbackFlyer = buildFallbackFlyer({
    property,
    pricing,
    flyerType,
    selectedPhotos,
  });

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
        headline:
          normalizedCustomizations.headline || marketing.headline || fallbackFlyer.headline,
        subheadline:
          normalizedCustomizations.subheadline ||
          marketing.shortDescription ||
          fallbackFlyer.subheadline,
        priceText: buildPriceText(property, pricing, flyerType),
        locationLine: fallbackFlyer.locationLine,
        summary:
          normalizedCustomizations.summary ||
          marketing.shortDescription ||
          fallbackFlyer.summary,
        highlights: marketing.featureHighlights?.length
          ? marketing.featureHighlights
          : fallbackFlyer.highlights,
        selectedPhotos,
        callToAction:
          normalizedCustomizations.callToAction || fallbackFlyer.callToAction,
        disclaimer: marketing.disclaimer || fallbackFlyer.disclaimer,
        customizations: normalizedCustomizations,
        source: marketing.source || 'fallback',
        rawMarketing: marketing,
      }
    : {
        ...fallbackFlyer,
        headline: normalizedCustomizations.headline || fallbackFlyer.headline,
        subheadline: normalizedCustomizations.subheadline || fallbackFlyer.subheadline,
        summary: normalizedCustomizations.summary || fallbackFlyer.summary,
        callToAction: normalizedCustomizations.callToAction || fallbackFlyer.callToAction,
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
  const heroPhoto = await fetchPdfImage(pdfDoc, flyer.selectedPhotos?.[0]?.imageUrl);

  drawDocumentFrame(page, colors);
  drawBrandHeader(page, { headingFont, bodyFont }, {
    title: flyer.headline || property.title || 'Marketing Report',
    subtitle: flyer.locationLine || [property.addressLine1, property.city, property.state, property.zip].filter(Boolean).join(', '),
    pageNumber: 1,
    totalPages: 1,
    colors,
  });

  drawContainedImageFrame(page, heroPhoto, {
    x: PDF_PAGE_MARGIN,
    y: 430,
    width: PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2,
    height: 210,
    colors,
  });

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
    supportText: property?.squareFeet ? `${property.squareFeet} sqft` : '',
    colors,
  });
  drawMetricCard(page, { headingFont, bodyFont }, {
    x: PDF_PAGE_MARGIN + 352,
    y: 332,
    width: 176,
    label: 'Call to action',
    value: flyer.callToAction || 'Schedule a showing',
    colors,
    tone: 'moss',
  });

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
