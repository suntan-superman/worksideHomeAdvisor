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

function getVariantPreset(jobType) {
  if (jobType === 'declutter_preview') {
    return {
      label: 'Declutter Preview',
      warning:
        'This early declutter preview improves brightness and visual polish, but does not yet remove objects with full AI scene editing.',
      transform: (image) =>
        image
          .rotate()
          .normalize()
          .linear(1.04, -6)
          .modulate({ brightness: 1.08, saturation: 0.94 })
          .sharpen({ sigma: 0.9 }),
    };
  }

  return {
    label: 'Enhanced Listing Version',
    warning: '',
    transform: (image) =>
      image
        .rotate()
        .normalize()
        .modulate({ brightness: 1.08, saturation: 1.06 })
        .sharpen({ sigma: 1.15 }),
  };
}

async function renderVariantBuffer(buffer, jobType) {
  const preset = getVariantPreset(jobType);
  const transformed = await preset
    .transform(sharp(buffer))
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return {
    buffer: transformed,
    label: preset.label,
    warning: preset.warning,
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
