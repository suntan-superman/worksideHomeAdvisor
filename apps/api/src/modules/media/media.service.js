import mongoose from 'mongoose';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import {
  buildMediaAssetUrl,
  buildMediaVariantUrl,
  readStoredAsset,
  saveBinaryBuffer,
  saveImageBuffer,
} from '../../services/storageService.js';
import { assertPropertyEditableById } from '../properties/property.service.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import { deleteStoredAssetIfUnreferenced } from './storage-reference.service.js';

const MEDIA_ASSET_PROJECTION = {
  _id: 1,
  propertyId: 1,
  roomLabel: 1,
  source: 1,
  assetType: 1,
  generationStage: 1,
  sourceMediaId: 1,
  sourceVariantId: 1,
  savedFromVision: 1,
  generationLabel: 1,
  notes: 1,
  mimeType: 1,
  width: 1,
  height: 1,
  storageProvider: 1,
  storageKey: 1,
  byteSize: 1,
  imageUrl: 1,
  imageDataUrl: 1,
  listingCandidate: 1,
  listingNote: 1,
  uploadedByUserId: 1,
  analysis: 1,
  createdAt: 1,
  updatedAt: 1,
};

const SELECTED_VARIANT_PROJECTION = {
  _id: 1,
  visionJobId: 1,
  variantType: 1,
  variantCategory: 1,
  label: 1,
  imageUrl: 1,
  lifecycleState: 1,
  expiresAt: 1,
  selectedAt: 1,
  useInBrochure: 1,
  useInReport: 1,
  metadata: 1,
  createdAt: 1,
  updatedAt: 1,
};

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

function normalizeGenerationStage(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!normalized) {
    return null;
  }

  if (normalized === 'clean' || normalized === 'clean_room') {
    return 'clean_room';
  }

  if (normalized === 'finish' || normalized === 'finishes') {
    return 'finishes';
  }

  if (normalized === 'style') {
    return 'style';
  }

  return null;
}

