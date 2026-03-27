import mongoose from 'mongoose';
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
    source: document.source || 'fallback',
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function chooseFlyerPhotos(assets) {
  return (assets || [])
    .slice(0, 4)
    .map((asset) => ({
      assetId: asset.id,
      roomLabel: asset.roomLabel,
      imageUrl: asset.imageUrl || asset.imageDataUrl || null,
      score: asset.analysis?.overallQualityScore || null,
    }));
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

export async function generatePropertyFlyer({ propertyId, flyerType = 'sale' }) {
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

  const selectedPhotos = chooseFlyerPhotos(mediaAssets);
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
        headline: marketing.headline || fallbackFlyer.headline,
        subheadline: marketing.shortDescription || fallbackFlyer.subheadline,
        priceText: buildPriceText(pricing, flyerType),
        locationLine: fallbackFlyer.locationLine,
        summary: marketing.shortDescription || fallbackFlyer.summary,
        highlights: marketing.featureHighlights?.length
          ? marketing.featureHighlights
          : fallbackFlyer.highlights,
        selectedPhotos,
        callToAction: fallbackFlyer.callToAction,
        disclaimer: marketing.disclaimer || fallbackFlyer.disclaimer,
        source: marketing.source || 'fallback',
        rawMarketing: marketing,
      }
    : {
        ...fallbackFlyer,
        rawMarketing: null,
      };

  const document = await FlyerModel.create({
    propertyId,
    ...flyerPayload,
  });

  return serializeFlyer(document.toObject());
}

export async function getLatestPropertyFlyer(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const flyer = await FlyerModel.findOne({ propertyId }).sort({ createdAt: -1 }).lean();
  return serializeFlyer(flyer);
}
