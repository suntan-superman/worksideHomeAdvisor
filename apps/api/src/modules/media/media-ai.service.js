import { createHash } from 'node:crypto';

import mongoose from 'mongoose';
import sharp from 'sharp';

import {
  buildMediaAssetUrl,
  buildMediaVariantUrl,
  readStoredAsset,
  saveBinaryBuffer,
} from '../../services/storageService.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import { runReplicateInpainting } from './replicate-provider.service.js';
import { listVisionPresets, resolveVisionPreset } from './vision-presets.js';

const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

function serializeImageJob(document, variants = []) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return {
      ...document,
      variants: document.variants || variants,
    };
  }

  return {
    id: document._id?.toString(),
    mediaId: document.mediaId?.toString?.() || String(document.mediaId),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    jobType: document.jobType,
    jobCategory: document.jobCategory || 'enhancement',
    status: document.status,
    provider: document.provider,
    providerJobId: document.providerJobId || null,
    presetKey: document.presetKey || document.jobType,
    roomType: document.roomType || 'unknown',
    promptVersion: Number(document.promptVersion || 1),
    inputHash: document.inputHash || null,
    input: document.input || {},
    outputVariantIds: (document.outputVariantIds || []).map(
      (item) => item?.toString?.() || String(item),
    ),
    selectedVariantId:
      document.selectedVariantId?.toString?.() || document.selectedVariantId || null,
    message: document.message || '',
    warning: document.warning || '',
    variants,
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
    imageUrl:
      document.imageUrl ||
      (document._id ? buildMediaVariantUrl(document._id.toString()) : null),
    storageProvider: document.storageProvider || 'local',
    storageKey: document.storageKey || null,
    byteSize: document.byteSize || null,
    isSelected: Boolean(document.isSelected),
    useInBrochure: Boolean(document.useInBrochure),
    useInReport: Boolean(document.useInReport),
    metadata: document.metadata || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function normalizeRoomType(value) {
  const normalized = String(value || 'unknown').toLowerCase().replace(/\s+/g, '_');

  if (normalized.includes('kitchen')) {
    return 'kitchen';
  }
  if (normalized.includes('living')) {
    return 'living_room';
  }
  if (normalized.includes('bed')) {
    return 'bedroom';
  }
  if (normalized.includes('bath')) {
    return 'bathroom';
  }
  if (normalized.includes('exterior') || normalized.includes('front') || normalized.includes('backyard')) {
    return 'exterior';
  }

  return normalized || 'unknown';
}

function getRoomPromptAddon(roomType) {
  const normalizedRoomType = normalizeRoomType(roomType);

  if (normalizedRoomType === 'kitchen') {
    return 'Keep countertops, cabinets, appliances, and backsplash visually coherent and realistic.';
  }
  if (normalizedRoomType === 'living_room') {
    return 'Preserve focal points such as fireplace, windows, and major seating zones.';
  }
  if (normalizedRoomType === 'bedroom') {
    return 'Keep the room calm, uncluttered, and proportional, without over-staging.';
  }
  if (normalizedRoomType === 'bathroom') {
    return 'Preserve tile, vanity, mirrors, and fixtures accurately while improving visual cleanliness.';
  }
  if (normalizedRoomType === 'exterior') {
    return 'Preserve the real structure, roofline, doors, windows, and lot boundaries.';
  }

  return '';
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

function buildPresetRenderPlan(presetKey) {
  const preset = resolveVisionPreset(presetKey);

  if (preset.key === 'declutter_light') {
    return {
      preset,
      label: 'Light Declutter',
      warning: '',
      summary:
        'A lighter declutter pass that reduces small distractions while keeping the room realistic.',
      differenceHint:
        'Look for cleaner counters, fewer distractions, and a calmer overall room presentation.',
      effects: ['Small clutter reduction', 'Cleaner surfaces', 'Listing-safe cleanup'],
    };
  }

  if (preset.key === 'declutter_medium') {
    return {
      preset,
      label: 'Medium Declutter',
      warning: '',
      summary:
        'A stronger declutter treatment that simplifies the room more aggressively while preserving layout and furniture.',
      differenceHint:
        'The room should feel more open, tidier, and less visually noisy than the original.',
      effects: ['Stronger declutter', 'Tidier presentation', 'Open-room feel'],
    };
  }

  if (preset.key === 'remove_furniture') {
    return {
      preset,
      label: 'Furniture Removal Concept',
      warning:
        'This is a concept preview only. It is intended for planning and seller discussion, not silent replacement of the actual room photo.',
      summary:
        'A concept preview that removes most movable furniture to show how the room could feel more open.',
      differenceHint:
        'Look at the perceived openness of the room rather than exact decor details.',
      effects: ['Furniture removal', 'Open-room concept', 'Planning preview'],
    };
  }

  if (preset.key === 'combined_listing_refresh') {
    return {
      preset,
      label: 'Listing Refresh',
      warning: '',
      summary:
        'A polished blend of enhancement and cleanup meant to read more like a final listing-ready hero image.',
      differenceHint:
        'Look for cleaner whites, stronger edge definition, and a more polished overall presentation.',
      effects: ['Listing polish', 'Brighter whites', 'Balanced contrast', 'Subtle cleanup'],
      cropInsetRatio: 0.04,
      transform: (image, metadata) =>
        applyCenterCrop(image, metadata, 0.04)
          .normalize()
          .gamma(1.1)
          .linear(1.12, -11)
          .modulate({ brightness: 1.13, saturation: 1.06 })
          .sharpen({ sigma: 1.35, m1: 0.9, m2: 2.1, x1: 2, x2: 14, x3: 28 }),
    };
  }

  return {
    preset,
    label: 'Enhanced Listing Version',
    warning: '',
    summary:
      'A brighter, sharper, more listing-ready version designed to improve presentation without changing the room truthfully.',
    differenceHint:
      'Look for cleaner whites, stronger edge detail, and a more balanced overall exposure.',
    effects: ['Brighter exposure', 'Stronger contrast', 'Sharper detail'],
    cropInsetRatio: 0.025,
    transform: (image, metadata) =>
      applyCenterCrop(image, metadata, 0.025)
        .normalize()
        .gamma(1.08)
        .linear(1.1, -10)
        .modulate({ brightness: 1.12, saturation: 1.08 })
        .sharpen({ sigma: 1.45, m1: 0.9, m2: 2.1, x1: 2, x2: 14, x3: 28 }),
  };
}

async function renderVariantBuffer(buffer, presetKey, roomType) {
  const renderPlan = buildPresetRenderPlan(presetKey);
  const sourceMetadata = await sharp(buffer).rotate().metadata();
  const transformed = await renderPlan
    .transform(sharp(buffer).rotate(), sourceMetadata)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const roomPromptAddon = getRoomPromptAddon(roomType);

  return {
    buffer: transformed,
    label: renderPlan.label,
    warning: renderPlan.warning,
    summary: renderPlan.summary,
    differenceHint: renderPlan.differenceHint,
    effects: renderPlan.effects,
    cropInsetPercent: Math.round((renderPlan.cropInsetRatio || 0) * 100),
    preset: renderPlan.preset,
    roomPromptAddon,
  };
}

async function downloadRemoteImageAsBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download generated variant from provider (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildVisionInputHash({ assetId, presetKey, roomType, promptVersion }) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        assetId,
        presetKey,
        roomType,
        promptVersion,
      }),
    )
    .digest('hex');
}