function buildGeneratedAssetAnalysisSnapshot({ roomLabel, generationLabel, variant }) {
  const overallQualityScore = Number(variant?.metadata?.review?.overallScore || 0) || undefined;
  const summaryParts = ['This AI-generated image was saved from Vision.'];
  if (generationLabel) {
    summaryParts.push(generationLabel);
  }

  return {
    roomGuess: roomLabel || '',
    overallQualityScore,
    summary: summaryParts.join(' '),
    source: 'vision_saved',
    warning: variant?.metadata?.warning || '',
  };
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
    source: document.source || 'mobile_capture',
    assetType: document.assetType || 'original',
    generationStage: document.generationStage || null,
    sourceMediaId: document.sourceMediaId?.toString?.() || String(document.sourceMediaId || ''),
    sourceVariantId:
      document.sourceVariantId?.toString?.() || String(document.sourceVariantId || ''),
    savedFromVision: Boolean(document.savedFromVision),
    generationLabel: document.generationLabel || '',
    notes: document.notes || '',
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
    uploadedByUserId:
      document.uploadedByUserId?.toString?.() || String(document.uploadedByUserId || ''),
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

  const assets = await MediaAssetModel.find({ propertyId })
    .select(MEDIA_ASSET_PROJECTION)
    .sort({ createdAt: -1 })
    .lean();
  const assetIds = assets.map((asset) => asset._id);
  const selectedVariants = assetIds.length
    ? await MediaVariantModel.find({ mediaId: { $in: assetIds }, isSelected: true })
        .select(SELECTED_VARIANT_PROJECTION)
        .lean()
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
  source = 'mobile_capture',
  notes = '',
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
    source,
    assetType: 'original',
    generationStage: null,
    sourceMediaId: null,
    sourceVariantId: null,
    savedFromVision: false,
    generationLabel: '',
    notes: String(notes || '').trim().slice(0, 500),
    mimeType,
    width,
    height,
    uploadedByUserId: property.ownerUserId || null,
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

  if (typeof updates.notes === 'string') {
    asset.notes = updates.notes.trim().slice(0, 500);
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

  const asset = await MediaAssetModel.findById(assetId).select(MEDIA_ASSET_PROJECTION).lean();
  const selectedVariant = asset
    ? await MediaVariantModel.findOne({ mediaId: asset._id, isSelected: true })
        .select(SELECTED_VARIANT_PROJECTION)
        .lean()
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

export async function saveMediaVariantToPhotos(variantId, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to save generated photos.');
  }

  const variant = await MediaVariantModel.findById(variantId).lean();
  if (!variant) {
    throw new Error('Media variant not found.');
  }

  const propertyId = variant.propertyId?.toString?.() || String(variant.propertyId || '');
  if (!propertyId) {
    throw new Error('Variant property was not found.');
  }

  if (payload.propertyId && String(payload.propertyId) !== propertyId) {
    throw new Error('Variant does not belong to the requested property.');
  }

  await assertPropertyEditableById(propertyId);

  const sourceAsset = await MediaAssetModel.findById(variant.mediaId).lean();
  if (!sourceAsset) {
    throw new Error('Source photo for this variant was not found.');
  }

  const normalizedStage =
    normalizeGenerationStage(payload.generationStage) ||
    normalizeGenerationStage(variant?.metadata?.workflowStageKey) ||
    normalizeGenerationStage(variant?.metadata?.generationStage) ||
    'style';
  const roomLabel = String(payload.roomLabel || sourceAsset.roomLabel || '').trim() || 'Generated photo';
  const listingCandidate =
    typeof payload.listingCandidate === 'boolean' ? payload.listingCandidate : true;
  const generationLabel = String(payload.generationLabel || variant.label || '').trim() || 'Saved Vision Result';

  let existingAsset = await MediaAssetModel.findOne({
    propertyId,
    sourceVariantId: variant._id,
    assetType: 'generated',
  });

  if (existingAsset) {
    let didUpdate = false;
    if (!existingAsset.listingCandidate && listingCandidate) {
      existingAsset.listingCandidate = true;
      didUpdate = true;
    }
    if (!existingAsset.savedFromVision) {
      existingAsset.savedFromVision = true;
      didUpdate = true;
    }
    if (!existingAsset.generationLabel) {
      existingAsset.generationLabel = generationLabel;
      didUpdate = true;
    }
    if (!existingAsset.generationStage && normalizedStage) {
      existingAsset.generationStage = normalizedStage;
      didUpdate = true;
    }
    if (didUpdate) {
      await existingAsset.save();
    }

    return {
      created: false,
      message: 'Saved to Photos',
      asset: serializeMediaAsset(existingAsset.toObject()),
    };
  }

  const storedVariant = await readStoredAsset({
    storageProvider: variant.storageProvider,
    storageKey: variant.storageKey,
  });
  const storedImage = await saveBinaryBuffer({
    propertyId,
    mimeType: variant.mimeType || 'image/jpeg',
    buffer: storedVariant.buffer,
  });

  const asset = await MediaAssetModel.create({
    propertyId,
    roomLabel,
    source: 'vision_generated',
    assetType: 'generated',
    generationStage: normalizedStage,
    sourceMediaId: sourceAsset._id,
    sourceVariantId: variant._id,
    savedFromVision: true,
    generationLabel,
    notes: '',
    mimeType: variant.mimeType || 'image/jpeg',
    width: sourceAsset.width,
    height: sourceAsset.height,
    uploadedByUserId: sourceAsset.uploadedByUserId || null,
    storageProvider: storedImage.storageProvider,
    storageKey: storedImage.storageKey,
    byteSize: storedImage.byteSize,
    listingCandidate,
    analysis: buildGeneratedAssetAnalysisSnapshot({
      roomLabel,
      generationLabel,
      variant,
    }),
  });

  asset.imageUrl = buildMediaAssetUrl(asset._id.toString());
  await asset.save();

  existingAsset = asset;
  return {
    created: true,
    message: 'Saved to Photos',
    asset: serializeMediaAsset(existingAsset.toObject()),
  };
}

export async function pruneMediaVariantDrafts(assetId, keepVariantId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to delete media variants.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  await assertPropertyEditableById(asset.propertyId);

  const variants = await MediaVariantModel.find({ mediaId: asset._id }).lean();
  if (!variants.length) {
    return {
      deleted: true,
      assetId,
      deletedVariantIds: [],
      keptVariantId: keepVariantId || null,
      deletedCount: 0,
    };
  }

  const normalizedKeepVariantId = keepVariantId?.toString?.() || String(keepVariantId || '');
  const keepVariant = normalizedKeepVariantId
    ? variants.find((variant) => variant._id?.toString?.() === normalizedKeepVariantId)
    : null;

  if (normalizedKeepVariantId && !keepVariant) {
    throw new Error('Selected variant was not found for this photo.');
  }

  const variantsToDelete = variants.filter(
    (variant) => variant._id?.toString?.() !== normalizedKeepVariantId,
  );

  await Promise.all(
    variantsToDelete.map((variant) =>
      deleteStoredAssetIfUnreferenced({
        storageProvider: variant.storageProvider,
        storageKey: variant.storageKey,
        excludeVariantId: variant._id,
      }),
    ),
  );

  const deletedVariantIds = variantsToDelete.map((variant) => variant._id);
  if (deletedVariantIds.length) {
    await MediaVariantModel.deleteMany({ _id: { $in: deletedVariantIds } });
  }

  const affectedVisionJobIds = [
    ...new Set(
      variantsToDelete
        .map((variant) => variant.visionJobId?.toString?.() || String(variant.visionJobId || ''))
        .filter(Boolean),
    ),
  ];

  if (affectedVisionJobIds.length) {
    for (const visionJobId of affectedVisionJobIds) {
      const remainingVariantCount = await MediaVariantModel.countDocuments({ visionJobId });
      if (!remainingVariantCount) {
        await ImageJobModel.deleteOne({ _id: visionJobId });
      } else if (normalizedKeepVariantId) {
        await ImageJobModel.updateOne(
          { _id: visionJobId, selectedVariantId: { $in: deletedVariantIds } },
          { $set: { selectedVariantId: normalizedKeepVariantId } },
        );
      }
    }
  }

  return {
    deleted: true,
    assetId,
    deletedVariantIds: deletedVariantIds.map((item) => item?.toString?.() || String(item)),
    keptVariantId: normalizedKeepVariantId || null,
    deletedCount: deletedVariantIds.length,
  };
}

export async function deleteMediaVariantDraft(assetId, variantId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to delete media variants.');
  }

  const timings = {};
  const startedAt = Date.now();

  let checkpointStartedAt = Date.now();
  const asset = await MediaAssetModel.findById(assetId).select('_id propertyId');
  timings.assetLookupMs = Date.now() - checkpointStartedAt;
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  checkpointStartedAt = Date.now();
  await assertPropertyEditableById(asset.propertyId);
  timings.authorizationMs = Date.now() - checkpointStartedAt;

  checkpointStartedAt = Date.now();
  const variant = await MediaVariantModel.findOne({ _id: variantId, mediaId: asset._id })
    .select('_id mediaId propertyId visionJobId storageProvider storageKey')
    .lean();
  timings.variantLookupMs = Date.now() - checkpointStartedAt;
  if (!variant) {
    throw new Error('Media variant not found.');
  }

  checkpointStartedAt = Date.now();
  await deleteStoredAssetIfUnreferenced({
    storageProvider: variant.storageProvider,
    storageKey: variant.storageKey,
    excludeVariantId: variant._id,
  });
  timings.storageCleanupMs = Date.now() - checkpointStartedAt;

  checkpointStartedAt = Date.now();
  await MediaVariantModel.deleteOne({ _id: variant._id });
  timings.variantDeleteMs = Date.now() - checkpointStartedAt;

  const normalizedVariantId = variant._id?.toString?.() || String(variant._id);
  const normalizedVisionJobId =
    variant.visionJobId?.toString?.() || String(variant.visionJobId || '');

  checkpointStartedAt = Date.now();
  await MediaAssetModel.updateMany(
    { sourceVariantId: variant._id },
    { $set: { sourceVariantId: null } },
  );
  timings.savedPhotoDetachMs = Date.now() - checkpointStartedAt;

  if (normalizedVisionJobId) {
    checkpointStartedAt = Date.now();
    await ImageJobModel.updateOne(
      { _id: normalizedVisionJobId },
      { $pull: { outputVariantIds: variant._id } },
    );

    const replacementVariant = await MediaVariantModel.findOne({ visionJobId: normalizedVisionJobId })
      .select('_id')
      .sort({ createdAt: -1 })
      .lean();

    if (!replacementVariant) {
      await ImageJobModel.deleteOne({ _id: normalizedVisionJobId });
    } else {
      await ImageJobModel.updateOne(
        { _id: normalizedVisionJobId, selectedVariantId: normalizedVariantId },
        {
          $set: {
            selectedVariantId:
              replacementVariant._id?.toString?.() || String(replacementVariant._id || ''),
          },
        },
      );
    }
    timings.jobCleanupMs = Date.now() - checkpointStartedAt;
  } else {
    timings.jobCleanupMs = 0;
  }

  timings.totalMs = Date.now() - startedAt;

  return {
    deleted: true,
    assetId: asset._id?.toString?.() || String(asset._id),
    variantId: normalizedVariantId,
    propertyId: asset.propertyId?.toString?.() || String(asset.propertyId),
    timing: timings,
  };
}
