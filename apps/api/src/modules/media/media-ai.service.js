import { createHash } from 'node:crypto';

import mongoose from 'mongoose';
import sharp from 'sharp';

import { buildMediaVariantUrl, readStoredAsset, saveBinaryBuffer } from '../../services/storageService.js';
import { reviewVisionVariant } from '../../services/photoAnalysisService.js';
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
    return 'Maintain realistic countertops, cabinetry, backsplash, appliances, sink, and lighting. Remove only clutter and non-essential movable items. Preserve cabinet alignment, appliance proportions, and countertop edges. Do not invent new finishes or alter cabinet layout.';
  }
  if (normalizedRoomType === 'living_room') {
    return 'Preserve major focal points such as windows, fireplace, built-ins, and sightlines. Keep the room proportional and spacious. If furniture is removed, maintain realistic floor visibility, rug boundaries where appropriate, and clean wall and floor transitions.';
  }
  if (normalizedRoomType === 'bedroom') {
    return 'Keep the room calm, simple, and proportional. Preserve windows, bed wall alignment, trim, and flooring transitions. Avoid over-staging or introducing unrealistic decor. If decluttering, keep the room believable and modest.';
  }
  if (normalizedRoomType === 'bathroom') {
    return 'Preserve tile, vanity, mirrors, fixtures, shower or tub geometry, and countertop edges accurately. Emphasize cleanliness and brightness. Avoid changing plumbing fixture placement, tile layout, or mirror proportions.';
  }
  if (normalizedRoomType === 'dining_room') {
    return 'Preserve room symmetry, windows, and lighting fixtures. Keep the space balanced and open. If furniture is removed, maintain realistic floor and wall continuity and avoid introducing distortions in the table zone.';
  }
  if (normalizedRoomType === 'office' || normalizedRoomType === 'bonus_room') {
    return 'Keep proportions realistic and preserve built-ins, windows, flooring, and permanent features. If decluttering, remove distractions while keeping the room versatile and buyer-friendly.';
  }
  if (normalizedRoomType === 'exterior') {
    return 'Preserve the true roofline, windows, doors, driveway, landscaping boundaries, and lot shape. Improve visual cleanliness and presentation only. Do not alter architecture, add new permanent structures, or misrepresent the property exterior.';
  }

  return '';
}

function getUniversalRealismGuardrails() {
  return 'Keep the result realistic, natural, and suitable for residential real estate marketing. Do not distort walls, windows, doors, ceilings, floors, trim, or permanent fixtures. Do not invent architecture or major finishes that are not already present.';
}

