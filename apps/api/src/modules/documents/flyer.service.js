import mongoose from 'mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCurrency } from '@workside/utils';

import { generateMarketingInsights } from '../../services/aiWorkflowService.js';
import { listMediaAssets } from '../media/media.service.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { FlyerModel } from './flyer.model.js';

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

function chooseFlyerPhotos(assets, selectedPhotoAssetIds = []) {
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
      const selectedVariant = asset.selectedVariant || null;

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

function buildPriceText(pricing, flyerType) {
  if (flyerType === 'rental') {
    return 'Contact for rental pricing';
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
    priceText: buildPriceText(pricing, flyerType),
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
  const selectedPhotos = chooseFlyerPhotos(
    mediaAssets,
    normalizedCustomizations.selectedPhotoAssetIds,
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
        priceText: buildPriceText(pricing, flyerType),
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

function sanitizeFilePart(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function wrapText(text, maxChars = 86) {
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
  const {
    x,
    y,
    size = 12,
    color = rgb(0, 0, 0),
    lineHeight = size * 1.45,
    maxChars = 86,
  } = options;

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

    if (contentType.includes('png') || imageUrl.toLowerCase().includes('.png')) {
      return pdfDoc.embedPng(bytes);
    }

    return pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function exportPropertyFlyerPdf({ propertyId, flyerType = 'sale' }) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const flyer =
    (await getLatestPropertyFlyer(propertyId, flyerType)) ||
    (await generatePropertyFlyer({ propertyId, flyerType }));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const colors = {
    ink: rgb(0.1, 0.13, 0.17),
    muted: rgb(0.36, 0.41, 0.38),
    clay: rgb(0.78, 0.45, 0.28),
    moss: rgb(0.27, 0.39, 0.31),
    panel: rgb(0.98, 0.95, 0.91),
    line: rgb(0.87, 0.82, 0.75),
  };

  page.drawRectangle({
    x: 30,
    y: 30,
    width: 552,
    height: 732,
    color: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
  });

  page.drawText('WORKSIDE HOME SELLER ASSISTANT', {
    x: 54,
    y: 730,
    size: 10,
    font: headingFont,
    color: colors.moss,
  });

  page.drawText(flyer.headline, {
    x: 54,
    y: 692,
    size: 24,
    font: headingFont,
    color: colors.ink,
    maxWidth: 350,
  });

  let textCursor = drawWrappedText(page, bodyFont, flyer.subheadline, {
    x: 54,
    y: 664,
    size: 12,
    color: colors.muted,
    maxChars: 56,
  });

  page.drawRectangle({
    x: 54,
    y: 565,
    width: 224,
    height: 70,
    color: rgb(1, 1, 1),
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  });
  page.drawText('PRICE', {
    x: 72,
    y: 615,
    size: 10,
    font: headingFont,
    color: colors.moss,
  });
  page.drawText(flyer.priceText, {
    x: 72,
    y: 588,
    size: 18,
    font: headingFont,
    color: colors.ink,
    maxWidth: 188,
  });

  page.drawRectangle({
    x: 292,
    y: 565,
    width: 236,
    height: 70,
    color: rgb(1, 1, 1),
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  });
  page.drawText('LOCATION', {
    x: 310,
    y: 615,
    size: 10,
    font: headingFont,
    color: colors.moss,
  });
  drawWrappedText(page, bodyFont, flyer.locationLine, {
    x: 310,
    y: 594,
    size: 11,
    color: colors.ink,
    maxChars: 34,
    lineHeight: 14,
  });

  page.drawText('PROPERTY HIGHLIGHTS', {
    x: 54,
    y: 528,
    size: 11,
    font: headingFont,
    color: colors.moss,
  });

  let highlightY = 505;
  for (const item of (flyer.highlights || []).slice(0, 6)) {
    page.drawText(`• ${item}`, {
      x: 62,
      y: highlightY,
      size: 12,
      font: bodyFont,
      color: colors.ink,
    });
    highlightY -= 18;
  }

  page.drawText('SUMMARY', {
    x: 54,
    y: 382,
    size: 11,
    font: headingFont,
    color: colors.moss,
  });
  textCursor = drawWrappedText(page, bodyFont, flyer.summary, {
    x: 54,
    y: 360,
    size: 12,
    color: colors.ink,
    maxChars: 84,
    lineHeight: 18,
  });

  page.drawText('NEXT STEP', {
    x: 54,
    y: textCursor - 10,
    size: 11,
    font: headingFont,
    color: colors.moss,
  });
  textCursor = drawWrappedText(page, bodyFont, flyer.callToAction, {
    x: 54,
    y: textCursor - 32,
    size: 12,
    color: colors.ink,
    maxChars: 84,
    lineHeight: 18,
  });

  const images = [];
  for (const photo of (flyer.selectedPhotos || []).slice(0, 2)) {
    const embedded = await fetchPdfImage(pdfDoc, photo.imageUrl);
    if (embedded) {
      images.push({ image: embedded, roomLabel: photo.roomLabel || 'Property photo' });
    }
  }

  let imageY = 294;
  for (let index = 0; index < images.length; index += 1) {
    const imageX = index === 0 ? 356 : 356;
    const frameY = index === 0 ? 410 : 246;
    const frameWidth = 172;
    const frameHeight = 132;
    const dims = images[index].image.scale(1);
    const ratio = Math.min(frameWidth / dims.width, frameHeight / dims.height);
    const width = dims.width * ratio;
    const height = dims.height * ratio;
    const x = imageX + (frameWidth - width) / 2;
    const y = frameY + (frameHeight - height) / 2;

    page.drawRectangle({
      x: imageX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      color: rgb(1, 1, 1),
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 12,
    });
    page.drawImage(images[index].image, {
      x,
      y,
      width,
      height,
    });
    page.drawText(images[index].roomLabel, {
      x: imageX,
      y: frameY - 16,
      size: 10,
      font: bodyFont,
      color: colors.muted,
    });
    imageY = Math.min(imageY, frameY - 34);
  }

  page.drawText(flyer.disclaimer, {
    x: 54,
    y: Math.max(52, imageY - 10),
    size: 9,
    font: bodyFont,
    color: colors.muted,
    maxWidth: 474,
    lineHeight: 12,
  });

  const bytes = await pdfDoc.save();
  const filename = `${sanitizeFilePart(property.title, 'property')}-${sanitizeFilePart(
    flyer.flyerType,
    'flyer',
  )}.pdf`;

  return {
    bytes,
    filename,
    flyer,
  };
}
