import mongoose from 'mongoose';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import {
  buildMediaAssetUrl,
  buildMediaVariantUrl,
  saveImageBuffer,
} from '../../services/storageService.js';
import { assertPropertyEditableById, getPropertyById } from '../properties/property.service.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import { deleteStoredAssetIfUnreferenced } from './storage-reference.service.js';

function shouldIgnorePersistedMediaUrl(url) {
  if (!url) {
    return true;
  }

  const normalized = String(url).trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('0.0.0.0')
  );
}

function serializeMediaAsset(document, selectedVariant = null) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    roomLabel: document.roomLabel,
    mimeType: document.mimeType,
    width: document.width,
    height: document.height,
    storageProvider: document.storageProvider || 'local',
    storageKey: document.storageKey || null,
    byteSize: document.byteSize || null,
    imageUrl:
      !shouldIgnorePersistedMediaUrl(document.imageUrl) && document.imageUrl
        ? document.imageUrl
        : document._id
          ? buildMediaAssetUrl(document._id.toString())
          : null,
    imageDataUrl: document.imageDataUrl || null,
    listingCandidate: Boolean(document.listingCandidate),
    listingNote: document.listingNote || '',
    analysis: document.analysis || null,
        selectedVariant: selectedVariant
      ? {
          id: selectedVariant._id?.toString?.() || selectedVariant.id,
          visionJobId:
            selectedVariant.visionJobId?._id?.toString?.() ||
            selectedVariant.visionJobId?.toString?.() ||
            selectedVariant.visionJobId ||
            null,
          variantType: selectedVariant.variantType,
          variantCategory: selectedVariant.variantCategory || 'enhancement',
          label: selectedVariant.label,
          imageUrl:
            !shouldIgnorePersistedMediaUrl(selectedVariant.imageUrl) && selectedVariant.imageUrl
              ? selectedVariant.imageUrl
              : buildMediaVariantUrl(selectedVariant._id?.toString?.() || selectedVariant.id),
          lifecycleState:
            selectedVariant.lifecycleState ||
            (selectedVariant.isSelected ? 'selected' : 'temporary'),
          expiresAt: selectedVariant.expiresAt || null,
          selectedAt: selectedVariant.selectedAt || null,
          useInBrochure: Boolean(selectedVariant.useInBrochure),
          useInReport: Boolean(selectedVariant.useInReport),
          metadata: selectedVariant.metadata || {},
          createdAt: selectedVariant.createdAt,
          updatedAt: selectedVariant.updatedAt,
        }
      : null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function listMediaAssets(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const assets = await MediaAssetModel.find({ propertyId }).sort({ createdAt: -1 }).lean();
  const assetIds = assets.map((asset) => asset._id);
  const selectedVariants = assetIds.length
    ? await MediaVariantModel.find({ mediaId: { $in: assetIds }, isSelected: true }).lean()
    : [];
  const selectedByAssetId = new Map(
    selectedVariants.map((variant) => [variant.mediaId?.toString?.() || String(variant.mediaId), variant]),
  );

  return assets.map((asset) =>
    serializeMediaAsset(
      asset,
      selectedByAssetId.get(asset._id?.toString?.() || String(asset._id)) || null,
    ),
  );
}

export async function createMediaAssetAndAnalysis({
  propertyId,
  roomLabel,
  mimeType,
  imageBase64,
  width,
  height,
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to save media assets.');
  }

  const property = await assertPropertyEditableById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const analysis = await analyzePropertyPhoto({
    property,
    roomLabel,
    mimeType,
    imageBase64,
    width,
    height,
  });

  const storedImage = await saveImageBuffer({
    propertyId,
    mimeType,
    imageBase64,
  });

  const asset = await MediaAssetModel.create({
    propertyId,
    roomLabel,
    mimeType,
    width,
    height,
    storageProvider: storedImage.storageProvider,
    storageKey: storedImage.storageKey,
    byteSize: storedImage.byteSize,
    analysis,
  });

  asset.imageUrl = buildMediaAssetUrl(asset._id.toString());
  await asset.save();

  return {
    asset: serializeMediaAsset(asset.toObject()),
    analysis,
  };
}

export async function updateMediaAsset(assetId, updates) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update media assets.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  await assertPropertyEditableById(asset.propertyId);

  if (typeof updates.roomLabel === 'string') {
    asset.roomLabel = updates.roomLabel.trim() || asset.roomLabel;
  }

  if (typeof updates.listingCandidate === 'boolean') {
    asset.listingCandidate = updates.listingCandidate;
  }

  if (typeof updates.listingNote === 'string') {
    asset.listingNote = updates.listingNote.trim().slice(0, 280);
  }

  await asset.save();
  return serializeMediaAsset(asset.toObject());
}

export async function getMediaAssetById(assetId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const asset = await MediaAssetModel.findById(assetId).lean();
  const selectedVariant = asset
    ? await MediaVariantModel.findOne({ mediaId: asset._id, isSelected: true }).lean()
    : null;
  return serializeMediaAsset(asset, selectedVariant);
}

export async function deleteMediaAsset(assetId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to delete media assets.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  await assertPropertyEditableById(asset.propertyId);

  const variants = await MediaVariantModel.find({ mediaId: asset._id }).lean();
  const variantIds = variants.map((variant) => variant._id);
  const visionJobIds = [
    ...new Set(
      variants
        .map((variant) => variant.visionJobId?.toString?.() || String(variant.visionJobId || ''))
        .filter(Boolean),
    ),
  ];

  await Promise.all([
    deleteStoredAssetIfUnreferenced({
      storageProvider: asset.storageProvider,
      storageKey: asset.storageKey,
      excludeAssetId: asset._id,
    }),
    ...variants.map((variant) =>
      deleteStoredAssetIfUnreferenced({
        storageProvider: variant.storageProvider,
        storageKey: variant.storageKey,
        excludeVariantId: variant._id,
      }),
    ),
  ]);

  if (variantIds.length) {
    await MediaVariantModel.deleteMany({ _id: { $in: variantIds } });
  }

  if (visionJobIds.length) {
    await ImageJobModel.deleteMany({ _id: { $in: visionJobIds } });
  }

  await MediaAssetModel.deleteOne({ _id: asset._id });

  return {
    deleted: true,
    assetId,
    propertyId: asset.propertyId?.toString?.() || String(asset.propertyId),
  };
}
