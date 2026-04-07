import mongoose from 'mongoose';

import { formatCurrency } from '@workside/utils';

import { generateMarketingInsights } from '../../services/aiWorkflowService.js';
import { listMediaAssets } from '../media/media.service.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { SocialPackModel } from './social-pack.model.js';

function serializeSocialPack(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    headline: document.headline,
    primaryText: document.primaryText,
    shortCaption: document.shortCaption,
    cta: document.cta,
    disclaimers: document.disclaimers || [],
    selectedPhotos: document.selectedPhotos || [],
    variants: document.variants || [],
    markdown: document.markdown || '',
    source: document.source || 'fallback',
    payload: document.payload || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function rankAssets(assets = []) {
  return [...assets].sort((left, right) => {
    if (Boolean(left.listingCandidate) !== Boolean(right.listingCandidate)) {
      return left.listingCandidate ? -1 : 1;
    }

    return Number(right.analysis?.overallQualityScore || 0) - Number(left.analysis?.overallQualityScore || 0);
  });
}

function buildMarkdown(pack) {
  return [
    `# Social Ad Pack`,
    '',
    `## Headline`,
    pack.headline,
    '',
    `## Primary Text`,
    pack.primaryText,
    '',
    `## Short Caption`,
    pack.shortCaption,
    '',
    `## CTA`,
    pack.cta,
    '',
    `## Formats`,
    ...(pack.variants || []).map(
      (variant) => `- ${variant.format}: ${variant.width}x${variant.height} - ${variant.guidance}`,
    ),
    '',
    `## Disclaimers`,
    ...((pack.disclaimers || []).length
      ? pack.disclaimers.map((item) => `- ${item}`)
      : ['- Review all marketing copy and imagery before public use.']),
  ].join('\n');
}

function buildFallbackPack({ property, pricing, selectedPhotos, marketing }) {
  const priceText = pricing?.recommendedListMid
    ? `around ${formatCurrency(pricing.recommendedListMid)}`
    : 'with market-aligned pricing';
  const locationText = [property.city, property.state].filter(Boolean).join(', ');
  const headline =
    marketing?.headline ||
    `${property.title || 'Seller-ready home'} in ${locationText || 'a strong local market'}`;
  const primaryText =
    marketing?.shortDescription ||
    `Showcase ${property.title || 'this property'} with seller-ready prep, standout visuals, and a pricing story that feels grounded ${priceText}.`;
  const shortCaption =
    `${headline}. ${priceText}. ${selectedPhotos.length ? `${selectedPhotos.length} strong photo option${selectedPhotos.length === 1 ? '' : 's'} ready.` : 'Marketing visuals can be improved as more photos are added.'}`;

  return {
    headline,
    primaryText,
    shortCaption,
    cta: 'Request the full property package',
    disclaimers: [
      'Review generated copy and imagery before public advertising use.',
      'Pricing, availability, and final marketing claims should be independently verified.',
    ],
    selectedPhotos,
    variants: [
      {
        format: 'Square concept',
        width: 1080,
        height: 1080,
        guidance: selectedPhotos.length
          ? 'Use the strongest hero image with a short headline and simple CTA.'
          : 'Use a branded background treatment until more listing photos are available.',
      },
      {
        format: 'Story / reel concept',
        width: 1080,
        height: 1920,
        guidance: 'Lead with one hero photo, then reinforce price positioning and CTA.',
      },
      {
        format: 'Ad copy document',
        width: 0,
        height: 0,
        guidance: 'Use the headline, body copy, caption, and disclaimers in the markdown export.',
      },
      {
        format: 'CTA recommendation set',
        width: 0,
        height: 0,
        guidance: 'Primary CTA is tuned for seller inquiry and property-package requests.',
      },
    ],
  };
}

export async function generatePropertySocialPack(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate the social ad pack.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const [pricing, mediaAssets] = await Promise.all([
    getLatestPricingAnalysis(propertyId),
    listMediaAssets(propertyId),
  ]);

  const selectedPhotos = rankAssets(mediaAssets)
    .slice(0, 3)
    .map((asset) => ({
      assetId: asset.id,
      roomLabel: asset.roomLabel,
      imageUrl: asset.selectedVariant?.imageUrl || asset.imageUrl || '',
    }));

  let marketing = null;
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
            },
          }
        : null,
    });
  } catch {
    marketing = null;
  }

  const pack = buildFallbackPack({
    property,
    pricing,
    selectedPhotos,
    marketing,
  });
  const markdown = buildMarkdown(pack);

  const document = await SocialPackModel.create({
    propertyId,
    ...pack,
    markdown,
    source: marketing?.source || 'fallback',
    payload: {
      pricing: pricing
        ? {
            low: pricing.recommendedListLow,
            mid: pricing.recommendedListMid,
            high: pricing.recommendedListHigh,
          }
        : null,
      marketing,
    },
  });

  return serializeSocialPack(document.toObject());
}

export async function getLatestPropertySocialPack(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const pack = await SocialPackModel.findOne({ propertyId }).sort({ createdAt: -1 }).lean();
  return serializeSocialPack(pack);
}