function getPresetPromptAddon(presetKey, roomType) {
  const normalizedRoomType = normalizeRoomType(roomType);

  if (presetKey === 'declutter_light') {
    if (normalizedRoomType === 'kitchen') {
      return 'Reduce loose counter clutter and small distracting items, but preserve appliances, cabinetry, and the real kitchen layout.';
    }
    if (normalizedRoomType === 'living_room') {
      return 'Reduce small clutter on side tables, shelves, and floor edges, but preserve the main sofa, chairs, and the room layout.';
    }
    return 'Reduce smaller distracting items first, but preserve major furniture and the real room layout.';
  }

  if (presetKey === 'declutter_medium') {
    if (normalizedRoomType === 'kitchen') {
      return 'Simplify countertop objects and visual noise more aggressively while preserving cabinetry, appliances, and permanent finishes.';
    }
    if (normalizedRoomType === 'living_room') {
      return 'Simplify shelves, side surfaces, and small portable objects more aggressively while preserving the main seating and structure.';
    }
    return 'Simplify visible clutter more aggressively while preserving major furniture, architecture, and room proportions.';
  }

  if (presetKey === 'remove_furniture') {
    return 'Remove movable furniture if possible, but preserve all structural elements, built-ins, windows, doors, and permanent fixtures.';
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
      label: 'Decluttered Preview',
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
      label: 'Stronger Declutter Preview',
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
      label: 'Furniture Removal Preview',
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

function calculateVisionReviewOverallScore(review = {}) {
  const structuralScore = Number(review.structuralIntegrityScore || 0);
  const artifactScore = Number(review.artifactScore || 0);
  const listingAppealScore = Number(review.listingAppealScore || 0);

  return Math.round(structuralScore * 0.45 + artifactScore * 0.35 + listingAppealScore * 0.2);
}

function sortVisionVariants(variants = []) {
  return [...variants].sort((left, right) => {
    if (Boolean(left?.isSelected) !== Boolean(right?.isSelected)) {
      return left?.isSelected ? -1 : 1;
    }

    if (
      Boolean(left?.metadata?.review?.shouldHideByDefault) !==
      Boolean(right?.metadata?.review?.shouldHideByDefault)
    ) {
      return left?.metadata?.review?.shouldHideByDefault ? 1 : -1;
    }

    const leftScore = Number(left?.metadata?.review?.overallScore || 0);
    const rightScore = Number(right?.metadata?.review?.overallScore || 0);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime();
  });
}

function getProviderSourceUrl(output) {
  if (typeof output === 'string') {
    return output;
  }

  if (typeof output?.url === 'function') {
    return output.url();
  }

  return null;
}

export function buildVariantStoryBlock({ asset, variant }) {
  const presetKey = variant?.metadata?.presetKey || variant?.variantType;
  const roomLabel = asset?.roomLabel || variant?.metadata?.roomLabel || 'Room';
  const isConcept = variant?.variantCategory === 'concept_preview';
  const reviewSummary = variant?.metadata?.review?.summary || '';
  const suggestedAction = variant?.metadata?.review?.suggestedAction || '';

  if (presetKey === 'remove_furniture') {
    return {
      title: `${roomLabel} Open-Space Preview`,
      originalMediaId: asset?.id || variant?.mediaId || null,
      originalImageUrl: asset?.imageUrl || null,
      variantId: variant?.id || null,
      variantImageUrl: variant?.imageUrl || null,
      variantCategory: variant?.variantCategory || 'concept_preview',
      whatChanged:
        'This preview removes most movable furniture to help show the room’s open floor area and natural flow.',
      whyItMatters:
        reviewSummary ||
        'When a room feels less crowded, buyers may better understand its size, layout, and flexibility.',
      suggestedAction:
        suggestedAction ||
        'Consider removing oversized furniture, reducing accent pieces, and simplifying the room before photography or showings.',
      disclaimer:
        'This image is an AI-generated concept preview for planning purposes only.',
    };
  }

  return {
    title: `${roomLabel} Declutter Preview`,
    originalMediaId: asset?.id || variant?.mediaId || null,
    originalImageUrl: asset?.imageUrl || null,
    variantId: variant?.id || null,
    variantImageUrl: variant?.imageUrl || null,
    variantCategory: variant?.variantCategory || 'enhancement',
    whatChanged:
      'This preview reduces visible clutter and simplifies the room presentation while keeping the true layout and finishes intact.',
    whyItMatters:
      reviewSummary ||
      'Cleaner spaces usually photograph better and help buyers focus on layout, natural light, and permanent features rather than small distractions.',
    suggestedAction:
      suggestedAction ||
      (roomLabel.toLowerCase().includes('kitchen')
        ? 'Before final listing photos, clear counters, remove extra small appliances, and simplify visible kitchen items.'
        : 'Before final listing photos, remove small distracting items, reduce visual clutter, and simplify the room presentation.'),
    disclaimer: isConcept
      ? 'This image is an AI-generated planning preview and may not reflect exact final results.'
      : 'This enhanced image should be reviewed for truthfulness before public marketing use.',
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

async function convertReplicateOutputToBuffer(output) {
  if (!output) {
    throw new Error('Replicate returned an empty output.');
  }

  if (typeof output.arrayBuffer === 'function') {
    return Buffer.from(await output.arrayBuffer());
  }

  if (Buffer.isBuffer(output)) {
    return output;
  }

  if (typeof output === 'string') {
    const response = await fetch(output);
    if (!response.ok) {
      throw new Error(`Could not download generated variant from provider (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('Unsupported Replicate output format.');
}

function buildMaskShapes(metadata, presetKey, roomType) {
  const width = Number(metadata?.width || 0);
  const height = Number(metadata?.height || 0);

  if (!width || !height) {
    throw new Error('Source image dimensions are required to build an inpainting mask.');
  }

  const normalizedRoomType = normalizeRoomType(roomType);

  if (presetKey === 'remove_furniture') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.24),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.68),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.66),
        rx: Math.round(width * 0.28),
        ry: Math.round(height * 0.2),
      },
    ];
  }

  if (presetKey === 'declutter_medium') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.1),
        top: Math.round(height * 0.18),
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.7),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.66),
        rx: Math.round(width * 0.22),
        ry: Math.round(height * 0.16),
      },
    ];
  }

  if (normalizedRoomType === 'living_room') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.14),
        top: Math.round(height * 0.28),
        width: Math.round(width * 0.72),
        height: Math.round(height * 0.56),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.68),
        rx: Math.round(width * 0.18),
        ry: Math.round(height * 0.12),
      },
    ];
  }

  if (normalizedRoomType === 'kitchen') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.12),
        top: Math.round(height * 0.24),
        width: Math.round(width * 0.76),
        height: Math.round(height * 0.44),
      },
      {
        type: 'rect',
        left: Math.round(width * 0.16),
        top: Math.round(height * 0.58),
        width: Math.round(width * 0.68),
        height: Math.round(height * 0.16),
      },
    ];
  }

  return [
    {
      type: 'rect',
      left: Math.round(width * 0.14),
      top: Math.round(height * 0.22),
      width: Math.round(width * 0.72),
      height: Math.round(height * 0.6),
    },
  ];
}

async function buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const shapes = buildMaskShapes(metadata, presetKey, roomType);
  const shapeMarkup = shapes
    .map((shape) => {
      if (shape.type === 'ellipse') {
        return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" fill="white" />`;
      }

      return `<rect x="${shape.left}" y="${shape.top}" width="${shape.width}" height="${shape.height}" rx="${Math.round(Math.min(width, height) * 0.03)}" ry="${Math.round(Math.min(width, height) * 0.03)}" fill="white" />`;
    })
    .join('');
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="black" />
      ${shapeMarkup}
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'fill' })
    .blur(1.2)
    .png()
    .toBuffer();
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
  return sortVisionVariants(variants.map(serializeMediaVariant));
}

export function getVisionPresetCatalog() {
  return listVisionPresets();
}

export async function listMediaVariants(assetId) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const variants = await MediaVariantModel.find({ mediaId: assetId })
    .sort({ createdAt: -1 })
    .lean();
  return sortVisionVariants(variants.map(serializeMediaVariant));
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
    const roomPromptAddon = getRoomPromptAddon(resolvedRoomType);
    const presetPromptAddon = getPresetPromptAddon(preset.key, resolvedRoomType);
    const fullPrompt = [
      preset.basePrompt,
      roomPromptAddon,
      presetPromptAddon,
      getUniversalRealismGuardrails(),
    ]
      .filter(Boolean)
      .join(' ');
    job.input = {
      ...(job.input || {}),
      fullPrompt,
    };
    let createdVariants = [];
    const stored = await readStoredAsset({
      storageProvider: asset.storageProvider,
      storageKey: asset.storageKey,
    });
    const sourceImageBase64 = stored.buffer.toString('base64');

    if (preset.providerPreference === 'replicate') {
      const maskBuffer = await buildInpaintingMaskBuffer(
        stored.buffer,
        preset.key,
        resolvedRoomType,
      );
      const providerOutputs = await runReplicateInpainting({
        image: stored.buffer,
        mask: maskBuffer,
        model: preset.replicateModel,
        prompt: fullPrompt,
        strength: preset.strength,
        outputCount: preset.outputCount || 2,
        guidanceScale: preset.guidanceScale,
        numInferenceSteps: preset.numInferenceSteps,
      });

      createdVariants = await Promise.all(
        providerOutputs.map(async (output, index) => {
          const buffer = await convertReplicateOutputToBuffer(output);
          const review = await reviewVisionVariant({
            property: null,
            roomLabel: asset.roomLabel,
            presetKey: preset.key,
            variantCategory: preset.category,
            mimeType: 'image/jpeg',
            sourceImageBase64,
            variantImageBase64: buffer.toString('base64'),
          });
          const overallScore = calculateVisionReviewOverallScore(review);
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
              roomPromptAddon,
              presetPromptAddon,
              providerSourceUrl: getProviderSourceUrl(output),
              review: {
                ...review,
                overallScore,
              },
            },
          });

          return serializeMediaVariant(variant.toObject());
        }),
      );
    } else {
      const rendered = await renderVariantBuffer(stored.buffer, preset.key, resolvedRoomType);
      const review = await reviewVisionVariant({
        property: null,
        roomLabel: asset.roomLabel,
        presetKey: preset.key,
        variantCategory: preset.category,
        mimeType: 'image/jpeg',
        sourceImageBase64,
        variantImageBase64: rendered.buffer.toString('base64'),
      });
      const overallScore = calculateVisionReviewOverallScore(review);
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
          review: {
            ...review,
            overallScore,
          },
        },
      });

      createdVariants = [serializeMediaVariant(variant.toObject())];
    }

    createdVariants = sortVisionVariants(createdVariants);
    job.status = 'completed';
    job.outputVariantIds = createdVariants.map((variant) => variant.id);
    job.selectedVariantId = createdVariants[0]?.id || null;
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
