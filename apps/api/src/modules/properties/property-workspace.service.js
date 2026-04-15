import { getLatestPropertyFlyer } from '../documents/flyer.service.js';
import { getLatestPropertyReport } from '../documents/report.service.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { listMediaAssets } from '../media/media.service.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from './property.service.js';
import { getOrCreatePropertyChecklist } from '../tasks/tasks.service.js';

const VARIANT_PROJECTION = {
  _id: 1,
  visionJobId: 1,
  mediaId: 1,
  propertyId: 1,
  variantType: 1,
  variantCategory: 1,
  label: 1,
  mimeType: 1,
  imageUrl: 1,
  storageProvider: 1,
  storageKey: 1,
  byteSize: 1,
  isSelected: 1,
  lifecycleState: 1,
  expiresAt: 1,
  selectedAt: 1,
  useInBrochure: 1,
  useInReport: 1,
  metadata: 1,
  createdAt: 1,
  updatedAt: 1,
};

function serializeWorkspaceVariant(document) {
  if (!document) {
    return null;
  }

  return {
    id: document._id?.toString(),
    visionJobId:
      document.visionJobId?._id?.toString?.() ||
      document.visionJobId?.toString?.() ||
      document.visionJobId ||
      null,
    mediaId: document.mediaId?.toString?.() || String(document.mediaId),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    variantType: document.variantType,
    variantCategory: document.variantCategory || 'enhancement',
    label: document.label,
    mimeType: document.mimeType || 'image/jpeg',
    imageUrl: document.imageUrl || null,
    storageProvider: document.storageProvider || 'local',
    storageKey: document.storageKey || null,
    byteSize: document.byteSize || null,
    isSelected: Boolean(document.isSelected),
    lifecycleState: document.lifecycleState || (document.isSelected ? 'selected' : 'temporary'),
    expiresAt: document.expiresAt || null,
    selectedAt: document.selectedAt || null,
    useInBrochure: Boolean(document.useInBrochure),
    useInReport: Boolean(document.useInReport),
    metadata: document.metadata || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function getPropertyWorkspaceSnapshot(propertyId) {
  const [property, mediaAssets, latestPricing, checklist, latestFlyer, latestReport] =
    await Promise.all([
      getPropertyById(propertyId),
      listMediaAssets(propertyId),
      getLatestPricingAnalysis(propertyId),
      getOrCreatePropertyChecklist(propertyId),
      getLatestPropertyFlyer(propertyId),
      getLatestPropertyReport(propertyId),
    ]);

  if (!property) {
    return null;
  }

  const assetIds = mediaAssets.map((asset) => asset.id).filter(Boolean);
  const mediaVariants = assetIds.length
    ? await MediaVariantModel.find({ mediaId: { $in: assetIds } })
        .select(VARIANT_PROJECTION)
        .sort({ createdAt: -1 })
        .lean()
    : [];

  return {
    property,
    mediaAssets,
    mediaVariants: mediaVariants.map(serializeWorkspaceVariant),
    reports: {
      latestFlyer,
      latestReport,
    },
    pricingAnalyses: {
      latest: latestPricing,
    },
    checklist,
    generatedAt: new Date().toISOString(),
  };
}
