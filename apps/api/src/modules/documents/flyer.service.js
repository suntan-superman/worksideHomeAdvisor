import mongoose from 'mongoose';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { formatCurrency } from '@workside/utils';

import { generateMarketingInsights } from '../../services/aiWorkflowService.js';
import { buildMediaVariantUrl } from '../../services/storageService.js';
import { listMediaAssets } from '../media/media.service.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { FlyerModel } from './flyer.model.js';
import { renderMarketingReportPdf } from './html-pdf.service.js';
import {
  createPdfPalette,
  drawBrandHeader,
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
  return [...(assets || [])].sort((left, right) => {
    if (Boolean(left.listingCandidate) !== Boolean(right.listingCandidate)) {
      return left.listingCandidate ? -1 : 1;
    }

    return (
      Number(right.analysis?.overallQualityScore || 0) -
      Number(left.analysis?.overallQualityScore || 0)
    );
  });
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

      return {
        assetId: asset.id,
        roomLabel: asset.roomLabel,
        imageUrl: selectedVariant?.imageUrl || asset.imageUrl || asset.imageDataUrl || null,
        score: asset.analysis?.overallQualityScore || null,
        listingCandidate: Boolean(asset.listingCandidate),
        listingNote: asset.listingNote || '',
        usesPreferredVariant: Boolean(selectedVariant),
        variantLabel: selectedVariant?.label || '',
        variantType: selectedVariant?.variantType || '',
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
    console.warn('Falling back to pdf-lib marketing export:', error?.message || error);
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