async function loadJobVariants(jobId) {
  if (!jobId) {
    return [];
  }

  const variants = await MediaVariantModel.find({ visionJobId: jobId }).sort({ createdAt: -1 }).lean();
  return variants.map(serializeMediaVariant);
}

export function getVisionPresetCatalog() {
  return listVisionPresets();
}

export async function listMediaVariants(assetId) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const variants = await MediaVariantModel.find({ mediaId: assetId })
    .sort({ isSelected: -1, createdAt: -1 })
    .lean();
  return variants.map(serializeMediaVariant);
}

export async function getImageJobById(jobId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const job = await ImageJobModel.findById(jobId).lean();
  if (!job) {
    return null;
  }

  const variants = await loadJobVariants(job._id);
  return serializeImageJob(job, variants);
}

export async function createImageEnhancementJob({
  assetId,
  jobType = 'enhance_listing_quality',
  presetKey,
  roomType,
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate image variants.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  const preset = resolveVisionPreset(presetKey || jobType);
  const resolvedRoomType = normalizeRoomType(roomType || asset.roomLabel);
  const inputHash = buildVisionInputHash({
    assetId: asset._id.toString(),
    presetKey: preset.key,
    roomType: resolvedRoomType,
    promptVersion: preset.promptVersion,
  });

  const cachedJob = await ImageJobModel.findOne({
    mediaId: asset._id,
    inputHash,
    status: 'completed',
    createdAt: { $gte: new Date(Date.now() - CACHE_WINDOW_MS) },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (cachedJob) {
    const cachedVariants = await loadJobVariants(cachedJob._id);
    return {
      cached: true,
      preset,
      job: {
        ...serializeImageJob(cachedJob, cachedVariants),
        message: cachedJob.message || 'Returning cached vision output.',
      },
      variants: cachedVariants,
      variant: cachedVariants[0] || null,
    };
  }

  const job = await ImageJobModel.create({
    mediaId: asset._id,
    propertyId: asset.propertyId,
    jobType: preset.key,
    jobCategory: preset.category,
    status: 'processing',
    provider: preset.providerPreference || 'local_sharp',
    presetKey: preset.key,
    roomType: resolvedRoomType,
    promptVersion: preset.promptVersion,
    inputHash,
    input: {
      roomLabel: asset.roomLabel,
      roomType: resolvedRoomType,
      mimeType: asset.mimeType,
      prompt: preset.basePrompt,
      helperText: preset.helperText,
      recommendedUse: preset.recommendedUse,
    },
  });

  try {
    const renderPlan = buildPresetRenderPlan(preset.key);
    const fullPrompt = [preset.basePrompt, getRoomPromptAddon(resolvedRoomType)]
      .filter(Boolean)
      .join(' ');
    let createdVariants = [];

    if (preset.providerPreference === 'replicate') {
      const imageUrl = buildMediaAssetUrl(asset._id.toString());
      const providerOutputs = await runReplicateInpainting({
        imageUrl,
        model: preset.replicateModel,
        prompt: fullPrompt,
        strength: preset.strength,
        outputCount: preset.outputCount || 2,
        guidanceScale: preset.guidanceScale,
        numInferenceSteps: preset.numInferenceSteps,
      });

      createdVariants = await Promise.all(
        providerOutputs.map(async (outputUrl, index) => {
          const buffer = await downloadRemoteImageAsBuffer(outputUrl);
          const saved = await saveBinaryBuffer({
            propertyId: asset.propertyId.toString(),
            mimeType: 'image/jpeg',
            buffer,
          });

          const variant = await MediaVariantModel.create({
            visionJobId: job._id,
            mediaId: asset._id,
            propertyId: asset.propertyId,
            variantType: preset.key,
            variantCategory: preset.category,
            label: `${renderPlan.label} ${String.fromCharCode(65 + index)}`,
            mimeType: 'image/jpeg',
            storageProvider: saved.storageProvider,
            storageKey: saved.storageKey,
            byteSize: saved.byteSize,
            isSelected: false,
            useInBrochure: false,
            useInReport: false,
            metadata: {
              warning: renderPlan.warning,
              summary: renderPlan.summary,
              differenceHint: renderPlan.differenceHint,
              effects: renderPlan.effects,
              sourceAssetId: asset._id.toString(),
              roomLabel: asset.roomLabel,
              roomType: resolvedRoomType,
              provider: 'replicate',
              presetKey: preset.key,
              promptVersion: preset.promptVersion,
              helperText: preset.helperText,
              recommendedUse: preset.recommendedUse,
              category: preset.category,
              disclaimerType: preset.disclaimerType,
              roomPromptAddon: getRoomPromptAddon(resolvedRoomType),
              providerSourceUrl: outputUrl,
            },
          });

          return serializeMediaVariant(variant.toObject());
        }),
      );
    } else {
      const stored = await readStoredAsset({
        storageProvider: asset.storageProvider,
        storageKey: asset.storageKey,
      });
      const rendered = await renderVariantBuffer(stored.buffer, preset.key, resolvedRoomType);
      const saved = await saveBinaryBuffer({
        propertyId: asset.propertyId.toString(),
        mimeType: 'image/jpeg',
        buffer: rendered.buffer,
      });

      const variant = await MediaVariantModel.create({
        visionJobId: job._id,
        mediaId: asset._id,
        propertyId: asset.propertyId,
        variantType: preset.key,
        variantCategory: preset.category,
        label: rendered.label,
        mimeType: 'image/jpeg',
        storageProvider: saved.storageProvider,
        storageKey: saved.storageKey,
        byteSize: saved.byteSize,
        isSelected: false,
        useInBrochure: false,
        useInReport: false,
        metadata: {
          warning: rendered.warning,
          summary: rendered.summary,
          differenceHint: rendered.differenceHint,
          effects: rendered.effects,
          cropInsetPercent: rendered.cropInsetPercent,
          sourceAssetId: asset._id.toString(),
          roomLabel: asset.roomLabel,
          roomType: resolvedRoomType,
          provider: preset.providerPreference || 'local_sharp',
          presetKey: preset.key,
          promptVersion: preset.promptVersion,
          helperText: preset.helperText,
          recommendedUse: preset.recommendedUse,
          category: preset.category,
          disclaimerType: preset.disclaimerType,
          roomPromptAddon: rendered.roomPromptAddon,
        },
      });

      createdVariants = [serializeMediaVariant(variant.toObject())];
    }

    job.status = 'completed';
    job.outputVariantIds = createdVariants.map((variant) => variant.id);
    job.warning = renderPlan.warning;
    job.message = `${createdVariants.length} ${renderPlan.label.toLowerCase()} variant${createdVariants.length === 1 ? '' : 's'} generated.`;
    await job.save();

    return {
      cached: false,
      preset,
      job: serializeImageJob(job.toObject(), createdVariants),
      variants: createdVariants,
      variant: createdVariants[0] || null,
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

  if (variant.visionJobId) {
    await ImageJobModel.findByIdAndUpdate(variant.visionJobId, {
      $set: { selectedVariantId: variant._id },
    });
  }

  return serializeMediaVariant(variant.toObject());
}

export async function updateMediaVariantUsage(assetId, variantId, updates = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update media variants.');
  }

  const variant = await MediaVariantModel.findOne({ _id: variantId, mediaId: assetId });
  if (!variant) {
    throw new Error('Media variant not found.');
  }

  if (typeof updates.useInBrochure === 'boolean') {
    variant.useInBrochure = updates.useInBrochure;
  }

  if (typeof updates.useInReport === 'boolean') {
    variant.useInReport = updates.useInReport;
  }

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
