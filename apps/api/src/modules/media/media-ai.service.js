import mongoose from 'mongoose';
import sharp from 'sharp';

import {
  buildMediaVariantUrl,
  readStoredAsset,
  saveBinaryBuffer,
} from '../../services/storageService.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';

function serializeImageJob(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    mediaId: document.mediaId?.toString?.() || String(document.mediaId),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    jobType: document.jobType,
    status: document.status,
    provider: document.provider,
    input: document.input || {},
    outputVariantIds: (document.outputVariantIds || []).map((item) => item?.toString?.() || String(item)),
    message: document.message || '',
    warning: document.warning || '',
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function serializeMediaVariant(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    mediaId: document.mediaId?.toString?.() || String(document.mediaId),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    variantType: document.variantType,
    label: document.label,
    mimeType: document.mimeType || 'image/jpeg',
    imageUrl:
      document.imageUrl ||
      (document._id ? buildMediaVariantUrl(document._id.toString()) : null),
    storageProvider: document.storageProvider || 'local',
    storageKey: document.storageKey || null,
    byteSize: document.byteSize || null,
    isSelected: Boolean(document.isSelected),
    metadata: document.metadata || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function buildCenterCropRegion(metadata, insetRatio = 0) {
  const width = Number(metadata?.width || 0);
  const height = Number(metadata?.height || 0);

  if (!width || !height || insetRatio <= 0) {
    return null;
  }

  const extractWidth = Math.max(1, Math.round(width * (1 - insetRatio * 2)));
  const extractHeight = Math.max(1, Math.round(height * (1 - insetRatio * 2)));

  return {
    left: Math.max(0, Math.round((width - extractWidth) / 2)),
    top: Math.max(0, Math.round((height - extractHeight) / 2)),
    width: extractWidth,
    height: extractHeight,
  };
}

function applyCenterCrop(image, metadata, insetRatio = 0) {
  const region = buildCenterCropRegion(metadata, insetRatio);

  if (!region) {
    return image;
  }

  return image.extract(region).resize(metadata.width, metadata.height, {
    fit: 'fill',
  });
}

function getVariantPreset(jobType) {
  if (jobType === 'declutter_preview') {
    return {
      label: 'Declutter Preview',
      warning:
        'This preview uses tighter framing and visual cleanup cues, but it does not yet remove furniture or objects with full AI scene editing.',
      summary:
        'A tighter crop and brighter cleanup pass meant to reduce edge clutter and make the room feel calmer.',
      differenceHint:
        'Look at the outer edges and window light first. This version trims the frame slightly and brightens the room more aggressively.',
      effects: ['Tighter framing', 'Brighter exposure', 'Softer clutter emphasis'],
      cropInsetRatio: 0.08,
      transform: (image, metadata) =>
        applyCenterCrop(image, metadata, 0.08)
          .normalize()
          .gamma(1.12)
          .linear(1.12, -12)
          .modulate({ brightness: 1.14, saturation: 0.9 })
          .sharpen({ sigma: 1.05, m1: 0.7, m2: 1.8, x1: 2, x2: 12, x3: 24 }),
    };
  }

  return {
    label: 'Enhanced Listing Version',
    warning: '',
    summary:
      'A brighter, sharper, slightly tighter version designed to read more like a listing hero image.',
    differenceHint:
      'Look for cleaner whites, stronger edge detail, and a subtly tighter crop around the room.',
    effects: ['Brighter exposure', 'Stronger contrast', 'Tighter crop', 'Sharper detail'],
    cropInsetRatio: 0.035,
    transform: (image, metadata) =>
      applyCenterCrop(image, metadata, 0.035)
        .normalize()
        .gamma(1.08)
        .linear(1.1, -10)
        .modulate({ brightness: 1.12, saturation: 1.14 })
        .sharpen({ sigma: 1.45, m1: 0.9, m2: 2.1, x1: 2, x2: 14, x3: 28 }),
  };
}

async function renderVariantBuffer(buffer, jobType) {
  const preset = getVariantPreset(jobType);
  const sourceMetadata = await sharp(buffer).rotate().metadata();
  const transformed = await preset
    .transform(sharp(buffer).rotate(), sourceMetadata)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return {
    buffer: transformed,
    label: preset.label,
    warning: preset.warning,
    summary: preset.summary,
    differenceHint: preset.differenceHint,
    effects: preset.effects,
    cropInsetPercent: Math.round((preset.cropInsetRatio || 0) * 100),
  };
}

export async function listMediaVariants(assetId) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const variants = await MediaVariantModel.find({ mediaId: assetId }).sort({ createdAt: -1 }).lean();
  return variants.map(serializeMediaVariant);
}

export async function getImageJobById(jobId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const job = await ImageJobModel.findById(jobId).lean();
  return serializeImageJob(job);
}

export async function createImageEnhancementJob({ assetId, jobType = 'enhance_listing_quality' }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate image variants.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  const job = await ImageJobModel.create({
    mediaId: asset._id,
    propertyId: asset.propertyId,
    jobType,
    status: 'processing',
    input: {
      roomLabel: asset.roomLabel,
      mimeType: asset.mimeType,
    },
  });

  try {
    const stored = await readStoredAsset({
      storageProvider: asset.storageProvider,
      storageKey: asset.storageKey,
    });
    const rendered = await renderVariantBuffer(stored.buffer, jobType);
    const saved = await saveBinaryBuffer({
      propertyId: asset.propertyId.toString(),
      mimeType: 'image/jpeg',
      buffer: rendered.buffer,
    });

    const variant = await MediaVariantModel.create({
      mediaId: asset._id,
      propertyId: asset.propertyId,
      variantType: jobType,
      label: rendered.label,
      mimeType: 'image/jpeg',
      storageProvider: saved.storageProvider,
      storageKey: saved.storageKey,
      byteSize: saved.byteSize,
      isSelected: false,
      metadata: {
        warning: rendered.warning,
        summary: rendered.summary,
        differenceHint: rendered.differenceHint,
        effects: rendered.effects,
        cropInsetPercent: rendered.cropInsetPercent,
        sourceAssetId: asset._id.toString(),
        roomLabel: asset.roomLabel,
      },
    });

    job.status = 'completed';
    job.outputVariantIds = [variant._id];
    job.warning = rendered.warning;
    job.message =
      jobType === 'declutter_preview'
        ? 'Declutter preview generated.'
        : 'Enhanced listing version generated.';
    await job.save();

    return {
      job: serializeImageJob(job.toObject()),
      variant: serializeMediaVariant(variant.toObject()),
    };
  } catch (error) {
    job.status = 'failed';
    job.message = 'Image variant generation failed.';
    job.warning = error.message;
    await job.save();
    throw error;
  }
}

export async function selectMediaVariant(assetId, variantId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to select media variants.');
  }

  const variant = await MediaVariantModel.findOne({ _id: variantId, mediaId: assetId });
  if (!variant) {
    throw new Error('Media variant not found.');
  }

  await MediaVariantModel.updateMany({ mediaId: assetId }, { $set: { isSelected: false } });
  variant.isSelected = true;
  await variant.save();

  return serializeMediaVariant(variant.toObject());
}

export async function getMediaVariantById(variantId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const variant = await MediaVariantModel.findById(variantId).lean();
  return serializeMediaVariant(variant);
}
