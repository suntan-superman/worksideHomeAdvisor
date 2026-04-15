import { createHash } from 'node:crypto';

import mongoose from 'mongoose';
import sharp from 'sharp';

import {
  buildMediaVariantUrl,
  buildTemporaryStoredAssetUrl,
  readStoredAsset,
  saveBinaryBuffer,
} from '../../services/storageService.js';
import { reviewVisionVariant } from '../../services/photoAnalysisService.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import {
  isOpenAiImageEditConfigured,
  runOpenAIImageEdit,
} from './openai-image.provider.js';
import { runReplicateInpainting } from './replicate-provider.service.js';
import {
  buildActiveVariantQuery,
  buildVariantLifecycleFields,
} from './variant-lifecycle.service.js';
import { orchestrateVisionJob } from './vision-orchestrator.service.js';
import {
  calculateObjectRemovalScore,
  getReplicateSettings,
  resolveVisionUserPlan,
} from './vision-orchestrator.helpers.js';
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
    mode: document.mode || 'preset',
    instructions: document.instructions || '',
    normalizedPlan: document.normalizedPlan || null,
    originalUrl: document.originalUrl || '',
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
    attemptCount: Number(document.attemptCount || 0),
    maxAttempts: Number(document.maxAttempts || 1),
    currentStage: document.currentStage || 'initial',
    fallbackMode: document.fallbackMode || null,
    failureReason: document.failureReason || '',
    cancelledAt: document.cancelledAt || null,
    outputUrls: variants.map((variant) => variant.imageUrl).filter(Boolean),
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

export function normalizeRoomType(value) {
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
  if (
    normalized.includes('exterior') ||
    normalized.includes('front') ||
    normalized.includes('backyard') ||
    normalized.includes('rear') ||
    normalized.includes('yard') ||
    normalized.includes('patio') ||
    normalized.includes('deck') ||
    normalized.includes('pool')
  ) {
    return 'exterior';
  }

  return normalized || 'unknown';
}

function extractRequestedPhrase(text, expression) {
  const match = String(text || '').match(expression);
  if (!match?.[1]) {
    return '';
  }

  return match[1]
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/\s+(look|finish|tone|color|colour)$/i, '')
    .trim();
}

export function buildFreeformEnhancementPlan(instructions, roomType) {
  const normalizedInstructions = String(instructions || '').toLowerCase();
  const removeObjects = [];
  const styleChanges = [];
  const exteriorFeatures = [];

  if (/furniture|couch|sofa|chair|table|bed/.test(normalizedInstructions)) {
    removeObjects.push('furniture');
  }
  if (/clutter|boxes|toys|countertop|counter/.test(normalizedInstructions)) {
    removeObjects.push('clutter');
  }
  if (/light|brighten|brighter/.test(normalizedInstructions)) {
    styleChanges.push('brighter lighting');
  }

  if (/plant|landscap|garden|shrub|tree|flower/.test(normalizedInstructions)) {
    exteriorFeatures.push('plants');
  }
  if (/fixture|sconce|lantern|path light/.test(normalizedInstructions)) {
    exteriorFeatures.push('fixtures');
  }
  if (/pool/.test(normalizedInstructions)) {
    exteriorFeatures.push('pool');
  }
  if (/pond|water feature|waterfall/.test(normalizedInstructions)) {
    exteriorFeatures.push('pond');
  }
  if (/patio|deck|outdoor seating|entertain/.test(normalizedInstructions)) {
    exteriorFeatures.push('entertaining');
  }

  const flooring = extractRequestedPhrase(
    normalizedInstructions,
    /floor(?:ing)?(?:\s+(?:to|into|as|in|with))?\s+([a-z\s\/-]{3,40}?)(?=,| and | with | while | but |\.|$)/i,
  );
  const wallColor = extractRequestedPhrase(
    normalizedInstructions,
    /wall(?:s| color| colours| colors)?(?:\s+(?:to|into|as|in))?\s+([a-z\s\/-]{3,40}?)(?=,| and | with | while | but |\.|$)/i,
  );
  const cabinetColor =
    extractRequestedPhrase(
      normalizedInstructions,
      /cabinet(?:s|ry)?(?:\s+color)?(?:\s+(?:to|into|as|in))?\s+([a-z\s\/-]{3,40}?)(?=,| and | with | while | but |\.|$)/i,
    ) ||
    extractRequestedPhrase(
      normalizedInstructions,
      /paint\s+cabinet(?:s|ry)?\s+([a-z\s\/-]{3,40}?)(?=,| and | with | while | but |\.|$)/i,
    );
  const countertopMaterial =
    extractRequestedPhrase(
      normalizedInstructions,
      /with\s+([a-z\s\/-]{3,40}?)\s+countertop(?:s)?(?=,| and | while | but |\.|$)/i,
    ) ||
    extractRequestedPhrase(
      normalizedInstructions,
      /with\s+([a-z\s\/-]{3,40}?)\s+(?:counters|counter)/i,
    ) ||
    extractRequestedPhrase(
      normalizedInstructions,
      /countertop(?:s)?(?:\s+(?:to|into|as|with|in))?\s+(?!and\b)([a-z\s\/-]{3,40}?)(?=,| and | while | but |\.|$)/i,
    );
  const exteriorZone = /backyard|rear yard|patio|deck/.test(normalizedInstructions)
    ? 'backyard'
    : /front yard|front exterior|entry|curb appeal/.test(normalizedInstructions)
      ? 'frontyard'
      : '';

  return {
    removeObjects: [...new Set(removeObjects)],
    styleChanges: [...new Set(styleChanges)],
    roomType: normalizeRoomType(roomType),
    flooring,
    wallColor,
    cabinetColor,
    countertopMaterial,
    exteriorFeatures: [...new Set(exteriorFeatures)],
    exteriorZone,
    lighting: /light|brighten|brighter/.test(normalizedInstructions) ? 'brighter' : '',
  };
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

function getUniversalRealismGuardrails(presetKey = '') {
  const normalizedPresetKey = String(presetKey || '');
  if (normalizedPresetKey.startsWith('paint_') || normalizedPresetKey.startsWith('floor_')) {
    return 'Keep the result realistic, natural, and suitable for residential real estate marketing. Preserve room structure, layout, perspective, windows, trim, ceilings, shelving, and permanent fixtures. Only change the specifically requested finish surface, and do not invent furniture, decor, architecture, or unrelated upgrades.';
  }

  return 'Keep the result realistic, natural, and suitable for residential real estate marketing. Do not distort walls, windows, doors, ceilings, floors, trim, or permanent fixtures. Do not invent architecture or major finishes that are not already present.';
}

function getStrictInpaintingRules() {
  return 'STRICT RULES: Do NOT add new objects. Do NOT change layout or structure. Do NOT modify walls, windows, or lighting unless explicitly requested. Preserve perspective and proportions. ONLY perform the requested task.';
}

function shouldUseVisionCache({ forceRegenerate, requestedMode, preset }) {
  if (forceRegenerate) {
    return false;
  }

  // Concept previews and freeform are too quality-sensitive to trust stale cache.
  if (requestedMode === 'freeform' || preset?.category === 'concept_preview') {
    return false;
  }

  return true;
}

function getPresetPromptAddon(presetKey, roomType) {
  const normalizedRoomType = normalizeRoomType(roomType);
  const wallColorPresetKeys = new Set([
    'paint_warm_neutral',
    'paint_bright_white',
    'paint_soft_greige',
  ]);
  const flooringPresetKeys = new Set([
    'floor_light_wood',
    'floor_medium_wood',
    'floor_dark_hardwood',
    'floor_lvp_neutral',
    'floor_tile_stone',
  ]);

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

  if (presetKey === 'cleanup_empty_room') {
    return 'Refine an already-cleared room concept. Remove leftover fragments, rug remnants, patchy floor transitions, and uneven wall or trim artifacts while preserving all structural elements, built-ins, shelving, windows, doors, and permanent fixtures.';
  }

  if (wallColorPresetKeys.has(presetKey)) {
    return 'Repaint ONLY the masked wall regions. The wall color must change clearly and visibly at first glance. Do not leave walls close to the original color. Preserve trim, baseboards, outlets, windows, doors, ceiling, shadows, flooring, furniture, built-ins, and room geometry exactly. Do not add or remove objects.';
  }

  if (presetKey === 'floor_dark_hardwood') {
    return 'Change only the flooring concept to a distinctly darker walnut or espresso hardwood tone. Preserve sunlight pattern, reflections, baseboards, room brightness, and geometry. The floor should read noticeably darker than the original, not just slightly warmer or brighter.';
  }

  if (flooringPresetKeys.has(presetKey)) {
    return 'Change ONLY the masked floor region. The flooring material and tone must read clearly differently at first glance. Preserve walls, baseboards, windows, furniture, shadows, perspective, and room geometry exactly. Do not add rugs, decor, furniture, reflections, or new architecture.';
  }

  if (
    presetKey === 'kitchen_white_cabinets_granite' ||
    presetKey === 'kitchen_white_cabinets_quartz' ||
    presetKey === 'kitchen_green_cabinets_granite' ||
    presetKey === 'kitchen_green_cabinets_quartz'
  ) {
    return 'Preserve the true cabinet layout, door lines, hardware placement, backsplash alignment, sink location, appliances, and countertop edges. Keep the kitchen realistic and coherent.';
  }

  if (presetKey === 'exterior_curb_appeal_refresh') {
    return 'Refresh landscaping, plants, and exterior fixtures while preserving the true home structure, windows, doors, driveway, walkway placement, and lot boundaries.';
  }

  if (presetKey === 'backyard_entertaining_refresh') {
    return 'Improve backyard plants, lighting, and entertaining feel while preserving fences, patio geometry, hardscape boundaries, and the true house structure.';
  }

  if (presetKey === 'backyard_pool_preview') {
    return 'If adding a pool or water feature concept, keep it proportional to the yard and preserve fences, patio geometry, access paths, drainage logic, and the true home structure.';
  }

  return '';
}

async function calculateVisualChangeRatio(sourceBuffer, variantBuffer, options = {}) {
  const width = 256;
  const height = 256;
  const region = options.region || null;
  const src = await sharp(sourceBuffer)
    .rotate()
    .resize(width, height, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const next = await sharp(variantBuffer)
    .rotate()
    .resize(width, height, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const left = Math.max(0, Math.min(width - 1, Math.round((region?.left || 0) * width)));
  const top = Math.max(0, Math.min(height - 1, Math.round((region?.top || 0) * height)));
  const right = Math.max(
    left + 1,
    Math.min(width, Math.round(((region?.left || 0) + (region?.width || 1)) * width)),
  );
  const bottom = Math.max(
    top + 1,
    Math.min(height, Math.round(((region?.top || 0) + (region?.height || 1)) * height)),
  );
  const pixelCount = (right - left) * (bottom - top);
  let changedPixels = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * width + x) * 3;
      const delta =
        (Math.abs(src[offset] - next[offset]) +
          Math.abs(src[offset + 1] - next[offset + 1]) +
          Math.abs(src[offset + 2] - next[offset + 2])) /
        3;
      if (delta >= 18) {
        changedPixels += 1;
      }
    }
  }

  return Number((changedPixels / pixelCount).toFixed(4));
}

function getPresetEvaluationRegions(presetKey) {
  if (presetKey === 'remove_furniture') {
    return {
      focusRegion: { left: 0.03, top: 0.4, width: 0.94, height: 0.56 },
      structureRegion: { left: 0, top: 0, width: 1, height: 0.52 },
    };
  }

  if (presetKey === 'cleanup_empty_room') {
    return {
      focusRegion: { left: 0.03, top: 0.38, width: 0.94, height: 0.58 },
      structureRegion: { left: 0, top: 0, width: 1, height: 0.52 },
    };
  }

  if (String(presetKey || '').startsWith('floor_')) {
    return {
      focusRegion: { left: 0.02, top: 0.5, width: 0.96, height: 0.48 },
      structureRegion: { left: 0, top: 0, width: 1, height: 0.5 },
    };
  }

  return {
    focusRegion: { left: 0, top: 0, width: 1, height: 1 },
    structureRegion: { left: 0, top: 0, width: 1, height: 0.52 },
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

async function buildBinaryMaskPngBuffer({
  binaryMask,
  inputWidth,
  inputHeight,
  outputWidth,
  outputHeight,
}) {
  const maskValues = Buffer.alloc(binaryMask.length);
  for (let index = 0; index < binaryMask.length; index += 1) {
    maskValues[index] = binaryMask[index] ? 255 : 0;
  }

  return sharp(maskValues, {
    raw: { width: inputWidth, height: inputHeight, channels: 1 },
  })
    .resize(outputWidth, outputHeight, {
      fit: 'fill',
      kernel: sharp.kernel.nearest,
    })
    .threshold(128, { grayscale: true })
    .png()
    .toBuffer();
}

async function buildTemporaryReplicateInputUrls({
  propertyId,
  imageBuffer,
  maskBuffer,
  presetKey,
  providerKey,
}) {
  const imageMetadata = await sharp(imageBuffer).rotate().metadata();
  const width = Number(imageMetadata.width || 0);
  const height = Number(imageMetadata.height || 0);
  const normalizedImageBuffer = await sharp(imageBuffer).rotate().png().toBuffer();
  const normalizedMaskBuffer = await sharp(maskBuffer)
    .rotate()
    .resize(width, height, {
      fit: 'fill',
      kernel: sharp.kernel.nearest,
    })
    .removeAlpha()
    .greyscale()
    .threshold(128, { grayscale: true })
    .blur(getFinishMaskBlurRadius(presetKey))
    .png()
    .toBuffer();

  const [imageStorage, maskStorage] = await Promise.all([
    saveBinaryBuffer({
      propertyId,
      mimeType: 'image/png',
      buffer: normalizedImageBuffer,
    }),
    saveBinaryBuffer({
      propertyId,
      mimeType: 'image/png',
      buffer: normalizedMaskBuffer,
    }),
  ]);

  const imageUrl = buildTemporaryStoredAssetUrl({
    storageProvider: imageStorage.storageProvider,
    storageKey: imageStorage.storageKey,
    mimeType: 'image/png',
  });
  const maskUrl = buildTemporaryStoredAssetUrl({
    storageProvider: maskStorage.storageProvider,
    storageKey: maskStorage.storageKey,
    mimeType: 'image/png',
  });

  if (String(presetKey || '').startsWith('floor_') || String(presetKey || '').startsWith('paint_')) {
    console.info('vision_replicate_finish_inputs_ready', {
      presetKey,
      providerKey,
      imageUrl,
      maskUrl,
      width,
      height,
    });
  }

  return {
    imageUrl,
    maskUrl,
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value || 0)));
}

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(Number(value || 0))));
}

function isWallPreset(presetKey = '') {
  return String(presetKey || '').startsWith('paint_');
}

function isFloorPreset(presetKey = '') {
  return String(presetKey || '').startsWith('floor_');
}

function getFinishMaskBlurRadius(presetKey = '') {
  if (isWallPreset(presetKey)) {
    return 0.6;
  }
  if (isFloorPreset(presetKey)) {
    return 0.8;
  }
  return 1.2;
}

const WALL_MASK_STRATEGIES = Object.freeze({
  SEMANTIC: 'semantic_wall',
  ADAPTIVE: 'adaptive_wall',
  FALLBACK: 'fallback_wall',
});

function mixValue(source, target, ratio) {
  return Number(source || 0) + (Number(target || 0) - Number(source || 0)) * clamp01(ratio);
}

function mixHue(sourceHue, targetHue, ratio) {
  const source = clamp01(sourceHue);
  const target = clamp01(targetHue);
  const delta = ((((target - source) % 1) + 1.5) % 1) - 0.5;
  return (source + delta * clamp01(ratio) + 1) % 1;
}

function rgbToHsl(red, green, blue) {
  const r = clamp01(Number(red || 0) / 255);
  const g = clamp01(Number(green || 0) / 255);
  const b = clamp01(Number(blue || 0) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / Math.max(0.0001, max + min);

  let hue = 0;
  if (max === r) {
    hue = (g - b) / delta + (g < b ? 6 : 0);
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  return {
    h: (hue / 6) % 1,
    s: saturation,
    l: lightness,
  };
}

function hueToRgb(channelLeft, channelCenter, channelRight) {
  let value = channelRight;
  if (channelRight < 0) {
    value += 1;
  }
  if (channelRight > 1) {
    value -= 1;
  }

  if (value < 1 / 6) {
    return channelLeft + (channelCenter - channelLeft) * 6 * value;
  }
  if (value < 1 / 2) {
    return channelCenter;
  }
  if (value < 2 / 3) {
    return channelLeft + (channelCenter - channelLeft) * (2 / 3 - value) * 6;
  }
  return channelLeft;
}

function hslToRgb(hue, saturation, lightness) {
  const h = clamp01(hue);
  const s = clamp01(saturation);
  const l = clamp01(lightness);

  if (s === 0) {
    const grey = clampByte(l * 255);
    return [grey, grey, grey];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    clampByte(hueToRgb(p, q, h + 1 / 3) * 255),
    clampByte(hueToRgb(p, q, h) * 255),
    clampByte(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

function medianChannel(values = [], fallback = 128) {
  if (!values.length) {
    return fallback;
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? fallback;
}

function pseudoRandom01(...values) {
  const seed = values.reduce(
    (sum, value, index) => sum + Number(value || 0) * (12.9898 + index * 37.719),
    0,
  );
  const noise = Math.sin(seed) * 43758.5453123;
  return noise - Math.floor(noise);
}

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const normalized = clamp01((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function buildLocalWallPaintToneConfig(presetKey) {
  if (presetKey === 'paint_bright_white') {
    return {
      targetHue: 34 / 360,
      targetSaturation: 0.015,
      targetLightness: 1,
      targetHueMix: 1,
      targetSaturationMix: 1,
      lightnessMix: 1,
      additionalLift: 0.34,
      blendMix: 0.999,
      alphaExponent: 0.64,
      minBlend: 0.95,
      shadingRange: 0.095,
    };
  }

  if (presetKey === 'paint_soft_greige') {
    return {
      targetHue: 24 / 360,
      targetSaturation: 0.18,
      targetLightness: 0.7,
      targetHueMix: 1,
      targetSaturationMix: 1,
      lightnessMix: 1,
      additionalLift: 0.065,
      blendMix: 0.999,
      alphaExponent: 0.52,
      minBlend: 0.96,
      shadingRange: 0.12,
    };
  }

  return {
      targetHue: 28 / 360,
    targetSaturation: 0.2,
    targetLightness: 0.75,
    targetHueMix: 1,
    targetSaturationMix: 1,
    lightnessMix: 1,
    additionalLift: 0.075,
    blendMix: 0.999,
    alphaExponent: 0.56,
    minBlend: 0.96,
    shadingRange: 0.12,
  };
}

function buildLocalFloorToneConfig(presetKey) {
  if (presetKey === 'floor_light_wood') {
    return {
      kind: 'wood',
      targetHue: 38 / 360,
      targetSaturation: 0.18,
      targetLightness: 0.82,
      targetHueMix: 0.98,
      targetSaturationMix: 0.94,
      lightnessMix: 1,
      blendMix: 0.997,
      alphaExponent: 0.62,
      minBlend: 0.93,
      shadingScale: 0.36,
      additionalLift: 0.11,
      contrastBoost: 0.004,
    };
  }

  if (presetKey === 'floor_dark_hardwood') {
    return {
      kind: 'wood',
      targetHue: 24 / 360,
      targetSaturation: 0.48,
      targetLightness: 0.2,
      targetHueMix: 0.96,
      targetSaturationMix: 0.96,
      lightnessMix: 0.98,
      blendMix: 0.985,
      alphaExponent: 0.72,
      minBlend: 0.86,
      shadingScale: 0.6,
      additionalLift: 0.015,
      contrastBoost: 0.015,
    };
  }

  if (presetKey === 'floor_medium_wood') {
    return {
      kind: 'wood',
      targetHue: 28 / 360,
      targetSaturation: 0.34,
      targetLightness: 0.38,
      targetHueMix: 0.94,
      targetSaturationMix: 0.94,
      lightnessMix: 0.94,
      blendMix: 0.975,
      alphaExponent: 0.74,
      minBlend: 0.84,
      shadingScale: 0.58,
      additionalLift: 0.012,
      contrastBoost: 0.012,
    };
  }

  if (presetKey === 'floor_lvp_neutral') {
    return {
      kind: 'wood',
      targetHue: 30 / 360,
      targetSaturation: 0.12,
      targetLightness: 0.52,
      targetHueMix: 0.9,
      targetSaturationMix: 0.88,
      lightnessMix: 0.9,
      blendMix: 0.965,
      alphaExponent: 0.76,
      minBlend: 0.82,
      shadingScale: 0.56,
      additionalLift: 0.008,
      contrastBoost: 0.008,
    };
  }

  if (presetKey === 'floor_tile_stone') {
    return {
      kind: 'tile',
      targetHue: 34 / 360,
      targetSaturation: 0.075,
      targetLightness: 0.78,
      groutHue: 34 / 360,
      groutSaturation: 0.025,
      groutLightness: 0.9,
      groutWidth: 0.085,
      groutFeather: 0.02,
      tileAspect: 1.08,
      topRowHeight: 16,
      bottomRowHeight: 56,
      blendMix: 1,
      alphaExponent: 0.22,
      minBlend: 1,
      shadingScale: 0.16,
      tileVariation: 0.015,
      veiningStrength: 0.004,
      planeGradientStrength: 0.018,
      sourceShadingRetention: 0.08,
      macroNoiseStrength: 0.012,
    };
  }

  return {
    kind: 'wood',
    targetHue: 34 / 360,
    targetSaturation: 0.26,
    targetLightness: 0.66,
    targetHueMix: 0.92,
    targetSaturationMix: 0.92,
    lightnessMix: 0.94,
    blendMix: 0.975,
    alphaExponent: 0.74,
    minBlend: 0.86,
    shadingScale: 0.56,
    additionalLift: 0.014,
    contrastBoost: 0.01,
  };
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

  if (preset.key === 'cleanup_empty_room') {
    return {
      preset,
      label: 'Empty-Room Cleanup Preview',
      warning:
        'This is a concept preview only. It refines a cleared-room draft for planning and seller discussion, not as silent replacement of the original photo.',
      summary:
        'A lighter cleanup pass that smooths leftover artifacts after furniture removal while preserving the room structure.',
      differenceHint:
        'Look for cleaner floor and wall transitions, fewer leftovers, and a more believable empty-room presentation.',
      effects: ['Artifact cleanup', 'Geometry preservation', 'Clean-room refinement'],
    };
  }

  if (preset.key === 'paint_warm_neutral') {
    return {
      preset,
      label: 'Warm Neutral Wall Preview',
      warning:
        'This is a concept preview only. Use it to discuss potential paint direction, not as a representation of completed improvements.',
      summary:
        'A concept preview that repaints the room in a warm neutral wall color for broader buyer appeal.',
      differenceHint:
        'Focus on the wall-tone shift and the overall calmer feel, not pixel-perfect paint boundaries.',
      effects: ['Wall color concept', 'Warm neutral palette', 'Planning preview'],
    };
  }

  if (preset.key === 'paint_bright_white') {
    return {
      preset,
      label: 'Bright White Wall Preview',
      warning:
        'This is a concept preview only. Use it to discuss potential paint direction, not as a representation of completed improvements.',
      summary:
        'A concept preview that brightens the room with a crisp white wall palette.',
      differenceHint:
        'Look for a cleaner, brighter wall presentation and stronger reflected light in the room.',
      effects: ['Wall color concept', 'Bright white palette', 'Planning preview'],
    };
  }

  if (preset.key === 'paint_soft_greige') {
    return {
      preset,
      label: 'Soft Greige Wall Preview',
      warning:
        'This is a concept preview only. Use it to discuss potential paint direction, not as a representation of completed improvements.',
      summary:
        'A concept preview that updates the room with a softer greige designer-neutral wall tone.',
      differenceHint:
        'Look for a more current-market neutral feel while preserving the original room layout and structure.',
      effects: ['Wall color concept', 'Greige palette', 'Planning preview'],
    };
  }

  if (preset.key === 'floor_light_wood') {
    return {
      preset,
      label: 'Light Wood Floor Preview',
      warning:
        'This is a concept preview only. Flooring direction, material, and installation details should be verified separately.',
      summary:
        'A concept preview that updates the floor to a lighter wood tone for a more modern listing feel.',
      differenceHint:
        'Look at the floor material and room brightness together while checking that the perspective still feels believable.',
      effects: ['Flooring concept', 'Light wood tone', 'Planning preview'],
    };
  }

  if (preset.key === 'floor_medium_wood') {
    return {
      preset,
      label: 'Medium Wood Floor Preview',
      warning:
        'This is a concept preview only. Flooring direction, material, and installation details should be verified separately.',
      summary:
        'A concept preview that updates the floor to a warmer medium-tone wood finish.',
      differenceHint:
        'Look for a warmer and more elevated floor treatment without losing realistic room geometry.',
      effects: ['Flooring concept', 'Medium wood tone', 'Planning preview'],
    };
  }

  if (preset.key === 'floor_dark_hardwood') {
    return {
      preset,
      label: 'Dark Hardwood Floor Preview',
      warning:
        'This is a concept preview only. Flooring direction, material, and installation details should be verified separately.',
      summary:
        'A concept preview that gives the room a darker, richer hardwood floor treatment.',
      differenceHint:
        'Look for a stronger contrast and more upscale floor feel while confirming the perspective remains realistic.',
      effects: ['Flooring concept', 'Dark hardwood tone', 'Planning preview'],
    };
  }

  if (preset.key === 'floor_lvp_neutral') {
    return {
      preset,
      label: 'Neutral LVP Floor Preview',
      warning:
        'This is a concept preview only. Flooring direction, material, and installation details should be verified separately.',
      summary:
        'A concept preview that updates the floor with a neutral LVP look suited to practical resale improvements.',
      differenceHint:
        'Look for a cleaner, more updated floor material while preserving the true room structure.',
      effects: ['Flooring concept', 'Neutral LVP look', 'Planning preview'],
    };
  }

  if (preset.key === 'floor_tile_stone') {
    return {
      preset,
      label: 'Tile / Stone Floor Preview',
      warning:
        'This is a concept preview only. Flooring direction, material, and installation details should be verified separately.',
      summary:
        'A concept preview that shows how tile or stone flooring could update the room or exterior surface.',
      differenceHint:
        'Look for cleaner surface material and believable tile/stone alignment rather than exact install detail.',
      effects: ['Flooring concept', 'Tile / stone surface', 'Planning preview'],
    };
  }

  if (preset.key === 'kitchen_white_cabinets_granite' || preset.key === 'kitchen_white_cabinets_quartz') {
    return {
      preset,
      label: 'White Kitchen Upgrade Preview',
      warning:
        'This is a concept preview only. Cabinet painting and countertop replacement details should be reviewed separately before budgeting.',
      summary:
        'A concept preview that shows a brighter kitchen direction with white cabinetry and upgraded counters.',
      differenceHint:
        'Look at cabinetry tone, counter material, and overall kitchen brightness while checking that cabinet lines stay realistic.',
      effects: ['Kitchen concept', 'White cabinetry', preset.key.includes('quartz') ? 'Quartz counters' : 'Granite counters'],
    };
  }

  if (preset.key === 'kitchen_green_cabinets_granite' || preset.key === 'kitchen_green_cabinets_quartz') {
    return {
      preset,
      label: 'Green Kitchen Upgrade Preview',
      warning:
        'This is a concept preview only. Cabinet painting and countertop replacement details should be reviewed separately before budgeting.',
      summary:
        'A concept preview that shows a more designer-led kitchen direction with green cabinetry and upgraded counters.',
      differenceHint:
        'Look for a more distinctive cabinet palette and upgraded counter feel while preserving the true kitchen layout.',
      effects: ['Kitchen concept', 'Green cabinetry', preset.key.includes('quartz') ? 'Quartz counters' : 'Granite counters'],
    };
  }

  if (preset.key === 'exterior_curb_appeal_refresh') {
    return {
      preset,
      label: 'Curb Appeal Upgrade Preview',
      warning:
        'This is a concept preview only. Exterior landscaping and fixture changes are shown for planning discussion, not as completed work.',
      summary:
        'A concept preview that upgrades the exterior first impression with stronger landscaping and fixture cues.',
      differenceHint:
        'Look for improved entry feel, cleaner plant beds, and stronger front-exterior presentation while preserving the true structure.',
      effects: ['Exterior concept', 'Landscaping refresh', 'Fixture upgrade cues'],
    };
  }

  if (preset.key === 'backyard_entertaining_refresh') {
    return {
      preset,
      label: 'Backyard Refresh Preview',
      warning:
        'This is a concept preview only. Backyard improvements are shown for planning discussion, not as completed work.',
      summary:
        'A concept preview that reshapes the backyard into a more intentional entertaining space with plants and fixtures.',
      differenceHint:
        'Look for a more usable and inviting backyard feel while confirming the lot boundaries and hardscape remain believable.',
      effects: ['Backyard concept', 'Plants and fixture upgrades', 'Entertaining focus'],
    };
  }

  if (preset.key === 'backyard_pool_preview') {
    return {
      preset,
      label: 'Pool / Water Feature Preview',
      warning:
        'This is a concept preview only. Pool or water-feature feasibility, engineering, and permitting must be reviewed separately.',
      summary:
        'A concept preview that explores how a pool or water feature could change the backyard experience.',
      differenceHint:
        'Focus on the overall backyard transformation and scale, not exact construction detail.',
      effects: ['Backyard concept', 'Pool / water feature', 'Planning preview'],
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

export function calculateVisionReviewOverallScore(review = {}) {
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

    const leftPresetKey = left?.metadata?.presetKey || left?.variantType || '';
    const rightPresetKey = right?.metadata?.presetKey || right?.variantType || '';
    if (leftPresetKey === 'remove_furniture' && rightPresetKey === 'remove_furniture') {
      const leftObjectRemovalScore = Number(left?.metadata?.review?.objectRemovalScore || 0);
      const rightObjectRemovalScore = Number(right?.metadata?.review?.objectRemovalScore || 0);
      if (leftObjectRemovalScore !== rightObjectRemovalScore) {
        return rightObjectRemovalScore - leftObjectRemovalScore;
      }

      const leftRemainingOverlap = Number(
        left?.metadata?.review?.remainingFurnitureOverlapRatio || 0,
      );
      const rightRemainingOverlap = Number(
        right?.metadata?.review?.remainingFurnitureOverlapRatio || 0,
      );
      if (leftRemainingOverlap !== rightRemainingOverlap) {
        return leftRemainingOverlap - rightRemainingOverlap;
      }

      const leftLargestPersistence = Number(
        left?.metadata?.review?.largestComponentPersistenceRatio || 0,
      );
      const rightLargestPersistence = Number(
        right?.metadata?.review?.largestComponentPersistenceRatio || 0,
      );
      if (leftLargestPersistence !== rightLargestPersistence) {
        return leftLargestPersistence - rightLargestPersistence;
      }

      const leftNewFurnitureAddition = Number(
        left?.metadata?.review?.newFurnitureAdditionRatio || 0,
      );
      const rightNewFurnitureAddition = Number(
        right?.metadata?.review?.newFurnitureAdditionRatio || 0,
      );
      if (leftNewFurnitureAddition !== rightNewFurnitureAddition) {
        return leftNewFurnitureAddition - rightNewFurnitureAddition;
      }
    }

    if (
      leftPresetKey === 'floor_dark_hardwood' &&
      rightPresetKey === 'floor_dark_hardwood'
    ) {
      const leftFurnitureCoverageIncrease = Number(
        left?.metadata?.review?.furnitureCoverageIncreaseRatio || 0,
      );
      const rightFurnitureCoverageIncrease = Number(
        right?.metadata?.review?.furnitureCoverageIncreaseRatio || 0,
      );
      if (leftFurnitureCoverageIncrease !== rightFurnitureCoverageIncrease) {
        return leftFurnitureCoverageIncrease - rightFurnitureCoverageIncrease;
      }

      const leftMaskedLuminanceDelta = Number(
        left?.metadata?.review?.maskedLuminanceDelta || 0,
      );
      const rightMaskedLuminanceDelta = Number(
        right?.metadata?.review?.maskedLuminanceDelta || 0,
      );
      if (leftMaskedLuminanceDelta !== rightMaskedLuminanceDelta) {
        return leftMaskedLuminanceDelta - rightMaskedLuminanceDelta;
      }
    }

    if (
      String(leftPresetKey || '').startsWith('floor_') &&
      String(rightPresetKey || '').startsWith('floor_')
    ) {
      const leftFurnitureCoverageIncrease = Number(
        left?.metadata?.review?.furnitureCoverageIncreaseRatio || 0,
      );
      const rightFurnitureCoverageIncrease = Number(
        right?.metadata?.review?.furnitureCoverageIncreaseRatio || 0,
      );
      if (leftFurnitureCoverageIncrease !== rightFurnitureCoverageIncrease) {
        return leftFurnitureCoverageIncrease - rightFurnitureCoverageIncrease;
      }

      if (leftPresetKey === 'floor_tile_stone' && rightPresetKey === 'floor_tile_stone') {
        const leftOutsideMaskChange = Number(
          left?.metadata?.review?.outsideMaskChangeRatio || 0,
        );
        const rightOutsideMaskChange = Number(
          right?.metadata?.review?.outsideMaskChangeRatio || 0,
        );
        if (leftOutsideMaskChange !== rightOutsideMaskChange) {
          return leftOutsideMaskChange - rightOutsideMaskChange;
        }

        const leftTopHalfChange = Number(left?.metadata?.review?.topHalfChangeRatio || 0);
        const rightTopHalfChange = Number(right?.metadata?.review?.topHalfChangeRatio || 0);
        if (leftTopHalfChange !== rightTopHalfChange) {
          return leftTopHalfChange - rightTopHalfChange;
        }

        const leftMaskedColorShift = Number(
          left?.metadata?.review?.maskedColorShiftRatio || 0,
        );
        const rightMaskedColorShift = Number(
          right?.metadata?.review?.maskedColorShiftRatio || 0,
        );
        if (leftMaskedColorShift !== rightMaskedColorShift) {
          return rightMaskedColorShift - leftMaskedColorShift;
        }
      }

      const leftMaskedChange = Number(left?.metadata?.review?.maskedChangeRatio || 0);
      const rightMaskedChange = Number(right?.metadata?.review?.maskedChangeRatio || 0);
      if (leftMaskedChange !== rightMaskedChange) {
        return rightMaskedChange - leftMaskedChange;
      }

      const leftFocusChange = Number(left?.metadata?.review?.focusRegionChangeRatio || 0);
      const rightFocusChange = Number(right?.metadata?.review?.focusRegionChangeRatio || 0);
      if (leftFocusChange !== rightFocusChange) {
        return rightFocusChange - leftFocusChange;
      }
    }

    if (
      String(leftPresetKey || '').startsWith('paint_') &&
      String(rightPresetKey || '').startsWith('paint_')
    ) {
      const leftNewFurnitureAddition = Number(
        left?.metadata?.review?.newFurnitureAdditionRatio || 0,
      );
      const rightNewFurnitureAddition = Number(
        right?.metadata?.review?.newFurnitureAdditionRatio || 0,
      );
      if (leftNewFurnitureAddition !== rightNewFurnitureAddition) {
        return leftNewFurnitureAddition - rightNewFurnitureAddition;
      }

      const leftFurnitureCoverageIncrease = Number(
        left?.metadata?.review?.furnitureCoverageIncreaseRatio || 0,
      );
      const rightFurnitureCoverageIncrease = Number(
        right?.metadata?.review?.furnitureCoverageIncreaseRatio || 0,
      );
      if (leftFurnitureCoverageIncrease !== rightFurnitureCoverageIncrease) {
        return leftFurnitureCoverageIncrease - rightFurnitureCoverageIncrease;
      }

      const leftTopHalfChange = Number(left?.metadata?.review?.topHalfChangeRatio || 0);
      const rightTopHalfChange = Number(right?.metadata?.review?.topHalfChangeRatio || 0);
      if (leftTopHalfChange !== rightTopHalfChange) {
        return leftTopHalfChange - rightTopHalfChange;
      }

      const leftHasWallFeatureAddition =
        Number(left?.metadata?.review?.maskedEdgeDensityDelta || 0) > 0.003;
      const rightHasWallFeatureAddition =
        Number(right?.metadata?.review?.maskedEdgeDensityDelta || 0) > 0.003;
      if (leftHasWallFeatureAddition !== rightHasWallFeatureAddition) {
        return leftHasWallFeatureAddition ? 1 : -1;
      }

      if (leftPresetKey === 'paint_bright_white' && rightPresetKey === 'paint_bright_white') {
        const leftOutsideMaskChange = Number(
          left?.metadata?.review?.outsideMaskChangeRatio || 0,
        );
        const rightOutsideMaskChange = Number(
          right?.metadata?.review?.outsideMaskChangeRatio || 0,
        );
        if (leftOutsideMaskChange !== rightOutsideMaskChange) {
          return leftOutsideMaskChange - rightOutsideMaskChange;
        }

        const leftMaskedLuminanceDelta = Number(
          left?.metadata?.review?.maskedLuminanceDelta || 0,
        );
        const rightMaskedLuminanceDelta = Number(
          right?.metadata?.review?.maskedLuminanceDelta || 0,
        );
        if (leftMaskedLuminanceDelta !== rightMaskedLuminanceDelta) {
          return rightMaskedLuminanceDelta - leftMaskedLuminanceDelta;
        }
      }

      const leftMaskedColorShift = Number(left?.metadata?.review?.maskedColorShiftRatio || 0);
      const rightMaskedColorShift = Number(right?.metadata?.review?.maskedColorShiftRatio || 0);
      if (leftMaskedColorShift !== rightMaskedColorShift) {
        return rightMaskedColorShift - leftMaskedColorShift;
      }

      const leftMaskedChange = Number(left?.metadata?.review?.maskedChangeRatio || 0);
      const rightMaskedChange = Number(right?.metadata?.review?.maskedChangeRatio || 0);
      if (leftMaskedChange !== rightMaskedChange) {
        return rightMaskedChange - leftMaskedChange;
      }

      const leftEdgeDelta = Number(left?.metadata?.review?.maskedEdgeDensityDelta || 0);
      const rightEdgeDelta = Number(right?.metadata?.review?.maskedEdgeDensityDelta || 0);
      if (leftEdgeDelta !== rightEdgeDelta) {
        return leftEdgeDelta - rightEdgeDelta;
      }

      const leftOutsideMaskChange = Number(
        left?.metadata?.review?.outsideMaskChangeRatio || 0,
      );
      const rightOutsideMaskChange = Number(
        right?.metadata?.review?.outsideMaskChangeRatio || 0,
      );
      if (leftOutsideMaskChange !== rightOutsideMaskChange) {
        return leftOutsideMaskChange - rightOutsideMaskChange;
      }
    }

    const leftScore = Number(left?.metadata?.review?.overallScore || 0);
    const rightScore = Number(right?.metadata?.review?.overallScore || 0);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftMaskedChange = Number(left?.metadata?.review?.maskedChangeRatio || 0);
    const rightMaskedChange = Number(right?.metadata?.review?.maskedChangeRatio || 0);
    if (leftMaskedChange !== rightMaskedChange) {
      return rightMaskedChange - leftMaskedChange;
    }

    const leftEdgeDelta = Number(left?.metadata?.review?.maskedEdgeDensityDelta || 0);
    const rightEdgeDelta = Number(right?.metadata?.review?.maskedEdgeDensityDelta || 0);
    if (leftEdgeDelta !== rightEdgeDelta) {
      return leftEdgeDelta - rightEdgeDelta;
    }

    return new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime();
  });
}

function getProviderSourceUrl(output) {
  if (typeof output === 'string') {
    return output;
  }

  if (typeof output?.url === 'string') {
    return output.url;
  }

  if (typeof output?.url === 'function') {
    return output.url();
  }

  return null;
}

function resolveWallColorPresetKey(wallColor = '') {
  const normalized = String(wallColor || '').toLowerCase();

  if (normalized.includes('white')) {
    return 'paint_bright_white';
  }
  if (normalized.includes('greige') || normalized.includes('gray') || normalized.includes('grey') || normalized.includes('taupe')) {
    return 'paint_soft_greige';
  }

  return 'paint_warm_neutral';
}

function resolveFlooringPresetKey(flooring = '') {
  const normalized = String(flooring || '').toLowerCase();

  if (normalized.includes('dark')) {
    return 'floor_dark_hardwood';
  }
  if (normalized.includes('tile') || normalized.includes('stone') || normalized.includes('travertine')) {
    return 'floor_tile_stone';
  }
  if (normalized.includes('lvp') || normalized.includes('vinyl') || normalized.includes('plank')) {
    return 'floor_lvp_neutral';
  }
  if (normalized.includes('medium') || normalized.includes('warm') || normalized.includes('brown')) {
    return 'floor_medium_wood';
  }

  return 'floor_light_wood';
}

function resolveKitchenUpgradePresetKey({ cabinetColor = '', countertopMaterial = '' } = {}) {
  const cabinet = String(cabinetColor || '').toLowerCase();
  const counter = String(countertopMaterial || '').toLowerCase();

  if (
    cabinet.includes('green') ||
    cabinet.includes('sage') ||
    cabinet.includes('olive')
  ) {
    return counter.includes('quartz')
      ? 'kitchen_green_cabinets_quartz'
      : 'kitchen_green_cabinets_granite';
  }

  return counter.includes('quartz')
    ? 'kitchen_white_cabinets_quartz'
    : 'kitchen_white_cabinets_granite';
}

function resolveExteriorPresetKey(normalizedPlan = {}) {
  const features = normalizedPlan?.exteriorFeatures || [];

  if (features.includes('pool') || features.includes('pond')) {
    return 'backyard_pool_preview';
  }
  if (
    normalizedPlan?.exteriorZone === 'backyard' ||
    features.includes('entertaining')
  ) {
    return 'backyard_entertaining_refresh';
  }

  return 'exterior_curb_appeal_refresh';
}

function getFreeformPlanPromptAddon(normalizedPlan = {}) {
  const instructions = [];

  if (normalizedPlan.removeObjects?.includes('furniture')) {
    instructions.push(
      'Remove movable furniture such as sofas, chairs, tables, portable shelving, and decor where realistically possible.',
    );
  }
  if (normalizedPlan.removeObjects?.includes('clutter')) {
    instructions.push(
      'Reduce loose clutter on counters, shelves, side tables, and floor edges while keeping the room believable.',
    );
  }
  if (normalizedPlan.wallColor) {
    instructions.push(
      `If a wall-color concept can be shown believably, preview the walls in ${normalizedPlan.wallColor} while preserving trim lines, shadows, and texture.`,
    );
  }
  if (normalizedPlan.flooring) {
    instructions.push(
      `If a flooring concept can be shown believably, preview the floor as ${normalizedPlan.flooring} while preserving room geometry, transitions, and perspective.`,
    );
  }
  if (normalizedPlan.cabinetColor) {
    instructions.push(
      `If cabinetry can be edited believably, preview cabinets in ${normalizedPlan.cabinetColor} while preserving the real cabinet layout, door lines, hardware, and appliance spacing.`,
    );
  }
  if (normalizedPlan.countertopMaterial) {
    instructions.push(
      `If countertop changes can be shown believably, preview countertops as ${normalizedPlan.countertopMaterial} while preserving edge geometry, backsplash alignment, sink placement, and realism.`,
    );
  }
  if (normalizedPlan.lighting === 'brighter') {
    instructions.push(
      'Increase brightness and perceived natural light without blowing out windows, ceilings, or permanent finishes.',
    );
  }
  if ((normalizedPlan.exteriorFeatures || []).length) {
    instructions.push(
      `If exterior upgrades can be shown believably, emphasize ${normalizedPlan.exteriorFeatures.join(', ')} while preserving the true structure, lot boundaries, and exterior layout.`,
    );
  }

  return instructions.join(' ');
}

function buildFreeformRenderPlan(normalizedPlan = {}) {
  const requestedChanges = [];
  const effects = ['Custom request saved', 'Manual review recommended'];

  if (normalizedPlan.removeObjects?.includes('furniture')) {
    requestedChanges.push('furniture removal');
    effects.push('Furniture-removal route');
  }
  if (normalizedPlan.removeObjects?.includes('clutter')) {
    requestedChanges.push('declutter');
    effects.push('Declutter route');
  }
  if (normalizedPlan.wallColor) {
    requestedChanges.push(`wall color toward ${normalizedPlan.wallColor}`);
    effects.push(`Wall color concept: ${normalizedPlan.wallColor}`);
  }
  if (normalizedPlan.flooring) {
    requestedChanges.push(`flooring toward ${normalizedPlan.flooring}`);
    effects.push(`Flooring concept: ${normalizedPlan.flooring}`);
  }
  if (normalizedPlan.cabinetColor) {
    requestedChanges.push(`cabinet color toward ${normalizedPlan.cabinetColor}`);
    effects.push(`Cabinet concept: ${normalizedPlan.cabinetColor}`);
  }
  if (normalizedPlan.countertopMaterial) {
    requestedChanges.push(`countertops toward ${normalizedPlan.countertopMaterial}`);
    effects.push(`Countertop concept: ${normalizedPlan.countertopMaterial}`);
  }
  if (normalizedPlan.lighting === 'brighter') {
    requestedChanges.push('brighter lighting');
    effects.push('Brightness lift requested');
  }
  if ((normalizedPlan.exteriorFeatures || []).length) {
    requestedChanges.push(`exterior upgrades for ${normalizedPlan.exteriorFeatures.join(', ')}`);
    effects.push(`Exterior concept: ${normalizedPlan.exteriorFeatures.join(', ')}`);
  }
  if (effects.length === 2) {
    effects.splice(1, 0, 'Listing refresh fallback');
  }

  const requestSummary = requestedChanges.length
    ? requestedChanges.join(', ')
    : 'the closest available enhancement flow';

  return {
    label: 'Custom Enhancement Preview',
    warning:
      normalizedPlan.wallColor ||
      normalizedPlan.flooring ||
      normalizedPlan.cabinetColor ||
      normalizedPlan.countertopMaterial ||
      (normalizedPlan.exteriorFeatures || []).length
        ? 'Custom instructions were saved with this enhancement request. Finish and color changes may render as concept-level guidance in the current environment, so review the output carefully before public marketing use.'
        : 'Custom instructions were saved with this enhancement request. Review the output before public marketing use.',
    summary:
      `A freeform enhancement request was captured for this photo and processed for ${requestSummary}.`,
    differenceHint:
      requestedChanges.length
        ? `Compare the result against the original and look specifically for ${requestSummary} while confirming the room still feels truthful and listing-safe.`
        : 'Compare the result against the original and confirm the requested changes still feel truthful and listing-safe.',
    effects,
  };
}

export function resolveFreeformPresetKey({ presetKey, jobType, normalizedPlan }) {
  if (presetKey || jobType) {
    return presetKey || jobType;
  }

  if (normalizedPlan?.removeObjects?.includes('furniture')) {
    return 'remove_furniture';
  }

  if (
    normalizedPlan?.roomType === 'kitchen' &&
    (normalizedPlan?.cabinetColor || normalizedPlan?.countertopMaterial)
  ) {
    return resolveKitchenUpgradePresetKey(normalizedPlan);
  }

  if (
    (normalizedPlan?.exteriorFeatures || []).length ||
    normalizedPlan?.exteriorZone
  ) {
    return resolveExteriorPresetKey(normalizedPlan);
  }

  if (normalizedPlan?.flooring) {
    return resolveFlooringPresetKey(normalizedPlan.flooring);
  }

  if (normalizedPlan?.wallColor) {
    return resolveWallColorPresetKey(normalizedPlan.wallColor);
  }

  if (normalizedPlan?.removeObjects?.includes('clutter')) {
    return 'declutter_medium';
  }

  return 'combined_listing_refresh';
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

  if (
    presetKey === 'paint_warm_neutral' ||
    presetKey === 'paint_bright_white' ||
    presetKey === 'paint_soft_greige'
  ) {
    return {
      title: `${roomLabel} Paint Concept Preview`,
      originalMediaId: asset?.id || variant?.mediaId || null,
      originalImageUrl: asset?.imageUrl || null,
      variantId: variant?.id || null,
      variantImageUrl: variant?.imageUrl || null,
      variantCategory: variant?.variantCategory || 'concept_preview',
      whatChanged:
        'This preview changes the wall color direction to show how a fresh paint palette could modernize the room without changing its structure.',
      whyItMatters:
        reviewSummary ||
        'Paint is often one of the fastest ways to make a room feel cleaner, brighter, and more buyer-friendly.',
      suggestedAction:
        suggestedAction ||
        'Compare the preview to the original and decide whether a lighter or more neutral palette would improve listing appeal before photography.',
      disclaimer:
        'This image is an AI-generated concept preview for planning purposes only.',
    };
  }

  if (
    presetKey === 'floor_light_wood' ||
    presetKey === 'floor_medium_wood' ||
    presetKey === 'floor_dark_hardwood' ||
    presetKey === 'floor_lvp_neutral' ||
    presetKey === 'floor_tile_stone'
  ) {
    return {
      title: `${roomLabel} Flooring Concept Preview`,
      originalMediaId: asset?.id || variant?.mediaId || null,
      originalImageUrl: asset?.imageUrl || null,
      variantId: variant?.id || null,
      variantImageUrl: variant?.imageUrl || null,
      variantCategory: variant?.variantCategory || 'concept_preview',
      whatChanged:
        'This preview changes the flooring direction to show how a more updated surface could reshape the room’s feel.',
      whyItMatters:
        reviewSummary ||
        'Flooring changes can strongly affect perceived quality, brightness, warmth, and how updated the room feels to buyers.',
      suggestedAction:
        suggestedAction ||
        'Use this preview to compare finish direction and decide whether the room benefits more from wood, LVP, or tile-based upgrades.',
      disclaimer:
        'This image is an AI-generated concept preview for planning purposes only.',
    };
  }

  if (
    presetKey === 'kitchen_white_cabinets_granite' ||
    presetKey === 'kitchen_white_cabinets_quartz' ||
    presetKey === 'kitchen_green_cabinets_granite' ||
    presetKey === 'kitchen_green_cabinets_quartz'
  ) {
    return {
      title: `${roomLabel} Kitchen Upgrade Preview`,
      originalMediaId: asset?.id || variant?.mediaId || null,
      originalImageUrl: asset?.imageUrl || null,
      variantId: variant?.id || null,
      variantImageUrl: variant?.imageUrl || null,
      variantCategory: variant?.variantCategory || 'concept_preview',
      whatChanged:
        'This preview updates the cabinetry and countertop direction to show how a stronger kitchen finish package could affect buyer perception.',
      whyItMatters:
        reviewSummary ||
        'Kitchen finish changes often have an outsized effect on perceived home value, listing photos, and overall first impression.',
      suggestedAction:
        suggestedAction ||
        'Use this as a budget-discussion tool to compare whether repainting cabinets and updating counters would materially improve the listing story.',
      disclaimer:
        'This image is an AI-generated concept preview for planning purposes only.',
    };
  }

  if (
    presetKey === 'exterior_curb_appeal_refresh' ||
    presetKey === 'backyard_entertaining_refresh' ||
    presetKey === 'backyard_pool_preview'
  ) {
    return {
      title: `${roomLabel} Exterior Upgrade Preview`,
      originalMediaId: asset?.id || variant?.mediaId || null,
      originalImageUrl: asset?.imageUrl || null,
      variantId: variant?.id || null,
      variantImageUrl: variant?.imageUrl || null,
      variantCategory: variant?.variantCategory || 'concept_preview',
      whatChanged:
        presetKey === 'backyard_pool_preview'
          ? 'This preview adds a pool or water-feature concept to show how the backyard could transform with a larger budget and design scope.'
          : 'This preview upgrades the exterior with stronger plants, fixtures, and presentation cues to show a more intentional outdoor impression.',
      whyItMatters:
        reviewSummary ||
        (presetKey === 'exterior_curb_appeal_refresh'
          ? 'Exterior first-impression upgrades can change how buyers feel before they ever step inside.'
          : 'Outdoor upgrades can help buyers imagine entertaining, relaxing, and getting more value from the lot.'),
      suggestedAction:
        suggestedAction ||
        (presetKey === 'backyard_pool_preview'
          ? 'Use this to discuss whether a larger backyard investment meaningfully changes the property story.'
          : 'Use this preview to prioritize landscaping, fixture, and outdoor-living improvements that could create a stronger marketing impression.'),
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

async function renderLocalWallPaintVariantBuffer(sourceBuffer, presetKey, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const toneConfig = buildLocalWallPaintToneConfig(presetKey);
  const resolvedWallMask = await resolveSurfaceMaskAtSourceSize(sourceBuffer, presetKey, roomType);
  const [sourceRgba, maskRaw] = await Promise.all([
    sharp(sourceBuffer).rotate().ensureAlpha().raw().toBuffer(),
    sharp(resolvedWallMask.maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const maskedLightnessSamples = [];
  for (let index = 0; index < width * height; index += 1) {
    const alpha = clamp01((maskRaw[index] || 0) / 255);
    if (alpha <= 0.08) {
      continue;
    }

    const offset = index * 4;
    const { l } = rgbToHsl(sourceRgba[offset], sourceRgba[offset + 1], sourceRgba[offset + 2]);
    maskedLightnessSamples.push(l);
  }
  const medianWallLightness = medianChannel(
    maskedLightnessSamples.map((value) => Math.round(value * 255)),
    178,
  ) / 255;

  const painted = Buffer.from(sourceRgba);
  for (let index = 0; index < width * height; index += 1) {
    const alpha = clamp01((maskRaw[index] || 0) / 255);
    if (alpha <= 0.03) {
      continue;
    }
    const effectiveAlpha = clamp01(
      Math.pow(alpha, Number(toneConfig.alphaExponent || 1)),
    );

    const offset = index * 4;
    const originalRed = painted[offset];
    const originalGreen = painted[offset + 1];
    const originalBlue = painted[offset + 2];
    const { h, s, l } = rgbToHsl(originalRed, originalGreen, originalBlue);
    const lightnessOffset = Math.max(
      -1,
      Math.min(1, (l - medianWallLightness) / Math.max(0.08, toneConfig.shadingRange || 0.14)),
    );
    const targetHue = mixHue(h, toneConfig.targetHue, effectiveAlpha * toneConfig.targetHueMix);
    const targetSaturation = mixValue(
      s,
      clamp01(toneConfig.targetSaturation + Math.max(0, -lightnessOffset) * 0.015),
      effectiveAlpha * toneConfig.targetSaturationMix,
    );
    const shapedTargetLightness = clamp01(
      toneConfig.targetLightness + lightnessOffset * (toneConfig.shadingRange || 0.14),
    );
    const lightnessAfterMix = mixValue(
      l,
      shapedTargetLightness,
      effectiveAlpha * toneConfig.lightnessMix,
    );
    const targetLightness = clamp01(
      lightnessAfterMix +
        (1 - lightnessAfterMix) * toneConfig.additionalLift * effectiveAlpha,
    );
    const [paintRed, paintGreen, paintBlue] = hslToRgb(
      targetHue,
      targetSaturation,
      targetLightness,
    );
    const blendMix = clamp01(
      Math.max(
        effectiveAlpha * toneConfig.blendMix,
        effectiveAlpha >= 0.45 ? Number(toneConfig.minBlend || 0) : 0,
      ),
    );

    painted[offset] = clampByte(mixValue(originalRed, paintRed, blendMix));
    painted[offset + 1] = clampByte(mixValue(originalGreen, paintGreen, blendMix));
    painted[offset + 2] = clampByte(mixValue(originalBlue, paintBlue, blendMix));
  }

  const variantBuffer = await sharp(painted, {
    raw: { width, height, channels: 4 },
  })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const compositedBuffer = await blendVariantWithSourceMask({
    sourceBuffer,
    variantBuffer,
    maskBuffer: resolvedWallMask.maskBuffer,
    maskBlur: getFinishMaskBlurRadius(presetKey),
  });

  return {
    buffer: compositedBuffer,
    debug: {
      wallMaskBuffer: resolvedWallMask.maskBuffer,
      strategy: resolvedWallMask.debug?.strategy || null,
      maskCoverageRatio:
        resolvedWallMask.debug?.coverageRatio ?? resolvedWallMask.debug?.maskCoverageRatio ?? null,
      rawMaskCoverageRatio: resolvedWallMask.debug?.rawCoverageRatio ?? null,
      refinementStages: resolvedWallMask.debug?.refinementStages || [],
      windowRejectionCoverageRatio: resolvedWallMask.debug?.windowRejectionCoverageRatio ?? null,
      windowBrightPixelRatio: resolvedWallMask.debug?.windowBrightPixelRatio ?? null,
      windowStructuredPixelRatio: resolvedWallMask.debug?.windowStructuredPixelRatio ?? null,
    },
  };
}

async function renderLocalFloorVariantBuffer(sourceBuffer, presetKey, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const toneConfig = buildLocalFloorToneConfig(presetKey);
  const floorMask = await buildAdaptiveFloorMaskAtSourceSize(sourceBuffer, presetKey, roomType);
  const [sourceRgba, maskRaw] = await Promise.all([
    sharp(sourceBuffer).rotate().ensureAlpha().raw().toBuffer(),
    sharp(floorMask.adaptiveMaskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  let floorTop = height;
  let floorBottom = 0;
  const maskedLightnessSamples = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const alpha = clamp01((maskRaw[index] || 0) / 255);
      if (alpha <= 0.08) {
        continue;
      }

      floorTop = Math.min(floorTop, y);
      floorBottom = Math.max(floorBottom, y);
      const offset = index * 4;
      const { l } = rgbToHsl(sourceRgba[offset], sourceRgba[offset + 1], sourceRgba[offset + 2]);
      maskedLightnessSamples.push(l);
    }
  }
  if (floorTop >= floorBottom) {
    floorTop = Math.round(height * 0.5);
    floorBottom = height - 1;
  }
  const floorHeight = Math.max(1, floorBottom - floorTop);
  const medianFloorLightness = medianChannel(
    maskedLightnessSamples.map((value) => Math.round(value * 255)),
    126,
  ) / 255;

  const transformed = Buffer.from(sourceRgba);
  for (let y = 0; y < height; y += 1) {
    const planeT = clamp01((y - floorTop) / floorHeight);
    const rowHeight = mixValue(
      toneConfig.topRowHeight || 6,
      toneConfig.bottomRowHeight || 24,
      Math.pow(planeT, 1.45),
    );
    const tileRow = Math.floor((y - floorTop) / Math.max(1, rowHeight));
    const rowFraction = ((y - floorTop) / Math.max(1, rowHeight)) - tileRow;

    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const alpha = clamp01((maskRaw[index] || 0) / 255);
      if (alpha <= 0.03) {
        continue;
      }

      const offset = index * 4;
      const originalRed = transformed[offset];
      const originalGreen = transformed[offset + 1];
      const originalBlue = transformed[offset + 2];
      const { h, s, l } = rgbToHsl(originalRed, originalGreen, originalBlue);
      const shadingOffset = l - medianFloorLightness;
      const effectiveAlpha = clamp01(
        Math.pow(alpha, Number(toneConfig.alphaExponent || 1)),
      );

      let targetRed = originalRed;
      let targetGreen = originalGreen;
      let targetBlue = originalBlue;

      if (toneConfig.kind === 'tile') {
        const colWidth = Math.max(
          1,
          rowHeight * Number(toneConfig.tileAspect || 1.5),
        );
        const rowParityOffset = 0;
        const tileCol = Math.floor((x + rowParityOffset) / colWidth);
        const colFraction = ((x + rowParityOffset) / colWidth) - tileCol;
        const seamDistance = Math.min(
          rowFraction,
          1 - rowFraction,
          colFraction,
          1 - colFraction,
        );
        const groutBlend = 1 - smoothStep(
          Number(toneConfig.groutWidth || 0.06),
          Number(toneConfig.groutWidth || 0.06) + Number(toneConfig.groutFeather || 0.04),
          seamDistance,
        );
        const tileNoise = pseudoRandom01(tileRow, tileCol, 1);
        const macroNoise = pseudoRandom01(
          Math.floor(x / 64),
          Math.floor((y - floorTop) / 56),
          3,
        );
        const blotchNoiseA = pseudoRandom01(
          Math.floor(x / 28),
          Math.floor((y - floorTop) / 24),
          4,
        );
        const blotchNoiseB = pseudoRandom01(
          Math.floor(x / 44),
          Math.floor((y - floorTop) / 38),
          5,
        );
        const sourceShadingRetention = Number(toneConfig.sourceShadingRetention || 0.18);
        const subduedSourceShading =
          Math.max(-0.03, Math.min(0.03, shadingOffset)) * sourceShadingRetention;
        const planeGradient =
          (0.5 - Math.abs(planeT - 0.52)) * Number(toneConfig.planeGradientStrength || 0.04) -
          Number(toneConfig.planeGradientStrength || 0.04) * 0.5;
        const stoneMottle =
          (blotchNoiseA - 0.5) * 0.018 +
          (blotchNoiseB - 0.5) * 0.014 +
          (macroNoise - 0.5) * Number(toneConfig.macroNoiseStrength || 0.02);
        const tileHue = clamp01(toneConfig.targetHue + (tileNoise - 0.5) * 0.018);
        const tileSaturation = clamp01(
          toneConfig.targetSaturation +
            (tileNoise - 0.5) * 0.012 +
            stoneMottle * 0.35,
        );
        const tileLightness = clamp01(
          toneConfig.targetLightness +
            subduedSourceShading * Number(toneConfig.shadingScale || 0.62) +
            planeGradient +
            (tileNoise - 0.5) * Number(toneConfig.tileVariation || 0.06) +
            stoneMottle,
        );
        const groutLightness = clamp01(
          toneConfig.groutLightness + subduedSourceShading * 0.06,
        );
        const [tileRed, tileGreen, tileBlue] = hslToRgb(
          tileHue,
          tileSaturation,
          tileLightness,
        );
        const [groutRed, groutGreen, groutBlue] = hslToRgb(
          toneConfig.groutHue,
          toneConfig.groutSaturation,
          groutLightness,
        );
        targetRed = clampByte(mixValue(tileRed, groutRed, groutBlend));
        targetGreen = clampByte(mixValue(tileGreen, groutGreen, groutBlend));
        targetBlue = clampByte(mixValue(tileBlue, groutBlue, groutBlend));
      } else {
        const targetHue = mixHue(
          h,
          toneConfig.targetHue,
          effectiveAlpha * Number(toneConfig.targetHueMix || 1),
        );
        const targetSaturation = mixValue(
          s,
          clamp01(toneConfig.targetSaturation + Math.max(0, -shadingOffset) * 0.04),
          effectiveAlpha * Number(toneConfig.targetSaturationMix || 1),
        );
        const targetLightness = clamp01(
          mixValue(
            l,
            clamp01(
              toneConfig.targetLightness +
                shadingOffset * Number(toneConfig.shadingScale || 0.58),
            ),
            effectiveAlpha * Number(toneConfig.lightnessMix || 1),
          ) +
            shadingOffset * Number(toneConfig.contrastBoost || 0) +
            (1 - l) * Number(toneConfig.additionalLift || 0) * effectiveAlpha,
        );
        [targetRed, targetGreen, targetBlue] = hslToRgb(
          targetHue,
          targetSaturation,
          targetLightness,
        );
      }

      const blendMix =
        toneConfig.kind === 'tile'
          ? clamp01(
              Math.max(
                effectiveAlpha >= 0.2 ? Number(toneConfig.minBlend || 1) : 0,
                effectiveAlpha * Number(toneConfig.blendMix || 1),
              ),
            )
          : clamp01(
              Math.max(
                effectiveAlpha * Number(toneConfig.blendMix || 0.96),
                effectiveAlpha >= 0.45 ? Number(toneConfig.minBlend || 0) : 0,
              ),
            );

      transformed[offset] = clampByte(mixValue(originalRed, targetRed, blendMix));
      transformed[offset + 1] = clampByte(mixValue(originalGreen, targetGreen, blendMix));
      transformed[offset + 2] = clampByte(mixValue(originalBlue, targetBlue, blendMix));
    }
  }

  const preblendBuffer = await sharp(transformed, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  const variantBuffer = await sharp(transformed, {
    raw: { width, height, channels: 4 },
  })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const compositedBuffer =
    toneConfig.kind === 'tile'
      ? variantBuffer
      : await blendVariantWithSourceMask({
          sourceBuffer,
          variantBuffer,
          maskBuffer: floorMask.adaptiveMaskBuffer,
          maskBlur: getFinishMaskBlurRadius(presetKey),
        });

  return {
    buffer: compositedBuffer,
    debug:
      presetKey === 'floor_tile_stone'
        ? {
            floorMaskBuffer: floorMask.adaptiveMaskBuffer,
            preblendBuffer,
            maskCoverageRatio: await calculateMaskCoverageRatio(floorMask.adaptiveMaskBuffer),
          }
        : null,
  };
}

async function renderVariantBuffer(buffer, presetKey, roomType) {
  const renderPlan = buildPresetRenderPlan(presetKey);
  const sourceMetadata = await sharp(buffer).rotate().metadata();
  const transformedResult = String(presetKey || '').startsWith('paint_')
    ? await renderLocalWallPaintVariantBuffer(buffer, presetKey, roomType)
    : String(presetKey || '').startsWith('floor_')
      ? await renderLocalFloorVariantBuffer(buffer, presetKey, roomType)
      : await (typeof renderPlan.transform === 'function'
        ? renderPlan
            .transform(sharp(buffer).rotate(), sourceMetadata)
            .jpeg({ quality: 88, mozjpeg: true })
            .toBuffer()
        : sharp(buffer).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer());
  const transformed =
    Buffer.isBuffer(transformedResult) ? transformedResult : transformedResult.buffer;
  const debug = Buffer.isBuffer(transformedResult) ? null : transformedResult.debug || null;
  const roomPromptAddon = getRoomPromptAddon(roomType);

  return {
    buffer: transformed,
    debug,
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

  if (Buffer.isBuffer(output)) {
    return output;
  }

  if (output instanceof Uint8Array) {
    return Buffer.from(output);
  }

  if (output instanceof ArrayBuffer) {
    return Buffer.from(output);
  }

  if (typeof output === 'string') {
    const response = await fetch(output);
    if (!response.ok) {
      throw new Error(`Could not download generated variant from provider (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  if (typeof output?.arrayBuffer === 'function') {
    return Buffer.from(await output.arrayBuffer());
  }

  if (typeof output?.blob === 'function') {
    const blob = await output.blob();
    if (blob && typeof blob.arrayBuffer === 'function') {
      return Buffer.from(await blob.arrayBuffer());
    }
  }

  if (typeof output?.url === 'function' || typeof output?.url === 'string') {
    const url = getProviderSourceUrl(output);
    if (url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not download generated variant from provider (${response.status}).`);
      }
      return Buffer.from(await response.arrayBuffer());
    }
  }

  if (typeof output?.getReader === 'function') {
    const response = new Response(output);
    return Buffer.from(await response.arrayBuffer());
  }

  if (output?.data) {
    return convertReplicateOutputToBuffer(output.data);
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
  const wallColorPresetKeys = new Set([
    'paint_warm_neutral',
    'paint_bright_white',
    'paint_soft_greige',
  ]);
  const flooringPresetKeys = new Set([
    'floor_light_wood',
    'floor_medium_wood',
    'floor_dark_hardwood',
    'floor_lvp_neutral',
    'floor_tile_stone',
  ]);
  const kitchenUpgradePresetKeys = new Set([
    'kitchen_white_cabinets_granite',
    'kitchen_white_cabinets_quartz',
    'kitchen_green_cabinets_granite',
    'kitchen_green_cabinets_quartz',
  ]);

  if (presetKey === 'remove_furniture') {
    if (normalizedRoomType === 'living_room') {
      return [
        {
          type: 'rect',
          left: Math.round(width * 0.04),
          top: Math.round(height * 0.34),
          width: Math.round(width * 0.92),
          height: Math.round(height * 0.6),
        },
        {
          type: 'ellipse',
          cx: Math.round(width * 0.27),
          cy: Math.round(height * 0.66),
          rx: Math.round(width * 0.22),
          ry: Math.round(height * 0.18),
        },
        {
          type: 'ellipse',
          cx: Math.round(width * 0.74),
          cy: Math.round(height * 0.64),
          rx: Math.round(width * 0.24),
          ry: Math.round(height * 0.19),
        },
      ];
    }

    return [
      {
        type: 'rect',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.3),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.64),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.64),
        rx: Math.round(width * 0.35),
        ry: Math.round(height * 0.23),
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

  if (wallColorPresetKeys.has(presetKey)) {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.06),
        top: Math.round(height * 0.08),
        width: Math.round(width * 0.88),
        height: Math.round(height * 0.56),
      },
      {
        type: 'rect',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.18),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.18),
      },
    ];
  }

  if (flooringPresetKeys.has(presetKey)) {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.04),
        top: Math.round(height * 0.48),
        width: Math.round(width * 0.92),
        height: Math.round(height * 0.46),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.76),
        rx: Math.round(width * 0.42),
        ry: Math.round(height * 0.18),
      },
    ];
  }

  if (kitchenUpgradePresetKeys.has(presetKey)) {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.22),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.32),
      },
      {
        type: 'rect',
        left: Math.round(width * 0.1),
        top: Math.round(height * 0.5),
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.18),
      },
    ];
  }

  if (presetKey === 'exterior_curb_appeal_refresh') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.02),
        top: Math.round(height * 0.44),
        width: Math.round(width * 0.96),
        height: Math.round(height * 0.42),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.68),
        rx: Math.round(width * 0.38),
        ry: Math.round(height * 0.16),
      },
    ];
  }

  if (presetKey === 'backyard_entertaining_refresh') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.04),
        top: Math.round(height * 0.38),
        width: Math.round(width * 0.92),
        height: Math.round(height * 0.48),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.72),
        rx: Math.round(width * 0.32),
        ry: Math.round(height * 0.16),
      },
    ];
  }

  if (presetKey === 'backyard_pool_preview') {
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.42),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.4),
      },
      {
        type: 'ellipse',
        cx: Math.round(width * 0.5),
        cy: Math.round(height * 0.68),
        rx: Math.round(width * 0.28),
        ry: Math.round(height * 0.12),
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
    .blur(0.6)
    .png()
    .toBuffer();
}

function buildWallProbeFeatures(sourceProbe, width, height) {
  const luminance = new Float32Array(width * height);
  const saturation = new Float32Array(width * height);
  const horizontalGrad = new Float32Array(width * height);
  const verticalGrad = new Float32Array(width * height);
  const texture = new Float32Array(width * height);

  function rgbAt(index) {
    const offset = index * 3;
    return [sourceProbe[offset], sourceProbe[offset + 1], sourceProbe[offset + 2]];
  }

  for (let index = 0; index < width * height; index += 1) {
    const [red, green, blue] = rgbAt(index);
    luminance[index] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    saturation[index] = Math.max(red, green, blue) - Math.min(red, green, blue);
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      horizontalGrad[index] = Math.abs(luminance[index - 1] - luminance[index + 1]);
      verticalGrad[index] = Math.abs(luminance[index - width] - luminance[index + width]);
      texture[index] = (horizontalGrad[index] + verticalGrad[index]) / 2;
    }
  }

  return {
    luminance,
    saturation,
    horizontalGrad,
    verticalGrad,
    texture,
  };
}

function getSemanticWallCoverageTarget(roomType) {
  const normalizedRoomType = normalizeRoomType(roomType);

  if (
    normalizedRoomType === 'living_room' ||
    normalizedRoomType === 'bedroom' ||
    normalizedRoomType === 'dining_room'
  ) {
    return 0.5;
  }

  return 0.42;
}

function collectMaskedChannelMedian(binaryMask, channel, fallbackValue) {
  const samples = [];
  for (let index = 0; index < binaryMask.length; index += 1) {
    if (!binaryMask[index]) {
      continue;
    }
    samples.push(Number(channel[index] || 0));
  }

  return medianChannel(samples, fallbackValue);
}

function expandSemanticWallMask({
  binaryMask,
  baseGeometryMask,
  blockedMask = null,
  features,
  width,
  height,
  roomType,
}) {
  const targetCoverage = getSemanticWallCoverageTarget(roomType);
  let current = new Uint8Array(binaryMask);
  let coverageRatio = calculateBinaryMaskCoverageRatio(current);
  if (coverageRatio >= targetCoverage) {
    return current;
  }

  const startY = Math.round(height * 0.08);
  const endY = Math.round(height * 0.78);
  const medianLum = collectMaskedChannelMedian(current, features.luminance, 188);
  const medianSat = collectMaskedChannelMedian(current, features.saturation, 22);
  const medianTexture = collectMaskedChannelMedian(current, features.texture, 10);

  for (let pass = 0; pass < 3 && coverageRatio < targetCoverage; pass += 1) {
    const next = new Uint8Array(current);
    let growthCount = 0;

    for (let y = startY + 1; y < endY - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (
          current[index] ||
          (baseGeometryMask[index] || 0) <= 20 ||
          (blockedMask && blockedMask[index])
        ) {
          continue;
        }

        const lum = Number(features.luminance[index] || 0);
        const sat = Number(features.saturation[index] || 0);
        const tex = Number(features.texture[index] || 0);
        const hGrad = Number(features.horizontalGrad[index] || 0);
        const vGrad = Number(features.verticalGrad[index] || 0);

        if (
          lum < 40 ||
          lum > 245 ||
          sat > Math.max(68, medianSat + 18) ||
          tex > Math.max(22, medianTexture + 8) ||
          hGrad > 30 ||
          vGrad > 36 ||
          Math.abs(lum - medianLum) > 34
        ) {
          continue;
        }

        let neighborCount = 0;
        const neighbors = [
          index - 1,
          index + 1,
          index - width,
          index + width,
          index - width - 1,
          index - width + 1,
          index + width - 1,
          index + width + 1,
        ];
        for (const neighborIndex of neighbors) {
          neighborCount += current[neighborIndex] ? 1 : 0;
        }

        const verticallyConnected =
          (current[index - width] && current[index + width]) ||
          (current[index - width] && current[index - width - 1]) ||
          (current[index - width] && current[index - width + 1]) ||
          (current[index + width] && current[index + width - 1]) ||
          (current[index + width] && current[index + width + 1]);

        if (neighborCount >= 2 || verticallyConnected) {
          next[index] = 1;
          growthCount += 1;
        }
      }
    }

    current = next;
    coverageRatio = calculateBinaryMaskCoverageRatio(current);
    if (!growthCount) {
      break;
    }
  }

  return current;
}

async function runWallSegmentationProviderFromProbe({
  sourceProbe,
  probeWidth,
  probeHeight,
  roomType,
  baseGeometryMask,
}) {
  void roomType;
  const features = buildWallProbeFeatures(sourceProbe, probeWidth, probeHeight);
  const binary = new Uint8Array(probeWidth * probeHeight);

  const startY = Math.round(probeHeight * 0.08);
  const endY = Math.round(probeHeight * 0.78);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = 1; x < probeWidth - 1; x += 1) {
      const index = y * probeWidth + x;
      if ((baseGeometryMask[index] || 0) <= 20) {
        continue;
      }

      const lum = Number(features.luminance[index] || 0);
      const sat = Number(features.saturation[index] || 0);
      const tex = Number(features.texture[index] || 0);
      const hGrad = Number(features.horizontalGrad[index] || 0);
      const vGrad = Number(features.verticalGrad[index] || 0);

      const looksLikeWallPlane =
        lum >= 40 &&
        lum <= 245 &&
        sat <= 60 &&
        tex <= 18 &&
        hGrad <= 26 &&
        vGrad <= 32;

      if (looksLikeWallPlane) {
        binary[index] = 1;
      }
    }
  }

  return {
    binary,
    features,
  };
}

function buildWindowProbeFeatures(sourceProbe, width, height) {
  const luminance = new Float32Array(width * height);
  const horizontalGrad = new Float32Array(width * height);
  const verticalGrad = new Float32Array(width * height);
  const texture = new Float32Array(width * height);
  const stripeScore = new Float32Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 3;
    const red = sourceProbe[offset];
    const green = sourceProbe[offset + 1];
    const blue = sourceProbe[offset + 2];
    luminance[index] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const left = luminance[index - 1];
      const right = luminance[index + 1];
      const up = luminance[index - width];
      const down = luminance[index + width];

      horizontalGrad[index] = Math.abs(left - right);
      verticalGrad[index] = Math.abs(up - down);
      texture[index] = (horizontalGrad[index] + verticalGrad[index]) / 2;

      const verticalStripeSignal =
        Math.abs(left - right) > 10 && Math.abs(up - down) < 10;
      stripeScore[index] = verticalStripeSignal ? 1 : 0;
    }
  }

  return {
    luminance,
    horizontalGrad,
    verticalGrad,
    texture,
    stripeScore,
  };
}

function buildRawWindowCandidateMask({
  features,
  width,
  height,
  startY,
  endY,
}) {
  const binary = new Uint8Array(width * height);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const lum = Number(features.luminance[index] || 0);
      const tex = Number(features.texture[index] || 0);
      const hGrad = Number(features.horizontalGrad[index] || 0);
      const vGrad = Number(features.verticalGrad[index] || 0);
      const stripe = Number(features.stripeScore[index] || 0);

      const isBlownOut = lum > 235;
      const isBrightStructured = lum > 195 && tex > 8;
      const isBlindRegion = lum > 180 && stripe > 0 && hGrad > vGrad * 1.15;
      const isExteriorLightPatch = lum > 205 && tex > 7;
      const isNaturalTextureWindow = lum > 170 && tex > 6 && vGrad > 6;

      if (
        isBlownOut ||
        isBrightStructured ||
        isBlindRegion ||
        isExteriorLightPatch ||
        isNaturalTextureWindow
      ) {
        binary[index] = 1;
      }
    }
  }

  return binary;
}

export function enforceVerticalWindowColumns(
  binaryMask,
  width,
  height,
  {
    startY = 0,
    endY = height - 1,
    minColumnCoverageRatio = 0.18,
  } = {},
) {
  const next = new Uint8Array(binaryMask);
  const safeStartY = Math.max(0, Math.min(height - 1, Math.round(startY)));
  const safeEndY = Math.max(safeStartY, Math.min(height - 1, Math.round(endY)));
  const bandHeight = Math.max(1, safeEndY - safeStartY + 1);

  for (let x = 0; x < width; x += 1) {
    let count = 0;

    for (let y = safeStartY; y <= safeEndY; y += 1) {
      if (binaryMask[y * width + x]) {
        count += 1;
      }
    }

    if (count / bandHeight >= minColumnCoverageRatio) {
      for (let y = safeStartY; y <= safeEndY; y += 1) {
        next[y * width + x] = 1;
      }
    }
  }

  return next;
}

function consolidateWindowRegions(binaryMask, width, height, { startY, endY } = {}) {
  let current = new Uint8Array(binaryMask);
  current = closeBinaryMask(current, width, height, 1);
  current = fillBinaryMaskHoles(current, width, height);
  current = filterBinaryMaskComponents(current, width, height, {
    minArea: Math.max(60, Math.round(width * height * 0.004)),
    minBoxWidth: Math.max(6, Math.round(width * 0.05)),
    minBoxHeight: Math.max(10, Math.round(height * 0.16)),
  });
  current = enforceVerticalWindowColumns(current, width, height, {
    startY,
    endY,
    minColumnCoverageRatio: 0.18,
  });
  current = closeBinaryMask(current, width, height, 1);
  current = fillBinaryMaskHoles(current, width, height);
  current = dilateBinaryMask(current, width, height, 1);

  return current;
}

export function buildWindowRejectionMask({
  sourceProbe,
  width,
  height,
  startY,
  endY,
}) {
  const features = buildWindowProbeFeatures(sourceProbe, width, height);
  const rawMask = buildRawWindowCandidateMask({
    features,
    width,
    height,
    startY,
    endY,
  });
  let finalMask = consolidateWindowRegions(rawMask, width, height, {
    startY,
    endY,
  });
  let coverageRatio = calculateBinaryMaskCoverageRatio(finalMask);

  if (coverageRatio > 0.32) {
    console.warn('Window rejection mask is unusually large; clipping to safer threshold', {
      coverageRatio,
    });
    finalMask = erodeBinaryMask(finalMask, width, height, 1);
    coverageRatio = calculateBinaryMaskCoverageRatio(finalMask);
  }

  let brightPixelCount = 0;
  let structuredPixelCount = 0;
  for (let index = 0; index < width * height; index += 1) {
    if (features.luminance[index] > 205) {
      brightPixelCount += 1;
    }
    if (features.texture[index] > 10) {
      structuredPixelCount += 1;
    }
  }

  return {
    binaryMask: finalMask,
    rawBinaryMask: rawMask,
    debug: {
      coverageRatio,
      brightPixelRatio: Number((brightPixelCount / Math.max(1, width * height)).toFixed(4)),
      structuredPixelRatio: Number((structuredPixelCount / Math.max(1, width * height)).toFixed(4)),
    },
  };
}

function suppressSemanticDangerZones(binaryMask, width, height) {
  const next = new Uint8Array(binaryMask);
  suppressWallDangerZones(next, width, height);
  return next;
}

function refineSemanticWallMask({
  binaryMask,
  sourceProbe,
  baseGeometryMask,
  width,
  height,
  roomType,
  presetKey,
}) {
  const refinementStages = [];
  const semanticFeatures = buildWallProbeFeatures(sourceProbe, width, height);
  let windowRejectionDebug = null;

  function stage(name, binary, note) {
    const coverageRatio = calculateBinaryMaskCoverageRatio(binary);
    refinementStages.push({
      stage: name,
      coverageRatio,
    });
    logWallMaskStageCoverage({
      presetKey,
      roomType,
      stage: name,
      coverageRatio,
      note,
    });
    return binary;
  }

  let current = new Uint8Array(binaryMask);
  const rawCoverageRatio = calculateBinaryMaskCoverageRatio(current);
  stage('semantic_raw', current, 'Raw semantic wall-plane classification.');

  current = closeBinaryMask(current, width, height, 1);
  stage('semantic_after_close', current, 'After semantic morphology closing.');

  current = fillBinaryMaskHoles(current, width, height);
  stage('semantic_after_hole_fill', current, 'After semantic hole filling.');

  current = bridgeVerticalMaskGaps(current, width, height, {
    startY: Math.round(height * 0.08),
    endY: Math.round(height * 0.78),
    maxGap: 4,
    minColumnCoverageRatio: 0.18,
  });
  stage('semantic_after_vertical_bridge', current, 'After vertical wall-plane continuity bridging.');

  current = expandSemanticWallMask({
    binaryMask: current,
    baseGeometryMask,
    features: semanticFeatures,
    width,
    height,
    roomType,
  });
  stage('semantic_after_targeted_expansion', current, 'After coverage-aware semantic wall expansion.');

  const windowRejection = buildWindowRejectionMask({
    sourceProbe,
    width,
    height,
    startY: Math.round(height * 0.08),
    endY: Math.round(height * 0.8),
  });
  windowRejectionDebug = windowRejection.debug;
  console.info('vision_window_rejection_debug', {
    presetKey,
    roomType,
    coverageRatio: windowRejection.debug.coverageRatio,
    brightPixelRatio: windowRejection.debug.brightPixelRatio,
    structuredPixelRatio: windowRejection.debug.structuredPixelRatio,
  });
  current = subtractBinaryMask(current, windowRejection.binaryMask);
  stage(
    'semantic_after_window_rejection',
    current,
    'After drop-in window rejection removed blinds, bright window interiors, and exterior light patches.',
  );

  current = expandSemanticWallMask({
    binaryMask: current,
    baseGeometryMask,
    blockedMask: windowRejection.binaryMask,
    features: semanticFeatures,
    width,
    height,
    roomType,
  });
  stage(
    'semantic_after_post_window_expansion',
    current,
    'After re-expanding safe wall regions that are not part of windows.',
  );

  current = suppressSemanticDangerZones(current, width, height);
  stage('semantic_after_danger_zones', current, 'After semantic danger-zone trimming.');

  if (calculateBinaryMaskCoverageRatio(current) > 0.56) {
    current = erodeBinaryMask(current, width, height, 1);
    stage('semantic_after_edge_buffer', current, 'After a light edge buffer to protect trim lines.');
  }

  current = filterBinaryMaskComponents(current, width, height, {
    minArea: Math.max(60, Math.round(width * height * 0.004)),
    minBoxWidth: 6,
    minBoxHeight: 8,
  });
  stage('semantic_after_component_filter', current, 'After semantic connected-component cleanup.');

  return {
    binary: current,
    rawCoverageRatio,
    coverageRatio: calculateBinaryMaskCoverageRatio(current),
    refinementStages,
    windowRejectionDebug,
  };
}

export async function segmentWallPlanesAtSourceSize(
  sourceBuffer,
  roomType,
  presetKey = 'paint_bright_white',
) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const probeWidth = Math.max(160, Math.min(320, width));
  const probeHeight = Math.max(120, Math.round((height / Math.max(1, width)) * probeWidth));

  const [sourceProbe, baseGeometryMask] = await Promise.all([
    sharp(sourceBuffer)
      .rotate()
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType).then((buffer) =>
      sharp(buffer)
        .resize(probeWidth, probeHeight, { fit: 'fill' })
        .removeAlpha()
        .greyscale()
        .raw()
        .toBuffer(),
    ),
  ]);

  const rawSemantic = await runWallSegmentationProviderFromProbe({
    sourceProbe,
    probeWidth,
    probeHeight,
    roomType,
    baseGeometryMask,
  });

  const refined = refineSemanticWallMask({
    binaryMask: rawSemantic.binary,
    sourceProbe,
    baseGeometryMask,
    width: probeWidth,
    height: probeHeight,
    roomType,
    presetKey,
  });

  const wallMaskBuffer = await buildBinaryMaskPngBuffer({
    binaryMask: refined.binary,
    inputWidth: probeWidth,
    inputHeight: probeHeight,
    outputWidth: width,
    outputHeight: height,
  });

  return {
    width,
    height,
    wallMaskBuffer,
    debug: {
      strategy: WALL_MASK_STRATEGIES.SEMANTIC,
      coverageRatio: refined.coverageRatio,
      rawCoverageRatio: refined.rawCoverageRatio,
      refinementStages: refined.refinementStages,
      windowRejectionCoverageRatio: refined.windowRejectionDebug?.coverageRatio ?? null,
      windowBrightPixelRatio: refined.windowRejectionDebug?.brightPixelRatio ?? null,
      windowStructuredPixelRatio: refined.windowRejectionDebug?.structuredPixelRatio ?? null,
    },
  };
}

async function buildAdaptiveWallPaintMaskAtSourceSize(sourceBuffer, presetKey, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const probeWidth = Math.max(96, Math.min(192, width));
  const probeHeight = Math.max(72, Math.round((height / Math.max(1, width)) * probeWidth));

  const baseMaskBuffer = await buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType);
  const [sourceProbe, baseMaskProbe] = await Promise.all([
    sharp(sourceBuffer)
      .rotate()
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(baseMaskBuffer)
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const luminance = new Float32Array(probeWidth * probeHeight);
  const saturation = new Float32Array(probeWidth * probeHeight);
  const texture = new Float32Array(probeWidth * probeHeight);
  const seedRed = [];
  const seedGreen = [];
  const seedBlue = [];
  const seedLuminance = [];
  const seedSaturation = [];

  function getRgb(x, y) {
    const offset = (y * probeWidth + x) * 3;
    return [sourceProbe[offset], sourceProbe[offset + 1], sourceProbe[offset + 2]];
  }

  function getLuminanceAt(x, y) {
    return luminance[y * probeWidth + x];
  }

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      const [red, green, blue] = getRgb(x, y);
      const lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const sat = Math.max(red, green, blue) - Math.min(red, green, blue);
      luminance[index] = lum;
      saturation[index] = sat;
    }
  }

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      const centerLum = luminance[index];
      let diffTotal = 0;
      let samples = 0;
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= probeWidth || ny >= probeHeight) {
          continue;
        }
        diffTotal += Math.abs(centerLum - getLuminanceAt(nx, ny));
        samples += 1;
      }
      texture[index] = samples > 0 ? diffTotal / samples : 0;

      if (
        baseMaskProbe[index] > 32 &&
        y >= Math.round(probeHeight * 0.14) &&
        y <= Math.round(probeHeight * 0.74) &&
        saturation[index] <= 44 &&
        luminance[index] >= 58 &&
        luminance[index] <= 238 &&
        texture[index] <= 18
      ) {
        const [red, green, blue] = getRgb(x, y);
        seedRed.push(red);
        seedGreen.push(green);
        seedBlue.push(blue);
        seedLuminance.push(luminance[index]);
        seedSaturation.push(saturation[index]);
      }
    }
  }

  const medianRed = medianChannel(seedRed, 214);
  const medianGreen = medianChannel(seedGreen, 214);
  const medianBlue = medianChannel(seedBlue, 214);
  const medianLum = medianChannel(seedLuminance, 214);
  const medianSat = medianChannel(seedSaturation, 18);
  const binary = new Uint8Array(probeWidth * probeHeight);

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      if (baseMaskProbe[index] <= 20) {
        continue;
      }
      if (y < Math.round(probeHeight * 0.14) || y > Math.round(probeHeight * 0.76)) {
        continue;
      }

      const [red, green, blue] = getRgb(x, y);
      const lum = luminance[index];
      const sat = saturation[index];
      const edgeAmount = texture[index];
      const colorDistance = Math.sqrt(
        (red - medianRed) * (red - medianRed) +
          (green - medianGreen) * (green - medianGreen) +
          (blue - medianBlue) * (blue - medianBlue),
      );
      const isWallPixel =
        sat <= Math.max(58, medianSat + 24) &&
        lum >= 50 &&
        lum <= 245 &&
        edgeAmount <= 28 &&
        (colorDistance <= 92 || (edgeAmount <= 20 && Math.abs(lum - medianLum) <= 52));

      if (isWallPixel) {
        binary[index] = 1;
      }
    }
  }

  const topClip = Math.round(probeHeight * 0.14);
  const bottomClip = Math.round(probeHeight * 0.76);
  const afterMorphologyCleanup = closeBinaryMask(binary, probeWidth, probeHeight, 1);
  const afterHoleFill = fillBinaryMaskHoles(afterMorphologyCleanup, probeWidth, probeHeight);
  const afterVerticalContinuity = bridgeVerticalMaskGaps(
    afterHoleFill,
    probeWidth,
    probeHeight,
    {
      startY: topClip,
      endY: bottomClip,
      maxGap: 4,
      minColumnCoverageRatio: 0.16,
    },
  );
  const brightWindowMask = buildBrightWindowExclusionMask(
    luminance,
    texture,
    probeWidth,
    probeHeight,
    {
      startY: topClip,
      endY: bottomClip,
    },
  );
  const expandedWindowMask = dilateBinaryMask(brightWindowMask, probeWidth, probeHeight, 1);
  const afterWindowSuppression = subtractBinaryMask(afterVerticalContinuity, expandedWindowMask);
  const afterDangerSuppression = new Uint8Array(afterWindowSuppression);
  suppressWallDangerZones(afterDangerSuppression, probeWidth, probeHeight);
  const componentFiltered = filterBinaryMaskComponents(
    afterDangerSuppression,
    probeWidth,
    probeHeight,
    {
      minArea: Math.max(40, Math.round(probeWidth * probeHeight * 0.0035)),
      minBoxWidth: 3,
      minBoxHeight: 4,
    },
  );

  const stageCandidates = [
    {
      stage: 'adaptive_initial_classification',
      binary,
      note: 'Color and texture based adaptive wall classification.',
    },
    {
      stage: 'adaptive_after_morphology_cleanup',
      binary: afterMorphologyCleanup,
      note: 'After reconnecting fragmented wall regions.',
    },
    {
      stage: 'adaptive_after_hole_fill',
      binary: afterHoleFill,
      note: 'After filling enclosed holes inside the wall region.',
    },
    {
      stage: 'adaptive_after_vertical_continuity',
      binary: afterVerticalContinuity,
      note: 'After bridging short vertical wall gaps.',
    },
    {
      stage: 'adaptive_after_window_suppression',
      binary: afterWindowSuppression,
      note: 'After hard exclusion of bright window regions.',
    },
    {
      stage: 'adaptive_after_danger_zone_suppression',
      binary: afterDangerSuppression,
      note: 'After top / bottom / side danger-zone trimming.',
    },
    {
      stage: 'adaptive_after_component_filter',
      binary: componentFiltered,
      note: 'After connected-component cleanup.',
    },
  ].map((candidate) => ({
    ...candidate,
    coverageRatio: calculateBinaryMaskCoverageRatio(candidate.binary),
  }));

  for (const candidate of stageCandidates) {
    logWallMaskStageCoverage({
      presetKey,
      roomType,
      stage: candidate.stage,
      coverageRatio: candidate.coverageRatio,
      note: candidate.note,
    });
  }

  const viableStage = selectViableWallMaskStage(stageCandidates);
  logWallMaskStageCoverage({
    presetKey,
    roomType,
    stage: viableStage?.stage || 'adaptive_no_viable_stage',
    coverageRatio: viableStage?.coverageRatio || 0,
    note: 'Selected adaptive wall-mask stage.',
  });
  const finalBinary = viableStage?.binary || componentFiltered;

  const adaptiveMaskBuffer = await buildBinaryMaskPngBuffer({
    binaryMask: finalBinary,
    inputWidth: probeWidth,
    inputHeight: probeHeight,
    outputWidth: width,
    outputHeight: height,
  });

  return {
    width,
    height,
    adaptiveMaskBuffer,
  };
}

function calculateBinaryMaskCoverageRatio(binaryMask) {
  let activePixels = 0;
  for (let index = 0; index < binaryMask.length; index += 1) {
    activePixels += binaryMask[index] ? 1 : 0;
  }

  return Number((activePixels / Math.max(1, binaryMask.length)).toFixed(4));
}

function filterBinaryMaskComponents(
  binaryMask,
  width,
  height,
  { minArea = 0, minBoxWidth = 1, minBoxHeight = 1 } = {},
) {
  const components = extractBinaryMaskComponents(binaryMask, width, height, minArea);
  const filtered = new Uint8Array(binaryMask.length);

  for (const component of components) {
    if (
      component.area < minArea ||
      component.boxWidth < minBoxWidth ||
      component.boxHeight < minBoxHeight
    ) {
      continue;
    }

    for (const pixelIndex of component.pixels) {
      filtered[pixelIndex] = 1;
    }
  }

  return filtered;
}

function dilateBinaryMask(binaryMask, width, height, radius = 1) {
  const dilated = new Uint8Array(binaryMask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let isActive = 0;
      for (let oy = -radius; oy <= radius && !isActive; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          if (binaryMask[ny * width + nx]) {
            isActive = 1;
            break;
          }
        }
      }

      if (isActive) {
        dilated[y * width + x] = 1;
      }
    }
  }

  return dilated;
}

function erodeBinaryMask(binaryMask, width, height, radius = 1) {
  const eroded = new Uint8Array(binaryMask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keepPixel = 1;
      for (let oy = -radius; oy <= radius && keepPixel; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            keepPixel = 0;
            break;
          }
          if (!binaryMask[ny * width + nx]) {
            keepPixel = 0;
            break;
          }
        }
      }

      if (keepPixel) {
        eroded[y * width + x] = 1;
      }
    }
  }

  return eroded;
}

function closeBinaryMask(binaryMask, width, height, radius = 1) {
  return erodeBinaryMask(dilateBinaryMask(binaryMask, width, height, radius), width, height, radius);
}

function fillBinaryMaskHoles(binaryMask, width, height) {
  const visited = new Uint8Array(binaryMask.length);
  const queue = [];

  function enqueueIfExteriorZero(x, y) {
    const index = y * width + x;
    if (visited[index] || binaryMask[index]) {
      return;
    }
    visited[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    enqueueIfExteriorZero(x, 0);
    enqueueIfExteriorZero(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfExteriorZero(0, y);
    enqueueIfExteriorZero(width - 1, y);
  }

  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length) {
    const index = queue.pop();
    const x = index % width;
    const y = Math.floor(index / width);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const nextIndex = ny * width + nx;
      if (visited[nextIndex] || binaryMask[nextIndex]) {
        continue;
      }
      visited[nextIndex] = 1;
      queue.push(nextIndex);
    }
  }

  const filled = new Uint8Array(binaryMask);
  for (let index = 0; index < binaryMask.length; index += 1) {
    if (!binaryMask[index] && !visited[index]) {
      filled[index] = 1;
    }
  }

  return filled;
}

export function bridgeVerticalMaskGaps(
  binaryMask,
  width,
  height,
  {
    startY = 0,
    endY = height - 1,
    maxGap = 4,
    minColumnCoverageRatio = 0.18,
  } = {},
) {
  const bridged = new Uint8Array(binaryMask);
  const clampedStartY = Math.max(0, Math.min(height - 1, startY));
  const clampedEndY = Math.max(clampedStartY, Math.min(height - 1, endY));
  const usableHeight = clampedEndY - clampedStartY + 1;

  for (let x = 0; x < width; x += 1) {
    let activeCount = 0;
    for (let y = clampedStartY; y <= clampedEndY; y += 1) {
      activeCount += binaryMask[y * width + x] ? 1 : 0;
    }

    if (activeCount / Math.max(1, usableHeight) < minColumnCoverageRatio) {
      continue;
    }

    let previousRunEnd = -1;
    let y = clampedStartY;
    while (y <= clampedEndY) {
      while (y <= clampedEndY && !binaryMask[y * width + x]) {
        y += 1;
      }
      if (y > clampedEndY) {
        break;
      }

      const runStart = y;
      while (y <= clampedEndY && binaryMask[y * width + x]) {
        y += 1;
      }
      const runEnd = y - 1;

      if (previousRunEnd >= clampedStartY) {
        const gapSize = runStart - previousRunEnd - 1;
        if (gapSize > 0 && gapSize <= maxGap) {
          for (let fillY = previousRunEnd + 1; fillY < runStart; fillY += 1) {
            bridged[fillY * width + x] = 1;
          }
        }
      }

      previousRunEnd = runEnd;
    }
  }

  return bridged;
}

function subtractBinaryMask(binaryMask, maskToSubtract) {
  const next = new Uint8Array(binaryMask);

  for (let index = 0; index < next.length; index += 1) {
    if (maskToSubtract[index]) {
      next[index] = 0;
    }
  }

  return next;
}

export function buildBrightWindowExclusionMask(
  luminance,
  texture,
  width,
  height,
  { startY = 0, endY = height - 1 } = {},
) {
  const clampedStartY = Math.max(0, Math.min(height - 1, startY));
  const clampedEndY = Math.max(clampedStartY, Math.min(height - 1, endY));
  const brightBinary = new Uint8Array(width * height);

  for (let y = clampedStartY; y <= clampedEndY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const lum = Number(luminance[index] || 0);
      const tex = Number(texture[index] || 0);
      if (lum >= 228 || (lum >= 212 && tex >= 8) || (lum >= 196 && tex >= 14)) {
        brightBinary[index] = 1;
      }
    }
  }

  const connectedBright = closeBinaryMask(brightBinary, width, height, 1);
  const filledBright = fillBinaryMaskHoles(connectedBright, width, height);
  return filterBinaryMaskComponents(filledBright, width, height, {
    minArea: Math.max(48, Math.round(width * height * 0.006)),
    minBoxWidth: Math.max(6, Math.round(width * 0.045)),
    minBoxHeight: Math.max(10, Math.round(height * 0.14)),
  });
}

export function selectViableWallMaskStage(stageCandidates = []) {
  const refinedCandidates = [...stageCandidates].filter(
    (candidate) => candidate.stage !== 'hard_geometric_fallback',
  );

  return (
    [...refinedCandidates]
      .reverse()
      .find(
        (candidate) => candidate.coverageRatio >= 0.03 && candidate.coverageRatio <= 0.4,
      ) ||
    [...refinedCandidates]
      .reverse()
      .find((candidate) => candidate.coverageRatio >= 0.015 && candidate.coverageRatio <= 0.48) ||
    [...refinedCandidates].reverse().find((candidate) => candidate.coverageRatio > 0) ||
    [...stageCandidates].reverse().find((candidate) => candidate.coverageRatio > 0) ||
    null
  );
}

function buildGeometricWallFallbackBinaryMask({
  probeWidth,
  probeHeight,
  topClip,
  bottomClip,
  sideInset,
  baseboardDeadZone,
}) {
  const binary = new Uint8Array(probeWidth * probeHeight);

  for (let y = topClip; y < bottomClip; y += 1) {
    if (y >= probeHeight - baseboardDeadZone) {
      continue;
    }

    for (let x = sideInset; x < probeWidth - sideInset; x += 1) {
      binary[y * probeWidth + x] = 1;
    }
  }

  return binary;
}

function logWallMaskStageCoverage({ presetKey, roomType, stage, coverageRatio, note = '' }) {
  console.info('vision_wall_mask_stage_debug', {
    presetKey,
    roomType,
    stage,
    wallMaskCoverage: coverageRatio,
    note: note || undefined,
  });
}

function suppressWallDangerZones(binaryMask, width, height) {
  const topDeadZone = Math.max(1, Math.round(height * 0.06));
  const bottomDeadZone = Math.max(1, Math.round(height * 0.08));
  const sideInset = Math.max(1, Math.round(width * 0.015));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (y < topDeadZone || y >= height - bottomDeadZone) {
        binaryMask[idx] = 0;
        continue;
      }
      if (x < sideInset || x >= width - sideInset) {
        binaryMask[idx] = 0;
      }
    }
  }
}

function suppressLikelyWindows(binaryMask, luminance, texture, width, height) {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const lum = Number(luminance[idx] || 0);
      const tex = Number(texture[idx] || 0);
      if (lum > 215 && tex > 18) {
        binaryMask[idx] = 0;
      }
    }
  }
}

function suppressStrongVerticalFrames(binaryMask, luminance, width, height) {
  const columnScores = new Float32Array(width);

  for (let x = 1; x < width - 1; x += 1) {
    let score = 0;
    for (let y = Math.round(height * 0.12); y < Math.round(height * 0.76); y += 1) {
      const index = y * width + x;
      const left = luminance[index - 1];
      const right = luminance[index + 1];
      score += Math.abs(left - right);
    }
    columnScores[x] = score / Math.max(1, Math.round(height * 0.64));
  }

  const threshold = 34;
  for (let x = 1; x < width - 1; x += 1) {
    if (columnScores[x] < threshold) {
      continue;
    }

    for (let y = Math.round(height * 0.12); y < Math.round(height * 0.78); y += 1) {
      const idx = y * width + x;
      binaryMask[idx] = 0;
      binaryMask[idx - 1] = 0;
      binaryMask[idx + 1] = 0;
    }
  }
}

async function buildFallbackWallPaintMaskAtSourceSize(sourceBuffer, presetKey, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const probeWidth = Math.max(96, Math.min(192, width));
  const probeHeight = Math.max(72, Math.round((height / Math.max(1, width)) * probeWidth));

  const baseMaskBuffer = await buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType);
  const [sourceProbe, baseMaskProbe] = await Promise.all([
    sharp(sourceBuffer)
      .rotate()
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(baseMaskBuffer)
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const luminance = new Float32Array(probeWidth * probeHeight);
  const texture = new Float32Array(probeWidth * probeHeight);

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      const offset = index * 3;
      const red = sourceProbe[offset];
      const green = sourceProbe[offset + 1];
      const blue = sourceProbe[offset + 2];
      luminance[index] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
  }

  for (let y = 1; y < probeHeight - 1; y += 1) {
    for (let x = 1; x < probeWidth - 1; x += 1) {
      const index = y * probeWidth + x;
      const center = luminance[index];
      texture[index] =
        (Math.abs(center - luminance[index - 1]) +
          Math.abs(center - luminance[index + 1]) +
          Math.abs(center - luminance[index - probeWidth]) +
          Math.abs(center - luminance[index + probeWidth])) /
        4;
    }
  }

  const topClip = Math.round(probeHeight * 0.08);
  const bottomClip = Math.round(probeHeight * 0.73);
  const sideInset = Math.max(1, Math.round(probeWidth * 0.025));
  const baseboardDeadZone = Math.max(1, Math.round(probeHeight * 0.08));

  const coarseBinary = new Uint8Array(probeWidth * probeHeight);
  for (let y = topClip; y < bottomClip; y += 1) {
    for (let x = sideInset; x < probeWidth - sideInset; x += 1) {
      const index = y * probeWidth + x;
      if (baseMaskProbe[index] <= 16) {
        continue;
      }
      if (y >= probeHeight - baseboardDeadZone) {
        continue;
      }
      coarseBinary[index] = 1;
    }
  }

  const geometricBinary = buildGeometricWallFallbackBinaryMask({
    probeWidth,
    probeHeight,
    topClip,
    bottomClip,
    sideInset,
    baseboardDeadZone,
  });
  const afterMorphologyCleanup = closeBinaryMask(coarseBinary, probeWidth, probeHeight, 1);
  const afterHoleFill = fillBinaryMaskHoles(afterMorphologyCleanup, probeWidth, probeHeight);
  const afterVerticalContinuity = bridgeVerticalMaskGaps(afterHoleFill, probeWidth, probeHeight, {
    startY: topClip,
    endY: bottomClip,
    maxGap: 4,
    minColumnCoverageRatio: 0.22,
  });
  const brightWindowMask = buildBrightWindowExclusionMask(
    luminance,
    texture,
    probeWidth,
    probeHeight,
    {
      startY: topClip,
      endY: bottomClip,
    },
  );
  const expandedWindowMask = dilateBinaryMask(brightWindowMask, probeWidth, probeHeight, 1);
  const afterWindowSuppression = subtractBinaryMask(afterVerticalContinuity, expandedWindowMask);
  const afterDangerSuppression = new Uint8Array(afterWindowSuppression);
  suppressWallDangerZones(afterDangerSuppression, probeWidth, probeHeight);
  const componentFiltered = filterBinaryMaskComponents(
    afterDangerSuppression,
    probeWidth,
    probeHeight,
    {
      minArea: Math.max(28, Math.round(probeWidth * probeHeight * 0.0025)),
      minBoxWidth: 6,
      minBoxHeight: 8,
    },
  );

  const stageCandidates = [
    {
      stage: 'initial_geometry_seed',
      binary: coarseBinary,
      note: 'Base inpainting wall region before any wall-specific suppression.',
    },
    {
      stage: 'after_morphology_cleanup',
      binary: afterMorphologyCleanup,
      note: 'After morphological closing to reconnect broken wall regions.',
    },
    {
      stage: 'after_hole_fill',
      binary: afterHoleFill,
      note: 'After filling interior holes inside the wall region.',
    },
    {
      stage: 'after_vertical_continuity',
      binary: afterVerticalContinuity,
      note: 'After bridging short vertical gaps in stable wall columns.',
    },
    {
      stage: 'after_window_suppression',
      binary: afterWindowSuppression,
      note: 'After hard exclusion of bright window regions.',
    },
    {
      stage: 'after_danger_zone_suppression',
      binary: afterDangerSuppression,
      note: 'After top / bottom / side danger-zone trimming.',
    },
    {
      stage: 'after_component_filter',
      binary: componentFiltered,
      note: 'After connected-component cleanup.',
    },
    {
      stage: 'hard_geometric_fallback',
      binary: geometricBinary,
      note: 'Last-resort broad wall region without base-mask dependency.',
    },
  ].map((candidate) => ({
    ...candidate,
    coverageRatio: calculateBinaryMaskCoverageRatio(candidate.binary),
  }));

  for (const candidate of stageCandidates) {
    logWallMaskStageCoverage({
      presetKey,
      roomType,
      stage: candidate.stage,
      coverageRatio: candidate.coverageRatio,
      note: candidate.note,
    });
  }

  const viableStage = selectViableWallMaskStage(stageCandidates);
  logWallMaskStageCoverage({
    presetKey,
    roomType,
    stage: viableStage?.stage || 'no_viable_stage',
    coverageRatio: viableStage?.coverageRatio || 0,
    note: 'Selected fallback wall-mask stage.',
  });
  const finalBinary = viableStage?.binary || geometricBinary;

  const adaptiveMaskBuffer = await buildBinaryMaskPngBuffer({
    binaryMask: finalBinary,
    inputWidth: probeWidth,
    inputHeight: probeHeight,
    outputWidth: width,
    outputHeight: height,
  });

  return {
    width,
    height,
    adaptiveMaskBuffer,
  };
}

function suppressFloorDangerZones(binaryMask, width, height) {
  const sideInset = Math.max(1, Math.round(width * 0.01));
  const bottomInset = Math.max(1, Math.round(height * 0.02));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (x < sideInset || x >= width - sideInset) {
        binaryMask[idx] = 0;
      }
      if (y >= height - bottomInset) {
        binaryMask[idx] = 0;
      }
    }
  }
}

async function buildAdaptiveFloorMaskAtSourceSize(sourceBuffer, presetKey, roomType) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const probeWidth = Math.max(112, Math.min(224, width));
  const probeHeight = Math.max(84, Math.round((height / Math.max(1, width)) * probeWidth));

  const baseMaskBuffer = await buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType);
  const [sourceProbe, baseMaskProbe] = await Promise.all([
    sharp(sourceBuffer)
      .rotate()
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(baseMaskBuffer)
      .resize(probeWidth, probeHeight, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const luminance = new Float32Array(probeWidth * probeHeight);
  const saturation = new Float32Array(probeWidth * probeHeight);
  const texture = new Float32Array(probeWidth * probeHeight);
  const seedRed = [];
  const seedGreen = [];
  const seedBlue = [];
  const seedLuminance = [];
  const seedSaturation = [];

  function getRgb(x, y) {
    const offset = (y * probeWidth + x) * 3;
    return [sourceProbe[offset], sourceProbe[offset + 1], sourceProbe[offset + 2]];
  }

  function getLuminanceAt(x, y) {
    return luminance[y * probeWidth + x];
  }

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      const [red, green, blue] = getRgb(x, y);
      const lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const sat = Math.max(red, green, blue) - Math.min(red, green, blue);
      luminance[index] = lum;
      saturation[index] = sat;
    }
  }

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      const centerLum = luminance[index];
      let diffTotal = 0;
      let samples = 0;
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= probeWidth || ny >= probeHeight) {
          continue;
        }
        diffTotal += Math.abs(centerLum - getLuminanceAt(nx, ny));
        samples += 1;
      }
      texture[index] = samples > 0 ? diffTotal / samples : 0;

      if (
        baseMaskProbe[index] > 32 &&
        y >= Math.round(probeHeight * 0.62) &&
        saturation[index] <= 80 &&
        luminance[index] >= 18 &&
        luminance[index] <= 240 &&
        texture[index] <= 28
      ) {
        const [red, green, blue] = getRgb(x, y);
        seedRed.push(red);
        seedGreen.push(green);
        seedBlue.push(blue);
        seedLuminance.push(luminance[index]);
        seedSaturation.push(saturation[index]);
      }
    }
  }

  const medianRed = medianChannel(seedRed, 118);
  const medianGreen = medianChannel(seedGreen, 102);
  const medianBlue = medianChannel(seedBlue, 86);
  const medianLum = medianChannel(seedLuminance, 104);
  const medianSat = medianChannel(seedSaturation, 24);
  const binary = new Uint8Array(probeWidth * probeHeight);

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = y * probeWidth + x;
      if (baseMaskProbe[index] <= 24) {
        continue;
      }
      if (y < Math.round(probeHeight * 0.42)) {
        continue;
      }

      const [red, green, blue] = getRgb(x, y);
      const lum = luminance[index];
      const sat = saturation[index];
      const edgeAmount = texture[index];
      const colorDistance = Math.sqrt(
        (red - medianRed) * (red - medianRed) +
          (green - medianGreen) * (green - medianGreen) +
          (blue - medianBlue) * (blue - medianBlue),
      );
      const isFloorPixel =
        lum >= 10 &&
        lum <= 246 &&
        sat <= Math.max(96, medianSat + 28) &&
        edgeAmount <= 34 &&
        (
          colorDistance <= 104 ||
          Math.abs(lum - medianLum) <= 62 ||
          (y >= Math.round(probeHeight * 0.72) && sat <= Math.max(110, medianSat + 36))
        );

      if (isFloorPixel) {
        binary[index] = 1;
      }
    }
  }

  let smoothed = binary;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Uint8Array(smoothed.length);
    for (let y = 0; y < probeHeight; y += 1) {
      for (let x = 0; x < probeWidth; x += 1) {
        let neighbors = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= probeWidth || ny >= probeHeight) {
              continue;
            }
            neighbors += smoothed[ny * probeWidth + nx];
          }
        }
        const index = y * probeWidth + x;
        if ((smoothed[index] && neighbors >= 4) || neighbors >= 6) {
          next[index] = 1;
        }
      }
    }
    smoothed = next;
  }

  const components = extractBinaryMaskComponents(
    smoothed,
    probeWidth,
    probeHeight,
    Math.max(80, Math.round(probeWidth * probeHeight * 0.006)),
  );
  const finalBinary = new Uint8Array(smoothed.length);
  for (const component of components) {
    if (
      component.area >= Math.max(80, Math.round(probeWidth * probeHeight * 0.006)) &&
      component.boxWidth >= Math.round(probeWidth * 0.18) &&
      component.boxHeight >= Math.round(probeHeight * 0.08)
    ) {
      for (const pixelIndex of component.pixels) {
        finalBinary[pixelIndex] = 1;
      }
    }
  }

  if (presetKey === 'floor_tile_stone') {
    const fallbackTop = Math.round(probeHeight * 0.5);
    const fallbackBottom = probeHeight - 1;
    for (let y = fallbackTop; y <= fallbackBottom; y += 1) {
      const t =
        fallbackBottom === fallbackTop ? 1 : (y - fallbackTop) / (fallbackBottom - fallbackTop);
      const leftBound = Math.round((0.28 - t * 0.23) * probeWidth);
      const rightBound = Math.round((0.72 + t * 0.23) * probeWidth);
      for (
        let x = Math.max(0, leftBound);
        x <= Math.min(probeWidth - 1, rightBound);
        x += 1
      ) {
        const index = y * probeWidth + x;
        if (baseMaskProbe[index] > 12) {
          finalBinary[index] = 1;
        }
      }
    }
  }

  suppressFloorDangerZones(finalBinary, probeWidth, probeHeight);

  const adaptiveMaskBuffer = await buildBinaryMaskPngBuffer({
    binaryMask: finalBinary,
    inputWidth: probeWidth,
    inputHeight: probeHeight,
    outputWidth: width,
    outputHeight: height,
  });

  return {
    width,
    height,
    adaptiveMaskBuffer,
  };
}

export function getTaskSpecificMaskStrategy(presetKey = '') {
  const normalizedPresetKey = String(presetKey || '');
  if (isWallPreset(normalizedPresetKey)) {
    return 'adaptive_wall';
  }
  if (isFloorPreset(normalizedPresetKey)) {
    return 'adaptive_floor';
  }

  return 'generic';
}

function validateMaskCoverage({ presetKey, coverageRatio, roomType }) {
  if (isWallPreset(presetKey) && (coverageRatio < 0.12 || coverageRatio > 0.72)) {
    throw new Error(`Wall mask coverage out of range: ${coverageRatio}`);
  }
  if (isWallPreset(presetKey) && coverageRatio < 0.3) {
    console.warn('Wall mask coverage is conservative; results may be too subtle', {
      presetKey,
      roomType,
      coverageRatio,
    });
  }

  if (isFloorPreset(presetKey) && (coverageRatio < 0.1 || coverageRatio > 0.58)) {
    throw new Error(`Floor mask coverage out of range: ${coverageRatio}`);
  }
}

export async function resolveSurfaceMaskAtSourceSize(sourceBuffer, presetKey, roomType) {
  if (isWallPreset(presetKey)) {
    try {
      const semanticWall = await segmentWallPlanesAtSourceSize(sourceBuffer, roomType, presetKey);
      validateMaskCoverage({
        presetKey,
        coverageRatio: semanticWall.debug.coverageRatio,
        roomType,
      });
      console.log('vision_wall_mask_debug', {
        presetKey,
        roomType,
        strategy: WALL_MASK_STRATEGIES.SEMANTIC,
        wallMaskCoverage: semanticWall.debug.coverageRatio,
      });
      return {
        maskBuffer: semanticWall.wallMaskBuffer,
        debug: semanticWall.debug,
      };
    } catch (semanticError) {
      console.warn('semantic wall mask failed', {
        presetKey,
        roomType,
        message: semanticError?.message || String(semanticError),
      });

      try {
        const adaptiveWall = await buildAdaptiveWallPaintMaskAtSourceSize(
          sourceBuffer,
          presetKey,
          roomType,
        );
        const coverageRatio = await calculateMaskCoverageRatio(adaptiveWall.adaptiveMaskBuffer);
        validateMaskCoverage({ presetKey, coverageRatio, roomType });
        console.log('vision_wall_mask_debug', {
          presetKey,
          roomType,
          strategy: WALL_MASK_STRATEGIES.ADAPTIVE,
          wallMaskCoverage: coverageRatio,
          reason: semanticError?.message || String(semanticError),
        });
        return {
          maskBuffer: adaptiveWall.adaptiveMaskBuffer,
          debug: {
            strategy: WALL_MASK_STRATEGIES.ADAPTIVE,
            maskCoverageRatio: coverageRatio,
          },
        };
      } catch (adaptiveError) {
        const fallbackWall = await buildFallbackWallPaintMaskAtSourceSize(
          sourceBuffer,
          presetKey,
          roomType,
        );
        const fallbackCoverageRatio = await calculateMaskCoverageRatio(
          fallbackWall.adaptiveMaskBuffer,
        );
        console.log('vision_wall_mask_debug', {
          presetKey,
          roomType,
          strategy: WALL_MASK_STRATEGIES.FALLBACK,
          wallMaskCoverage: fallbackCoverageRatio,
          reason: adaptiveError?.message || String(adaptiveError),
        });
        if (fallbackCoverageRatio < 0.05) {
          throw new Error(`Fallback wall mask coverage out of range: ${fallbackCoverageRatio}`);
        }
        return {
          maskBuffer: fallbackWall.adaptiveMaskBuffer,
          debug: {
            strategy: WALL_MASK_STRATEGIES.FALLBACK,
            maskCoverageRatio: fallbackCoverageRatio,
          },
        };
      };
    }
  }

  if (isFloorPreset(presetKey)) {
    const floor = await buildAdaptiveFloorMaskAtSourceSize(sourceBuffer, presetKey, roomType);
    const coverageRatio = await calculateMaskCoverageRatio(floor.adaptiveMaskBuffer);
    validateMaskCoverage({ presetKey, coverageRatio, roomType });
    return {
      maskBuffer: floor.adaptiveMaskBuffer,
      debug: { strategy: 'adaptive_floor', maskCoverageRatio: coverageRatio },
    };
  }

  return {
    maskBuffer: await buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType),
    debug: { strategy: 'geometric_fallback', maskCoverageRatio: null },
  };
}

async function buildTaskSpecificMaskBuffer(sourceBuffer, presetKey, roomType) {
  try {
    const resolvedMask = await resolveSurfaceMaskAtSourceSize(sourceBuffer, presetKey, roomType);
    return resolvedMask.maskBuffer;
  } catch (error) {
    console.warn('Surface mask fallback triggered', {
      presetKey,
      roomType,
      message: error?.message || String(error),
    });
    return buildInpaintingMaskBuffer(sourceBuffer, presetKey, roomType);
  }
}

async function buildAdaptiveFurnitureMaskBuffer(sourceBuffer, options = {}) {
  const bridgeNearbyComponents = options.bridgeNearbyComponents !== false;
  const probeWidth = 72;
  const probeHeight = 72;
  const probe = await sharp(sourceBuffer)
    .rotate()
    .resize(probeWidth, probeHeight, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer();

  function getRgb(x, y) {
    const offset = (y * probeWidth + x) * 3;
    return [probe[offset], probe[offset + 1], probe[offset + 2]];
  }

  const topPixels = [];
  for (let y = 0; y < Math.floor(probeHeight * 0.3); y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      topPixels.push(getRgb(x, y));
    }
  }
  const channels = [0, 1, 2].map((channelIndex) =>
    topPixels
      .map((pixel) => pixel[channelIndex])
      .sort((left, right) => left - right),
  );
  const median = channels.map((channelValues) =>
    channelValues[Math.floor(channelValues.length / 2)] || 128,
  );
  const wallLuminance = 0.2126 * median[0] + 0.7152 * median[1] + 0.0722 * median[2];

  const binary = new Uint8Array(probeWidth * probeHeight);
  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      if (y < Math.floor(probeHeight * 0.34)) {
        continue;
      }
      const [r, g, b] = getRgb(x, y);
      const dr = r - median[0];
      const dg = g - median[1];
      const db = b - median[2];
      const colorDistance = Math.sqrt(dr * dr + dg * dg + db * db);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      const darkObjectScore = wallLuminance - luminance;

      const isCandidate =
        colorDistance > 38 ||
        (darkObjectScore > 20 && saturation < 68) ||
        (darkObjectScore > 14 && colorDistance > 28);
      if (!isCandidate) {
        continue;
      }

      binary[y * probeWidth + x] = 255;
    }
  }

  const dilated = new Uint8Array(binary.length);
  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      let neighbors = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= probeWidth || ny >= probeHeight) {
            continue;
          }
          if (binary[ny * probeWidth + nx]) {
            neighbors += 1;
          }
        }
      }
      if (binary[y * probeWidth + x] || neighbors >= 3) {
        dilated[y * probeWidth + x] = 255;
      }
    }
  }

  const visited = new Uint8Array(dilated.length);
  const furnitureMask = new Uint8Array(dilated.length);
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const startIndex = y * probeWidth + x;
      if (!dilated[startIndex] || visited[startIndex]) {
        continue;
      }

      const queue = [startIndex];
      visited[startIndex] = 1;
      const component = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      while (queue.length) {
        const index = queue.pop();
        const currentX = index % probeWidth;
        const currentY = Math.floor(index / probeWidth);
        component.push(index);
        sumX += currentX;
        sumY += currentY;
        if (currentX < minX) {
          minX = currentX;
        }
        if (currentX > maxX) {
          maxX = currentX;
        }
        if (currentY < minY) {
          minY = currentY;
        }
        if (currentY > maxY) {
          maxY = currentY;
        }

        for (const [dx, dy] of directions) {
          const nx = currentX + dx;
          const ny = currentY + dy;
          if (nx < 0 || ny < 0 || nx >= probeWidth || ny >= probeHeight) {
            continue;
          }
          const nextIndex = ny * probeWidth + nx;
          if (!dilated[nextIndex] || visited[nextIndex]) {
            continue;
          }
          visited[nextIndex] = 1;
          queue.push(nextIndex);
        }
      }

      const area = component.length;
      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const centroidY = sumY / Math.max(1, area);
      const aspectRatio = boxWidth / Math.max(1, boxHeight);
      const areaRatio = area / Math.max(1, boxWidth * boxHeight);

      const isLargeAnchorFurniture =
        area >= 42 &&
        boxWidth >= 6 &&
        boxHeight >= 5 &&
        centroidY >= probeHeight * 0.36 &&
        (areaRatio > 0.18 || aspectRatio > 1.35 || boxHeight > 8);
      const isMediumFurniture =
        area >= 24 &&
        boxWidth >= 4 &&
        boxHeight >= 4 &&
        centroidY >= probeHeight * 0.42 &&
        (areaRatio > 0.2 || (aspectRatio >= 0.7 && aspectRatio <= 2.8));
      const isWideSurfaceObject =
        area >= 18 &&
        boxWidth >= 7 &&
        boxHeight >= 3 &&
        centroidY >= probeHeight * 0.45 &&
        aspectRatio >= 1.9;
      const touchesSideEdge = minX <= 2 || maxX >= probeWidth - 3;
      const isTallNarrowWallStorageZone =
        touchesSideEdge &&
        boxHeight >= 12 &&
        aspectRatio <= 0.55 &&
        areaRatio >= 0.34 &&
        centroidY <= probeHeight * 0.74;
      if (isTallNarrowWallStorageZone) {
        continue;
      }
      if (!(isLargeAnchorFurniture || isMediumFurniture || isWideSurfaceObject)) {
        continue;
      }

      const expand = area > 56 ? 2 : 1;
      for (let yy = Math.max(0, minY - expand); yy <= Math.min(probeHeight - 1, maxY + expand); yy += 1) {
        for (let xx = Math.max(0, minX - expand); xx <= Math.min(probeWidth - 1, maxX + expand); xx += 1) {
          furnitureMask[yy * probeWidth + xx] = 255;
        }
      }
    }
  }

  const finalMask = bridgeNearbyComponents ? new Uint8Array(furnitureMask.length) : furnitureMask;
  if (bridgeNearbyComponents) {
    for (let y = 0; y < probeHeight; y += 1) {
      for (let x = 0; x < probeWidth; x += 1) {
        const idx = y * probeWidth + x;
        if (furnitureMask[idx]) {
          finalMask[idx] = 255;
          continue;
        }
        let nearbyFurniture = 0;
        for (let oy = -2; oy <= 2; oy += 1) {
          for (let ox = -2; ox <= 2; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= probeWidth || ny >= probeHeight) {
              continue;
            }
            if (furnitureMask[ny * probeWidth + nx]) {
              nearbyFurniture += 1;
            }
          }
        }
        if (nearbyFurniture >= 8) {
          finalMask[idx] = 255;
        }
      }
    }
  }

  const rgba = Buffer.alloc(probeWidth * probeHeight * 4);
  for (let i = 0; i < finalMask.length; i += 1) {
    const value = finalMask[i];
    const offset = i * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  }

  return sharp(rgba, {
    raw: { width: probeWidth, height: probeHeight, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function buildAdaptiveFurnitureMaskAtSourceSize(sourceBuffer, options = {}) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const adaptiveMaskProbe = await buildAdaptiveFurnitureMaskBuffer(sourceBuffer, options);
  const adaptiveMaskBuffer = await sharp(adaptiveMaskProbe)
    .resize(width, height, { fit: 'fill' })
    .blur(1.1)
    .png()
    .toBuffer();

  return {
    width,
    height,
    adaptiveMaskBuffer,
  };
}

async function calculateMaskCoverageRatio(maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const raw = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer();
  let whitePixels = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if ((raw[i] || 0) >= 128) {
      whitePixels += 1;
    }
  }

  return Number((whitePixels / Math.max(1, width * height)).toFixed(4));
}

async function calculateMaskedVisualChangeRatio(sourceBuffer, variantBuffer, maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const [src, next, mask] = await Promise.all([
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(variantBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  let maskPixels = 0;
  let changedPixels = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (mask[i] <= 32) {
      continue;
    }
    maskPixels += 1;
    const offset = i * 3;
    const delta =
      (Math.abs(src[offset] - next[offset]) +
        Math.abs(src[offset + 1] - next[offset + 1]) +
        Math.abs(src[offset + 2] - next[offset + 2])) /
      3;
    if (delta >= 18) {
      changedPixels += 1;
    }
  }

  return Number((changedPixels / Math.max(1, maskPixels)).toFixed(4));
}

async function calculateMaskedLuminanceDelta(sourceBuffer, variantBuffer, maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const [src, next, mask] = await Promise.all([
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(variantBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  let maskPixels = 0;
  let srcLuminanceTotal = 0;
  let nextLuminanceTotal = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (mask[i] <= 32) {
      continue;
    }
    maskPixels += 1;
    const offset = i * 3;
    srcLuminanceTotal +=
      src[offset] * 0.2126 + src[offset + 1] * 0.7152 + src[offset + 2] * 0.0722;
    nextLuminanceTotal +=
      next[offset] * 0.2126 + next[offset + 1] * 0.7152 + next[offset + 2] * 0.0722;
  }

  const averageSourceLuminance = srcLuminanceTotal / Math.max(1, maskPixels);
  const averageVariantLuminance = nextLuminanceTotal / Math.max(1, maskPixels);
  return Number(
    ((averageVariantLuminance - averageSourceLuminance) / 255).toFixed(4),
  );
}

async function calculateMaskedAverageColorShiftRatio(sourceBuffer, variantBuffer, maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const [src, next, mask] = await Promise.all([
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(variantBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  let maskPixels = 0;
  let averageDeltaTotal = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (mask[i] <= 32) {
      continue;
    }
    maskPixels += 1;
    const offset = i * 3;
    averageDeltaTotal +=
      (Math.abs(src[offset] - next[offset]) +
        Math.abs(src[offset + 1] - next[offset + 1]) +
        Math.abs(src[offset + 2] - next[offset + 2])) /
      3;
  }

  const averageChannelDelta = averageDeltaTotal / Math.max(1, maskPixels);
  return Number((averageChannelDelta / 255).toFixed(4));
}

async function calculateOutsideMaskVisualChangeRatio(sourceBuffer, variantBuffer, maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const [src, next, rawMask] = await Promise.all([
    sharp(sourceBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(variantBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  const expandedMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let isNearMask = false;
      for (let oy = -2; oy <= 2 && !isNearMask; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          if (rawMask[ny * width + nx] > 32) {
            isNearMask = true;
            break;
          }
        }
      }
      if (isNearMask) {
        expandedMask[y * width + x] = 1;
      }
    }
  }

  let outsidePixels = 0;
  let changedOutsidePixels = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (expandedMask[i]) {
      continue;
    }
    outsidePixels += 1;
    const offset = i * 3;
    const delta =
      (Math.abs(src[offset] - next[offset]) +
        Math.abs(src[offset + 1] - next[offset + 1]) +
        Math.abs(src[offset + 2] - next[offset + 2])) /
      3;
    if (delta >= 18) {
      changedOutsidePixels += 1;
    }
  }

  return Number((changedOutsidePixels / Math.max(1, outsidePixels)).toFixed(4));
}

async function calculateMaskedEdgeDensity(imageBuffer, maskBuffer) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const [image, mask] = await Promise.all([
    sharp(imageBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
    sharp(maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer(),
  ]);

  let maskPixels = 0;
  let edgePixels = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      if (mask[idx] <= 32) {
        continue;
      }
      maskPixels += 1;
      const gx =
        Math.abs(image[idx + 1] - image[idx - 1]) +
        Math.abs(image[idx + 1 + width] - image[idx - 1 + width]) +
        Math.abs(image[idx + 1 - width] - image[idx - 1 - width]);
      const gy =
        Math.abs(image[idx + width] - image[idx - width]) +
        Math.abs(image[idx + width + 1] - image[idx - width + 1]) +
        Math.abs(image[idx + width - 1] - image[idx - width - 1]);
      const magnitude = (gx + gy) / 6;
      if (magnitude > 26) {
        edgePixels += 1;
      }
    }
  }

  return Number((edgePixels / Math.max(1, maskPixels)).toFixed(4));
}

async function blendVariantWithSourceMask({
  sourceBuffer,
  variantBuffer,
  maskBuffer,
  maskBlur = 2.2,
}) {
  const metadata = await sharp(sourceBuffer).rotate().metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  const [baseBuffer, editedBuffer, alphaMaskBuffer] = await Promise.all([
    sharp(sourceBuffer).rotate().resize(width, height, { fit: 'fill' }).png().toBuffer(),
    sharp(variantBuffer).rotate().resize(width, height, { fit: 'fill' }).png().toBuffer(),
    sharp(maskBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .greyscale()
      .blur(maskBlur)
      .toBuffer(),
  ]);

  const overlayBuffer = await sharp(editedBuffer)
    .removeAlpha()
    .joinChannel(alphaMaskBuffer)
    .png()
    .toBuffer();

  return sharp(baseBuffer)
    .composite([{ input: overlayBuffer, blend: 'over' }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function readBinaryMask(maskBuffer, threshold = 32) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const raw = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer();
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i += 1) {
    binary[i] = raw[i] > threshold ? 1 : 0;
  }

  return {
    width,
    height,
    binary,
  };
}

function extractBinaryMaskComponents(binary, width, height, minArea = 0) {
  const visited = new Uint8Array(binary.length);
  const components = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = y * width + x;
      if (!binary[startIndex] || visited[startIndex]) {
        continue;
      }

      const queue = [startIndex];
      visited[startIndex] = 1;
      const pixels = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (queue.length) {
        const index = queue.pop();
        const currentX = index % width;
        const currentY = Math.floor(index / width);
        pixels.push(index);
        if (currentX < minX) {
          minX = currentX;
        }
        if (currentX > maxX) {
          maxX = currentX;
        }
        if (currentY < minY) {
          minY = currentY;
        }
        if (currentY > maxY) {
          maxY = currentY;
        }

        for (const [dx, dy] of directions) {
          const nx = currentX + dx;
          const ny = currentY + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const nextIndex = ny * width + nx;
          if (!binary[nextIndex] || visited[nextIndex]) {
            continue;
          }
          visited[nextIndex] = 1;
          queue.push(nextIndex);
        }
      }

      if (pixels.length < minArea) {
        continue;
      }

      components.push({
        area: pixels.length,
        pixels,
        minX,
        maxX,
        minY,
        maxY,
      });
    }
  }

  return components.sort((left, right) => right.area - left.area);
}

async function calculateFurniturePersistenceMetrics({
  sourceComponentMaskBuffer,
  sourceComponents = [],
  variantBuffer,
}) {
  if (!sourceComponentMaskBuffer || !sourceComponents.length) {
    return {
      remainingFurnitureOverlapRatio: 0,
      largestComponentPersistenceRatio: 0,
      clearedMajorComponentCount: 0,
      totalMajorComponentCount: 0,
    };
  }

  const variantAdaptiveFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(variantBuffer, {
    bridgeNearbyComponents: false,
  });
  const {
    width,
    height,
    binary: sourceBinary,
  } = await readBinaryMask(sourceComponentMaskBuffer, 40);
  const { binary: variantBinary } = await readBinaryMask(
    variantAdaptiveFurnitureMask.adaptiveMaskBuffer,
    40,
  );
  const totalSourcePixels = sourceComponents.reduce((sum, component) => sum + component.area, 0);
  if (!totalSourcePixels) {
    return {
      remainingFurnitureOverlapRatio: 0,
      largestComponentPersistenceRatio: 0,
      newFurnitureAdditionRatio: 0,
      clearedMajorComponentCount: 0,
      totalMajorComponentCount: 0,
    };
  }

  const sourceAllowanceBinary = new Uint8Array(sourceBinary.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let touchesSource = false;
      for (let oy = -2; oy <= 2 && !touchesSource; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          if (sourceBinary[ny * width + nx]) {
            touchesSource = true;
            break;
          }
        }
      }
      if (touchesSource) {
        sourceAllowanceBinary[y * width + x] = 1;
      }
    }
  }

  const majorComponents = sourceComponents.filter(
    (component, index) =>
      index < 3 && component.area >= Math.max(1200, Math.round(totalSourcePixels * 0.12)),
  );
  const effectiveMajorComponents =
    majorComponents.length > 0 ? majorComponents : sourceComponents.slice(0, 1);

  let overlappingPixels = 0;
  let totalVariantFurniturePixels = 0;
  let addedFurniturePixels = 0;
  let largestComponentPersistenceRatio = 0;
  let clearedMajorComponentCount = 0;
  for (let pixelIndex = 0; pixelIndex < variantBinary.length; pixelIndex += 1) {
    if (!variantBinary[pixelIndex]) {
      continue;
    }
    totalVariantFurniturePixels += 1;
    if (!sourceAllowanceBinary[pixelIndex]) {
      addedFurniturePixels += 1;
    }
  }
  for (const component of sourceComponents) {
    let componentOverlap = 0;
    for (const pixelIndex of component.pixels) {
      if (variantBinary[pixelIndex]) {
        overlappingPixels += 1;
        componentOverlap += 1;
      }
    }

    if (effectiveMajorComponents.includes(component)) {
      const persistenceRatio = Number(
        (componentOverlap / Math.max(1, component.area)).toFixed(4),
      );
      if (persistenceRatio > largestComponentPersistenceRatio) {
        largestComponentPersistenceRatio = persistenceRatio;
      }
      if (persistenceRatio <= 0.38) {
        clearedMajorComponentCount += 1;
      }
    }
  }

  return {
    remainingFurnitureOverlapRatio: Number(
      (overlappingPixels / Math.max(1, totalSourcePixels)).toFixed(4),
    ),
    largestComponentPersistenceRatio: Number(largestComponentPersistenceRatio.toFixed(4)),
    newFurnitureAdditionRatio: Number(
      (addedFurniturePixels / Math.max(1, totalVariantFurniturePixels)).toFixed(4),
    ),
    clearedMajorComponentCount,
    totalMajorComponentCount: effectiveMajorComponents.length,
  };
}

function buildVisionInputHash({ assetId, presetKey, roomType, promptVersion }) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        assetId,
        presetKey,
        roomType,
        promptVersion,
        mode: 'preset',
        instructions: '',
      }),
    )
    .digest('hex');
}

function buildVisionJobHash({
  assetId,
  sourceVariantId = '',
  presetKey,
  roomType,
  promptVersion,
  mode = 'preset',
  instructions = '',
  userPlan = '',
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        assetId,
        sourceVariantId: String(sourceVariantId || ''),
        presetKey,
        roomType,
        promptVersion,
        mode,
        instructions: String(instructions || '').trim().toLowerCase(),
        userPlan: String(userPlan || '').trim().toLowerCase(),
      }),
    )
    .digest('hex');
}

async function loadJobVariants(jobId) {
  if (!jobId) {
    return [];
  }

  const variants = await MediaVariantModel.find({
    visionJobId: jobId,
    ...buildActiveVariantQuery(),
  })
    .sort({ createdAt: -1 })
    .lean();
  return sortVisionVariants(variants.map(serializeMediaVariant));
}

export function getVisionPresetCatalog() {
  return listVisionPresets();
}

export async function listMediaVariants(
  assetId,
  { offset = 0, limit = 0, includeTotalCount = false } = {},
) {
  if (mongoose.connection.readyState !== 1) {
    return includeTotalCount
      ? { variants: [], totalCount: 0, offset: 0, limit: 0, hasMore: false }
      : [];
  }

  const normalizedOffset = Math.max(0, Number(offset) || 0);
  const normalizedLimit = Math.max(0, Number(limit) || 0);
  const baseQuery = { mediaId: assetId, ...buildActiveVariantQuery() };

  let totalCount = 0;
  if (includeTotalCount) {
    totalCount = await MediaVariantModel.countDocuments(baseQuery);
  }

  let query = MediaVariantModel.find(baseQuery).sort({ createdAt: -1 });
  if (normalizedOffset) {
    query = query.skip(normalizedOffset);
  }
  if (normalizedLimit) {
    query = query.limit(normalizedLimit);
  }

  const variants = await query.lean();
  const serializedVariants = sortVisionVariants(variants.map(serializeMediaVariant));

  if (!includeTotalCount && !normalizedLimit && !normalizedOffset) {
    return serializedVariants;
  }

  const resolvedTotalCount = includeTotalCount
    ? totalCount
    : normalizedOffset + serializedVariants.length;

  return {
    variants: serializedVariants,
    totalCount: resolvedTotalCount,
    offset: normalizedOffset,
    limit: normalizedLimit,
    hasMore:
      normalizedLimit > 0
        ? normalizedOffset + serializedVariants.length < resolvedTotalCount
        : false,
  };
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

export async function cancelImageJob(jobId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to cancel image jobs.');
  }

  const job = await ImageJobModel.findById(jobId);
  if (!job) {
    return null;
  }

  if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
    job.status = 'cancelled';
    job.currentStage = 'cancelled';
    job.failureReason = 'cancelled_by_user';
    job.fallbackMode = null;
    job.warning = 'Vision generation was cancelled before a new result was selected.';
    job.message = 'Vision generation cancelled.';
    job.cancelledAt = new Date();
    await job.save();
  }

  const variants = await loadJobVariants(job._id);
  return serializeImageJob(job.toObject(), variants);
}

export async function listImageJobsForAsset(assetId, options = {}) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const limit = Math.max(1, Math.min(20, Number(options.limit || 10)));
  const jobs = await ImageJobModel.find({ mediaId: assetId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const serializedJobs = [];
  for (const job of jobs) {
    const variants = await loadJobVariants(job._id);
    serializedJobs.push(serializeImageJob(job, variants));
  }

  return serializedJobs;
}

async function buildReviewedLocalSharpCandidates({
  asset,
  preset,
  renderPlan,
  resolvedRoomType,
  requestedMode,
  normalizedInstructions,
  normalizedPlan,
  sourceBuffer,
  sourceImageBase64,
}) {
  const rendered = await renderVariantBuffer(sourceBuffer, preset.key, resolvedRoomType);
  let surfaceMaskDebug =
    isWallPreset(preset.key) || isFloorPreset(preset.key) ? rendered.debug || null : null;
  if (preset.key === 'floor_tile_stone' && rendered.debug?.floorMaskBuffer && asset?.propertyId) {
    const propertyId = asset.propertyId?.toString?.() || String(asset.propertyId);
    const [maskStorage, preblendStorage] = await Promise.all([
      saveBinaryBuffer({
        propertyId,
        mimeType: 'image/png',
        buffer: rendered.debug.floorMaskBuffer,
      }),
      saveBinaryBuffer({
        propertyId,
        mimeType: 'image/png',
        buffer: rendered.debug.preblendBuffer,
      }),
    ]);
    console.info('vision_local_finish_debug', {
      presetKey: preset.key,
      roomType: resolvedRoomType,
      maskCoverageRatio: rendered.debug.maskCoverageRatio,
      floorMaskUrl: buildTemporaryStoredAssetUrl({
        storageProvider: maskStorage.storageProvider,
        storageKey: maskStorage.storageKey,
        mimeType: 'image/png',
      }),
      floorPreviewUrl: buildTemporaryStoredAssetUrl({
        storageProvider: preblendStorage.storageProvider,
        storageKey: preblendStorage.storageKey,
        mimeType: 'image/png',
      }),
    });
  }
  const evaluationRegions = getPresetEvaluationRegions(preset.key);
  let maskBuffer = null;
  let visualChangeRatio = await calculateVisualChangeRatio(sourceBuffer, rendered.buffer);
  let focusRegionChangeRatio = await calculateVisualChangeRatio(sourceBuffer, rendered.buffer, {
    region: evaluationRegions.focusRegion,
  });
  let topHalfChangeRatio = await calculateVisualChangeRatio(sourceBuffer, rendered.buffer, {
    region: evaluationRegions.structureRegion,
  });
  let maskedChangeRatio = 0;
  let maskedLuminanceDelta = 0;
  let maskedColorShiftRatio = 0;
  let outsideMaskChangeRatio = 0;
  let maskedEdgeDensityDelta = 0;
  let furnitureCoverageIncreaseRatio = 0;
  let newFurnitureAdditionRatio = 0;

  if (isWallPreset(preset.key) || isFloorPreset(preset.key)) {
    if (surfaceMaskDebug?.wallMaskBuffer || surfaceMaskDebug?.floorMaskBuffer) {
      maskBuffer = surfaceMaskDebug.wallMaskBuffer || surfaceMaskDebug.floorMaskBuffer;
    } else {
      const resolvedMask = await resolveSurfaceMaskAtSourceSize(
        sourceBuffer,
        preset.key,
        resolvedRoomType,
      );
      maskBuffer = resolvedMask.maskBuffer;
      surfaceMaskDebug = {
        ...(surfaceMaskDebug || {}),
        ...(resolvedMask.debug || {}),
      };
    }
  }

  if (maskBuffer) {
    maskedChangeRatio = await calculateMaskedVisualChangeRatio(
      sourceBuffer,
      rendered.buffer,
      maskBuffer,
    );
    maskedLuminanceDelta = await calculateMaskedLuminanceDelta(
      sourceBuffer,
      rendered.buffer,
      maskBuffer,
    );
    maskedColorShiftRatio = await calculateMaskedAverageColorShiftRatio(
      sourceBuffer,
      rendered.buffer,
      maskBuffer,
    );
    outsideMaskChangeRatio = await calculateOutsideMaskVisualChangeRatio(
      sourceBuffer,
      rendered.buffer,
      maskBuffer,
    );

    if (preset.key.startsWith('paint_')) {
      const sourcePaintEdgeDensity = await calculateMaskedEdgeDensity(sourceBuffer, maskBuffer);
      const variantPaintEdgeDensity = await calculateMaskedEdgeDensity(rendered.buffer, maskBuffer);
      maskedEdgeDensityDelta = Number(
        (variantPaintEdgeDensity - sourcePaintEdgeDensity).toFixed(4),
      );
    }
  }

  if (preset.key.startsWith('paint_') || preset.key.startsWith('floor_')) {
    const sourceFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(sourceBuffer, {
      bridgeNearbyComponents: false,
    });
    const sourceFurnitureCoverageRatio = await calculateMaskCoverageRatio(
      sourceFurnitureMask.adaptiveMaskBuffer,
    );
    const variantFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(rendered.buffer, {
      bridgeNearbyComponents: false,
    });
    const variantFurnitureCoverageRatio = await calculateMaskCoverageRatio(
      variantFurnitureMask.adaptiveMaskBuffer,
    );
    furnitureCoverageIncreaseRatio = Number(
      Math.max(0, variantFurnitureCoverageRatio - sourceFurnitureCoverageRatio).toFixed(4),
    );

    const sourceComponentBinary = await readBinaryMask(sourceFurnitureMask.adaptiveMaskBuffer, 40);
    const sourceFurnitureComponents = extractBinaryMaskComponents(
      sourceComponentBinary.binary,
      sourceComponentBinary.width,
      sourceComponentBinary.height,
      Math.max(
        400,
        Math.round(sourceComponentBinary.width * sourceComponentBinary.height * 0.004),
      ),
    );
    if (sourceFurnitureComponents.length) {
      const persistenceMetrics = await calculateFurniturePersistenceMetrics({
        sourceComponentMaskBuffer: sourceFurnitureMask.adaptiveMaskBuffer,
        sourceComponents: sourceFurnitureComponents,
        variantBuffer: rendered.buffer,
      });
      newFurnitureAdditionRatio = Number(persistenceMetrics.newFurnitureAdditionRatio || 0);
    }
  }

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

  return [
    {
      providerKey: 'local_sharp',
      output: null,
      buffer: rendered.buffer,
      warning: rendered.warning,
      label: rendered.label,
      summary: renderPlan.summary,
      differenceHint: renderPlan.differenceHint,
      effects: rendered.effects || renderPlan.effects,
      cropInsetPercent: rendered.cropInsetPercent,
      roomPromptAddon: rendered.roomPromptAddon,
      presetPromptAddon: '',
      mode: requestedMode,
      instructions: normalizedInstructions,
      normalizedPlan,
      providerSourceUrl: null,
      maskStrategy: surfaceMaskDebug?.strategy || null,
      maskCoverageRatio:
        surfaceMaskDebug?.coverageRatio ?? surfaceMaskDebug?.maskCoverageRatio ?? null,
      rawMaskCoverageRatio: surfaceMaskDebug?.rawMaskCoverageRatio ?? null,
      refinementStages: surfaceMaskDebug?.refinementStages || [],
      windowRejectionCoverageRatio: surfaceMaskDebug?.windowRejectionCoverageRatio ?? null,
      windowBrightPixelRatio: surfaceMaskDebug?.windowBrightPixelRatio ?? null,
      windowStructuredPixelRatio: surfaceMaskDebug?.windowStructuredPixelRatio ?? null,
      review,
      overallScore,
      visualChangeRatio,
      focusRegionChangeRatio,
      topHalfChangeRatio,
      maskedChangeRatio,
      maskedLuminanceDelta,
      maskedColorShiftRatio,
      outsideMaskChangeRatio,
      maskedEdgeDensityDelta,
      furnitureCoverageIncreaseRatio,
      newFurnitureAdditionRatio,
      objectRemovalScore: 0,
      shouldHideByDefault: false,
    },
  ];
}

async function buildReviewedReplicateCandidates({
  providerKey,
  asset,
  preset,
  renderPlan,
  resolvedRoomType,
  requestedMode,
  normalizedInstructions,
  normalizedPlan,
  fullPrompt,
  roomPromptAddon,
  presetPromptAddon,
  sourceBuffer,
  sourceImageBase64,
}) {
  const resolvedMask = await resolveSurfaceMaskAtSourceSize(
    sourceBuffer,
    preset.key,
    resolvedRoomType,
  ).catch(async (error) => {
    console.warn('Surface mask fallback triggered', {
      presetKey: preset.key,
      roomType: resolvedRoomType,
      message: error?.message || String(error),
    });
    return {
      maskBuffer: await buildInpaintingMaskBuffer(sourceBuffer, preset.key, resolvedRoomType),
      debug: { strategy: 'geometric_fallback', maskCoverageRatio: null },
    };
  });
  const maskBuffer = resolvedMask.maskBuffer;
  let removeFurnitureEvaluationMaskBuffer = null;
  let sourceFurnitureEdgeDensity = null;
  let paintEvaluationMaskBuffer = null;
  let sourcePaintEdgeDensity = null;
  let sourceFurnitureComponentMaskBuffer = null;
  let sourceFurnitureComponents = [];
  let sourceFurnitureCoverageRatio = 0;
  if (preset.key === 'remove_furniture' || preset.key.startsWith('floor_')) {
    const adaptiveFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(sourceBuffer);
    const adaptiveCoverageRatio = await calculateMaskCoverageRatio(
      adaptiveFurnitureMask.adaptiveMaskBuffer,
    );
    sourceFurnitureCoverageRatio = adaptiveCoverageRatio;
    if (!preset.key.startsWith('floor_')) {
      removeFurnitureEvaluationMaskBuffer =
        adaptiveCoverageRatio >= 0.03 ? adaptiveFurnitureMask.adaptiveMaskBuffer : maskBuffer;
      sourceFurnitureEdgeDensity = await calculateMaskedEdgeDensity(
        sourceBuffer,
        removeFurnitureEvaluationMaskBuffer,
      );
      const componentMask = await buildAdaptiveFurnitureMaskAtSourceSize(sourceBuffer, {
        bridgeNearbyComponents: false,
      });
      sourceFurnitureComponentMaskBuffer = componentMask.adaptiveMaskBuffer;
      const sourceComponentBinary = await readBinaryMask(sourceFurnitureComponentMaskBuffer, 40);
      sourceFurnitureComponents = extractBinaryMaskComponents(
        sourceComponentBinary.binary,
        sourceComponentBinary.width,
        sourceComponentBinary.height,
        Math.max(400, Math.round(sourceComponentBinary.width * sourceComponentBinary.height * 0.004)),
      );
    }
  }
  if (preset.key.startsWith('paint_')) {
    paintEvaluationMaskBuffer = maskBuffer;
    sourcePaintEdgeDensity = await calculateMaskedEdgeDensity(sourceBuffer, paintEvaluationMaskBuffer);
  }
  const computeFurnitureCoverageIncreaseRatio = async (candidateBuffer) => {
    if (!preset.key.startsWith('floor_')) {
      return 0;
    }

    const variantAdaptiveFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(candidateBuffer, {
      bridgeNearbyComponents: false,
    });
    const variantFurnitureCoverageRatio = await calculateMaskCoverageRatio(
      variantAdaptiveFurnitureMask.adaptiveMaskBuffer,
    );
    return Number(
      Math.max(0, variantFurnitureCoverageRatio - sourceFurnitureCoverageRatio).toFixed(4),
    );
  };

  const settings = getReplicateSettings(providerKey, preset);
  const providerPrompt =
    providerKey === 'replicate_advanced'
      ? `${fullPrompt} Return the strongest usable version for this request. Prefer meaningful improvement over near-original output, but preserve the true room structure.`
      : fullPrompt;
  const propertyId = asset.propertyId?.toString?.() || String(asset.propertyId || '');
  const initialReplicateInputs = await buildTemporaryReplicateInputUrls({
    propertyId,
    imageBuffer: sourceBuffer,
    maskBuffer,
    presetKey: preset.key,
    providerKey,
  });
  if (isWallPreset(preset.key) || isFloorPreset(preset.key)) {
    console.info('vision_surface_mask_debug', {
      presetKey: preset.key,
      providerKey,
      strategy: resolvedMask.debug?.strategy || null,
      maskCoverageRatio:
        resolvedMask.debug?.coverageRatio ?? resolvedMask.debug?.maskCoverageRatio ?? null,
      rawMaskCoverageRatio: resolvedMask.debug?.rawCoverageRatio ?? null,
    });
  }
  const providerOutputs = await runReplicateInpainting({
    image: initialReplicateInputs.imageUrl,
    mask: initialReplicateInputs.maskUrl,
    model: settings.model,
    prompt: providerPrompt,
    strength: settings.strength,
    outputCount: settings.outputCount,
    guidanceScale: settings.guidanceScale,
    numInferenceSteps: settings.numInferenceSteps,
    scheduler: settings.scheduler,
    negativePrompt: settings.negativePrompt,
    seed: Math.floor(Math.random() * 1_000_000_000),
  });

  const evaluationRegions = getPresetEvaluationRegions(preset.key);
  const computeFurnitureRemovalMetrics = async (candidateBuffer) => {
    if (!removeFurnitureEvaluationMaskBuffer || sourceFurnitureEdgeDensity == null) {
      return {
        maskedChangeRatio: 0,
        outsideMaskChangeRatio: 0,
        maskedEdgeDensityDelta: 0,
        remainingFurnitureOverlapRatio: 0,
        largestComponentPersistenceRatio: 0,
        newFurnitureAdditionRatio: 0,
        clearedMajorComponentCount: 0,
        totalMajorComponentCount: 0,
      };
    }
    const maskedChangeRatio = await calculateMaskedVisualChangeRatio(
      sourceBuffer,
      candidateBuffer,
      removeFurnitureEvaluationMaskBuffer,
    );
    const outsideMaskChangeRatio = await calculateOutsideMaskVisualChangeRatio(
      sourceBuffer,
      candidateBuffer,
      removeFurnitureEvaluationMaskBuffer,
    );
    const variantFurnitureEdgeDensity = await calculateMaskedEdgeDensity(
      candidateBuffer,
      removeFurnitureEvaluationMaskBuffer,
    );
    const maskedEdgeDensityDelta = Number(
      (variantFurnitureEdgeDensity - sourceFurnitureEdgeDensity).toFixed(4),
    );
    const persistenceMetrics = await calculateFurniturePersistenceMetrics({
      sourceComponentMaskBuffer: sourceFurnitureComponentMaskBuffer,
      sourceComponents: sourceFurnitureComponents,
      variantBuffer: candidateBuffer,
    });

    return {
      maskedChangeRatio,
      outsideMaskChangeRatio,
      maskedEdgeDensityDelta,
      ...persistenceMetrics,
    };
  };
  const finalizeSurfaceScopedBuffer = async (candidateBuffer) => {
    if (
      (preset.key !== 'remove_furniture' &&
        !preset.key.startsWith('paint_') &&
        !preset.key.startsWith('floor_')) ||
      !maskBuffer
    ) {
      return candidateBuffer;
    }

    const blendMaskBuffer =
      preset.key === 'remove_furniture' && removeFurnitureEvaluationMaskBuffer
        ? removeFurnitureEvaluationMaskBuffer
        : maskBuffer;

    return blendVariantWithSourceMask({
      sourceBuffer,
      variantBuffer: candidateBuffer,
      maskBuffer: blendMaskBuffer,
      maskBlur: preset.key === 'remove_furniture' ? 2.2 : 1.8,
    });
  };
  const maxRefinementAttempts =
    preset.key === 'remove_furniture' && providerKey === 'replicate_advanced' ? 1 : Infinity;
  let refinementAttempts = 0;

  const candidates = [];
  for (let index = 0; index < providerOutputs.length; index += 1) {
    let output = providerOutputs[index];
    let buffer = await finalizeSurfaceScopedBuffer(await convertReplicateOutputToBuffer(output));
    let visualChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer);
    let focusRegionChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer, {
      region: evaluationRegions.focusRegion,
    });
    let maskedChangeRatio = 0;
    let maskedLuminanceDelta = 0;
    let maskedColorShiftRatio = 0;
    let outsideMaskChangeRatio = 0;
    let maskedEdgeDensityDelta = 0;
    let remainingFurnitureOverlapRatio = 0;
    let largestComponentPersistenceRatio = 0;
    let newFurnitureAdditionRatio = 0;
    let clearedMajorComponentCount = 0;
    let totalMajorComponentCount = 0;
    let furnitureCoverageIncreaseRatio = 0;
    if (preset.key === 'remove_furniture') {
      ({
        maskedChangeRatio,
        outsideMaskChangeRatio,
        maskedEdgeDensityDelta,
        remainingFurnitureOverlapRatio,
        largestComponentPersistenceRatio,
        newFurnitureAdditionRatio,
        clearedMajorComponentCount,
        totalMajorComponentCount,
      } = await computeFurnitureRemovalMetrics(buffer));
    }
    if (preset.key.startsWith('floor_') || preset.key.startsWith('paint_')) {
      maskedChangeRatio = await calculateMaskedVisualChangeRatio(sourceBuffer, buffer, maskBuffer);
      maskedLuminanceDelta = await calculateMaskedLuminanceDelta(sourceBuffer, buffer, maskBuffer);
      maskedColorShiftRatio = await calculateMaskedAverageColorShiftRatio(
        sourceBuffer,
        buffer,
        maskBuffer,
      );
      outsideMaskChangeRatio = await calculateOutsideMaskVisualChangeRatio(
        sourceBuffer,
        buffer,
        maskBuffer,
      );
      furnitureCoverageIncreaseRatio = await computeFurnitureCoverageIncreaseRatio(buffer);
      if (preset.key.startsWith('paint_') && paintEvaluationMaskBuffer && sourcePaintEdgeDensity != null) {
        const variantPaintEdgeDensity = await calculateMaskedEdgeDensity(
          buffer,
          paintEvaluationMaskBuffer,
        );
        maskedEdgeDensityDelta = Number(
          (variantPaintEdgeDensity - sourcePaintEdgeDensity).toFixed(4),
        );
      }
    }

    if (
      preset.key === 'remove_furniture' &&
      providerKey === 'replicate_advanced' &&
      refinementAttempts < maxRefinementAttempts &&
      (
        focusRegionChangeRatio < 0.24 ||
        maskedChangeRatio < 0.16 ||
        maskedEdgeDensityDelta > -0.002
      )
    ) {
      refinementAttempts += 1;
      const refinementReplicateInputs = await buildTemporaryReplicateInputUrls({
        propertyId,
        imageBuffer: buffer,
        maskBuffer,
        presetKey: preset.key,
        providerKey,
      });
      const refinementOutputs = await runReplicateInpainting({
        image: refinementReplicateInputs.imageUrl,
        mask: refinementReplicateInputs.maskUrl,
        model: settings.model,
        prompt: `${providerPrompt} Continue removing any remaining movable furniture and clutter from the masked area. Keep architecture unchanged.`,
        strength: Math.min(0.99, Number((settings.strength || 0.9) + 0.04)),
        outputCount: 1,
        guidanceScale: Math.min(10, Number((settings.guidanceScale || 9) + 0.4)),
        numInferenceSteps: Number(settings.numInferenceSteps || 40) + 6,
        scheduler: settings.scheduler,
        negativePrompt: settings.negativePrompt,
        seed: Math.floor(Math.random() * 1_000_000_000),
      });
      if (refinementOutputs.length) {
        output = refinementOutputs[0];
        buffer = await finalizeSurfaceScopedBuffer(
          await convertReplicateOutputToBuffer(output),
        );
        visualChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer);
        focusRegionChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer, {
          region: evaluationRegions.focusRegion,
        });
        ({
          maskedChangeRatio,
          outsideMaskChangeRatio,
          maskedEdgeDensityDelta,
          remainingFurnitureOverlapRatio,
          largestComponentPersistenceRatio,
          newFurnitureAdditionRatio,
          clearedMajorComponentCount,
          totalMajorComponentCount,
        } = await computeFurnitureRemovalMetrics(buffer));
      }
    }

    const review = await reviewVisionVariant({
      property: null,
      roomLabel: asset.roomLabel,
      presetKey: preset.key,
      variantCategory: preset.category,
      mimeType: 'image/jpeg',
      sourceImageBase64,
      variantImageBase64: buffer.toString('base64'),
    });
    const topHalfChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer, {
      region: evaluationRegions.structureRegion,
    });
    let overallScore = calculateVisionReviewOverallScore(review);
    let shouldHideByDefault = false;
    let rejectionCategory = '';
    let qualityWarning = '';

    if (preset.key === 'remove_furniture') {
      if (visualChangeRatio < 0.15) {
        overallScore = Math.max(0, overallScore - 10);
      }
      if (focusRegionChangeRatio < 0.12) {
        overallScore = Math.max(0, overallScore - 12);
      }
      if (topHalfChangeRatio > 0.1) {
        overallScore = Math.max(0, overallScore - 26);
      }
      if (maskedChangeRatio >= 0.22) {
        overallScore = Math.min(100, overallScore + 10);
      } else if (maskedChangeRatio >= 0.16) {
        overallScore = Math.min(100, overallScore + 4);
      } else {
        overallScore = Math.max(0, overallScore - 18);
      }
      if (maskedEdgeDensityDelta <= -0.01) {
        overallScore = Math.min(100, overallScore + 12);
      } else if (maskedEdgeDensityDelta <= -0.004) {
        overallScore = Math.min(100, overallScore + 6);
      } else {
        overallScore = Math.max(0, overallScore - 18);
      }
      if (outsideMaskChangeRatio > 0.28) {
        overallScore = Math.max(0, overallScore - 10);
      } else if (outsideMaskChangeRatio <= 0.16) {
        overallScore = Math.min(100, overallScore + 4);
      }
      if (remainingFurnitureOverlapRatio >= 0.7) {
        overallScore = Math.max(0, overallScore - 28);
      } else if (remainingFurnitureOverlapRatio >= 0.5) {
        overallScore = Math.max(0, overallScore - 16);
      } else if (remainingFurnitureOverlapRatio <= 0.26) {
        overallScore = Math.min(100, overallScore + 8);
      }
      if (largestComponentPersistenceRatio >= 0.72) {
        overallScore = Math.max(0, overallScore - 24);
      } else if (largestComponentPersistenceRatio <= 0.42 && totalMajorComponentCount > 0) {
        overallScore = Math.min(100, overallScore + 8);
      }
      if (newFurnitureAdditionRatio >= 0.32) {
        overallScore = Math.max(0, overallScore - 30);
      } else if (newFurnitureAdditionRatio >= 0.18) {
        overallScore = Math.max(0, overallScore - 18);
      } else if (newFurnitureAdditionRatio <= 0.06) {
        overallScore = Math.min(100, overallScore + 6);
      }
      if (totalMajorComponentCount > 0 && clearedMajorComponentCount === totalMajorComponentCount) {
        overallScore = Math.min(100, overallScore + 10);
      }

      if (focusRegionChangeRatio < 0.08) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning = 'Low-confidence preview: the generated change in the furniture region was limited.';
        rejectionCategory = 'insufficient_focus_change';
        shouldHideByDefault = true;
      }
      if (topHalfChangeRatio > 0.22) {
        overallScore = Math.max(0, overallScore - 16);
        qualityWarning =
          'Low-confidence preview: upper-architecture drift was detected, so review before public use.';
        rejectionCategory = rejectionCategory || 'architectural_drift';
      }
      if (maskedChangeRatio < 0.11) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: furniture subtraction appears weak in the detected furniture zones.';
        rejectionCategory = 'furniture_persistence';
        shouldHideByDefault = true;
      }
      if (maskedEdgeDensityDelta > -0.001 && maskedChangeRatio < 0.22) {
        overallScore = Math.max(0, overallScore - 20);
        qualityWarning =
          'Low-confidence preview: the room was restyled more than furniture was actually removed.';
        rejectionCategory = 'furniture_persistence';
        shouldHideByDefault = true;
      }
      if (remainingFurnitureOverlapRatio >= 0.6 || largestComponentPersistenceRatio >= 0.72) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: major furniture silhouettes still appear to persist in the room.';
        rejectionCategory = 'furniture_persistence';
        shouldHideByDefault = true;
      }
      if (newFurnitureAdditionRatio >= 0.18) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: the generated room appears to add substitute furniture instead of simply removing it.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      }

      console.log('VISION DEBUG:', {
        presetKey: preset.key,
        providerKey,
        index,
        visualChangeRatio,
        focusRegionChangeRatio,
        topHalfChangeRatio,
        maskedChangeRatio,
        outsideMaskChangeRatio,
        maskedEdgeDensityDelta,
        remainingFurnitureOverlapRatio,
        largestComponentPersistenceRatio,
        newFurnitureAdditionRatio,
        clearedMajorComponentCount,
        totalMajorComponentCount,
        overallScore,
        shouldHideByDefault,
        rejectionCategory,
      });
    }

    if (preset.key.startsWith('floor_')) {
      if (visualChangeRatio < 0.14) {
        overallScore = Math.max(0, overallScore - 20);
      }
      if (maskedChangeRatio < 0.14) {
        overallScore = Math.max(0, overallScore - 24);
        qualityWarning =
          'Low-confidence preview: the flooring region changed too little to read as a meaningful finish update.';
        rejectionCategory = 'insufficient_floor_change';
        shouldHideByDefault = true;
      }
      if (outsideMaskChangeRatio > 0.22) {
        overallScore = Math.max(0, overallScore - 12);
      }
      if (topHalfChangeRatio > 0.09) {
        overallScore = Math.max(0, overallScore - 20);
      }
      if (preset.key === 'floor_dark_hardwood') {
        if (maskedLuminanceDelta > -0.035) {
          overallScore = Math.max(0, overallScore - 30);
          qualityWarning =
            'Low-confidence preview: the floor stayed too close to the original tone instead of becoming meaningfully darker.';
          rejectionCategory = 'insufficient_floor_change';
          shouldHideByDefault = true;
        } else if (maskedLuminanceDelta <= -0.08) {
          overallScore = Math.min(100, overallScore + 10);
        }
      }
      if (preset.key === 'floor_tile_stone') {
        if (maskedColorShiftRatio < 0.08) {
          overallScore = Math.max(0, overallScore - 28);
          qualityWarning =
            'Low-confidence preview: the flooring still reads too close to the original surface instead of a clear tile or stone material shift.';
          rejectionCategory = 'insufficient_floor_change';
          shouldHideByDefault = true;
        } else if (maskedColorShiftRatio >= 0.12) {
          overallScore = Math.min(100, overallScore + 10);
        } else if (maskedColorShiftRatio >= 0.09) {
          overallScore = Math.min(100, overallScore + 4);
        }
        if (maskedLuminanceDelta <= -0.07) {
          overallScore = Math.max(0, overallScore - 20);
          qualityWarning =
            'Low-confidence preview: the flooring reads more like dark wood than a believable tile or stone finish.';
          rejectionCategory = 'insufficient_floor_change';
          shouldHideByDefault = true;
        }
      }
      if (furnitureCoverageIncreaseRatio >= 0.025) {
        overallScore = Math.max(0, overallScore - 36);
        qualityWarning =
          'Low-confidence preview: the flooring update appears to introduce furniture or staging that was not in the source room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      } else if (furnitureCoverageIncreaseRatio >= 0.012) {
        overallScore = Math.max(0, overallScore - 16);
      }
      if (preset.key === 'floor_tile_stone' && furnitureCoverageIncreaseRatio >= 0.015) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: the tile or stone concept appears to introduce object-like artifacts in the room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      }
      if (topHalfChangeRatio > 0.14) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: likely structural drift was detected outside the floor region.';
        rejectionCategory = 'architectural_drift';
        shouldHideByDefault = true;
      }
    }

    if (preset.key.startsWith('paint_')) {
      if (visualChangeRatio < 0.08) {
        overallScore = Math.max(0, overallScore - 14);
      }
      if (topHalfChangeRatio > 0.1) {
        overallScore = Math.max(0, overallScore - 26);
        qualityWarning =
          'Low-confidence preview: the repaint concept appears to change ceiling or upper architectural details instead of only repainting walls.';
        rejectionCategory = 'architectural_drift';
        shouldHideByDefault = true;
      } else if (topHalfChangeRatio > 0.07) {
        overallScore = Math.max(0, overallScore - 10);
      }
      if (maskedChangeRatio < 0.1) {
        overallScore = Math.max(0, overallScore - 24);
        qualityWarning =
          'Low-confidence preview: the wall region changed too little to read as a meaningful repaint concept.';
        rejectionCategory = 'insufficient_paint_change';
        shouldHideByDefault = true;
      }
      if (maskedColorShiftRatio < 0.05) {
        overallScore = Math.max(0, overallScore - 24);
        qualityWarning =
          'Low-confidence preview: the wall color stayed too close to the original room palette.';
        rejectionCategory = 'insufficient_paint_change';
        shouldHideByDefault = true;
      } else if (maskedColorShiftRatio >= 0.09) {
        overallScore = Math.min(100, overallScore + 12);
      } else if (maskedColorShiftRatio >= 0.07) {
        overallScore = Math.min(100, overallScore + 6);
      }
      if (maskedEdgeDensityDelta > 0.003) {
        overallScore = Math.max(0, overallScore - 34);
        qualityWarning =
          'Low-confidence preview: the wall update appears to add new visual features or decor instead of only changing paint.';
        rejectionCategory = 'wall_feature_addition';
        shouldHideByDefault = true;
      } else if (maskedEdgeDensityDelta > 0.001) {
        overallScore = Math.max(0, overallScore - 14);
      }
      if (outsideMaskChangeRatio > 0.24) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: too much of the room changed outside the intended wall-paint region.';
        rejectionCategory = 'architectural_drift';
        shouldHideByDefault = true;
      } else if (outsideMaskChangeRatio > 0.16) {
        overallScore = Math.max(0, overallScore - 8);
      }
      if (furnitureCoverageIncreaseRatio >= 0.025) {
        overallScore = Math.max(0, overallScore - 36);
        qualityWarning =
          'Low-confidence preview: the wall update appears to introduce furniture or staging that was not in the source room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      } else if (furnitureCoverageIncreaseRatio >= 0.012) {
        overallScore = Math.max(0, overallScore - 16);
      }
      if (newFurnitureAdditionRatio >= 0.1) {
        overallScore = Math.max(0, overallScore - 42);
        qualityWarning =
          'Low-confidence preview: the wall update appears to invent a new furniture-like object instead of only changing paint.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      } else if (newFurnitureAdditionRatio >= 0.04) {
        overallScore = Math.max(0, overallScore - 20);
      }
      if (preset.key === 'paint_bright_white') {
        if (maskedChangeRatio < 0.12) {
          overallScore = Math.max(0, overallScore - 18);
          qualityWarning =
            'Low-confidence preview: the walls changed too little to read as a clearly lighter repaint.';
          rejectionCategory = 'insufficient_paint_change';
          shouldHideByDefault = true;
        }
        if (maskedColorShiftRatio < 0.06) {
          overallScore = Math.max(0, overallScore - 18);
          qualityWarning =
            'Low-confidence preview: the wall color shift stayed too subtle to read as a fresh bright-white repaint.';
          rejectionCategory = 'insufficient_paint_change';
          shouldHideByDefault = true;
        }
        if (outsideMaskChangeRatio > 0.2) {
          overallScore = Math.max(0, overallScore - 16);
        }
        if (topHalfChangeRatio > 0.08) {
          overallScore = Math.max(0, overallScore - 18);
          qualityWarning =
            'Low-confidence preview: the bright-white concept is changing upper-room details too much.';
          rejectionCategory = 'architectural_drift';
          shouldHideByDefault = true;
        }
        if (furnitureCoverageIncreaseRatio >= 0.015 || newFurnitureAdditionRatio >= 0.02) {
          overallScore = Math.max(0, overallScore - 26);
          qualityWarning =
            'Low-confidence preview: the bright-white repaint appears to introduce object-like additions instead of only changing wall color.';
          rejectionCategory = 'furniture_restaging';
          shouldHideByDefault = true;
        }
        if (maskedLuminanceDelta < 0.034) {
          overallScore = Math.max(0, overallScore - 28);
          qualityWarning =
            'Low-confidence preview: the walls did not brighten enough to read as a crisp white repaint.';
          rejectionCategory = 'insufficient_paint_change';
          shouldHideByDefault = true;
        } else if (maskedLuminanceDelta >= 0.075) {
          overallScore = Math.min(100, overallScore + 12);
        } else if (maskedLuminanceDelta >= 0.05) {
          overallScore = Math.min(100, overallScore + 7);
        }
      }
    }

    const objectRemovalScore =
      preset.key === 'remove_furniture'
        ? calculateObjectRemovalScore({
            visualChangeRatio,
            focusRegionChangeRatio,
            topHalfChangeRatio,
            maskedChangeRatio,
            maskedEdgeDensityDelta,
            outsideMaskChangeRatio,
            remainingFurnitureOverlapRatio,
            largestComponentPersistenceRatio,
            newFurnitureAdditionRatio,
            clearedMajorComponentCount,
            totalMajorComponentCount,
          })
        : 0;

    candidates.push({
      providerKey,
      output,
      buffer,
      warning: qualityWarning,
      label: `${renderPlan.label} ${String.fromCharCode(65 + index)}`,
      summary: renderPlan.summary,
      differenceHint: renderPlan.differenceHint,
      effects: [
        ...(renderPlan.effects || []),
        providerKey === 'replicate_advanced' ? 'Advanced AI fallback' : 'Primary AI provider',
      ],
      roomPromptAddon,
      presetPromptAddon,
      mode: requestedMode,
      instructions: normalizedInstructions,
      normalizedPlan,
      providerSourceUrl: getProviderSourceUrl(output),
      maskStrategy: resolvedMask.debug?.strategy || null,
      maskCoverageRatio:
        resolvedMask.debug?.coverageRatio ?? resolvedMask.debug?.maskCoverageRatio ?? null,
      rawMaskCoverageRatio: resolvedMask.debug?.rawCoverageRatio ?? null,
      refinementStages: resolvedMask.debug?.refinementStages || [],
      windowRejectionCoverageRatio: resolvedMask.debug?.windowRejectionCoverageRatio ?? null,
      windowBrightPixelRatio: resolvedMask.debug?.windowBrightPixelRatio ?? null,
      windowStructuredPixelRatio: resolvedMask.debug?.windowStructuredPixelRatio ?? null,
      review,
      overallScore,
      visualChangeRatio,
      focusRegionChangeRatio,
      topHalfChangeRatio,
      maskedChangeRatio,
      maskedLuminanceDelta,
      maskedColorShiftRatio,
      outsideMaskChangeRatio,
      maskedEdgeDensityDelta,
      remainingFurnitureOverlapRatio,
      largestComponentPersistenceRatio,
      newFurnitureAdditionRatio,
      clearedMajorComponentCount,
      totalMajorComponentCount,
      furnitureCoverageIncreaseRatio,
      objectRemovalScore,
      shouldHideByDefault,
      rejectionCategory,
    });
  }

  return candidates;
}

async function buildReviewedOpenAiCandidates({
  asset,
  preset,
  renderPlan,
  resolvedRoomType,
  requestedMode,
  normalizedInstructions,
  normalizedPlan,
  fullPrompt,
  roomPromptAddon,
  presetPromptAddon,
  sourceBuffer,
  sourceImageBase64,
}) {
  const resolvedMask =
    isWallPreset(preset.key) || isFloorPreset(preset.key)
      ? await resolveSurfaceMaskAtSourceSize(sourceBuffer, preset.key, resolvedRoomType).catch(
          async (error) => {
            console.warn('Surface mask fallback triggered', {
              presetKey: preset.key,
              roomType: resolvedRoomType,
              message: error?.message || String(error),
            });
            return {
              maskBuffer: await buildInpaintingMaskBuffer(sourceBuffer, preset.key, resolvedRoomType),
              debug: { strategy: 'geometric_fallback', maskCoverageRatio: null },
            };
          },
        )
      : {
          maskBuffer: await buildTaskSpecificMaskBuffer(sourceBuffer, preset.key, resolvedRoomType),
          debug: { strategy: 'geometric_fallback', maskCoverageRatio: null },
        };
  const maskBuffer = resolvedMask.maskBuffer;
  let removeFurnitureEvaluationMaskBuffer = null;
  let sourceFurnitureEdgeDensity = null;
  let paintEvaluationMaskBuffer = null;
  let sourcePaintEdgeDensity = null;
  let sourceFurnitureComponentMaskBuffer = null;
  let sourceFurnitureComponents = [];
  let sourceFurnitureCoverageRatio = 0;
  if (preset.key === 'remove_furniture' || preset.key.startsWith('floor_')) {
    const adaptiveFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(sourceBuffer);
    const adaptiveCoverageRatio = await calculateMaskCoverageRatio(
      adaptiveFurnitureMask.adaptiveMaskBuffer,
    );
    sourceFurnitureCoverageRatio = adaptiveCoverageRatio;
    if (!preset.key.startsWith('floor_')) {
      removeFurnitureEvaluationMaskBuffer =
        adaptiveCoverageRatio >= 0.03 ? adaptiveFurnitureMask.adaptiveMaskBuffer : maskBuffer;
      sourceFurnitureEdgeDensity = await calculateMaskedEdgeDensity(
        sourceBuffer,
        removeFurnitureEvaluationMaskBuffer,
      );
      const componentMask = await buildAdaptiveFurnitureMaskAtSourceSize(sourceBuffer, {
        bridgeNearbyComponents: false,
      });
      sourceFurnitureComponentMaskBuffer = componentMask.adaptiveMaskBuffer;
      const sourceComponentBinary = await readBinaryMask(sourceFurnitureComponentMaskBuffer, 40);
      sourceFurnitureComponents = extractBinaryMaskComponents(
        sourceComponentBinary.binary,
        sourceComponentBinary.width,
        sourceComponentBinary.height,
        Math.max(400, Math.round(sourceComponentBinary.width * sourceComponentBinary.height * 0.004)),
      );
    }
  }
  if (preset.key.startsWith('paint_')) {
    paintEvaluationMaskBuffer = maskBuffer;
    sourcePaintEdgeDensity = await calculateMaskedEdgeDensity(sourceBuffer, paintEvaluationMaskBuffer);
  }
  const computeFurnitureCoverageIncreaseRatio = async (candidateBuffer) => {
    if (!preset.key.startsWith('floor_')) {
      return 0;
    }

    const variantAdaptiveFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(candidateBuffer, {
      bridgeNearbyComponents: false,
    });
    const variantFurnitureCoverageRatio = await calculateMaskCoverageRatio(
      variantAdaptiveFurnitureMask.adaptiveMaskBuffer,
    );
    return Number(
      Math.max(0, variantFurnitureCoverageRatio - sourceFurnitureCoverageRatio).toFixed(4),
    );
  };

  const providerPrompt = `${fullPrompt} Produce the strongest usable edit while preserving the true room structure. Prefer subtraction over restaging.`;
  const providerOutputs = await runOpenAIImageEdit({
    sourceBuffer,
    maskBuffer,
    prompt: providerPrompt,
    outputCount: preset.key === 'remove_furniture' ? 1 : Math.min(2, Number(preset.outputCount || 1)),
  });
  const evaluationRegions = getPresetEvaluationRegions(preset.key);
  const computeFurnitureRemovalMetrics = async (candidateBuffer) => {
    if (!removeFurnitureEvaluationMaskBuffer || sourceFurnitureEdgeDensity == null) {
      return {
        maskedChangeRatio: 0,
        outsideMaskChangeRatio: 0,
        maskedEdgeDensityDelta: 0,
        remainingFurnitureOverlapRatio: 0,
        largestComponentPersistenceRatio: 0,
        newFurnitureAdditionRatio: 0,
        clearedMajorComponentCount: 0,
        totalMajorComponentCount: 0,
      };
    }
    const maskedChangeRatio = await calculateMaskedVisualChangeRatio(
      sourceBuffer,
      candidateBuffer,
      removeFurnitureEvaluationMaskBuffer,
    );
    const outsideMaskChangeRatio = await calculateOutsideMaskVisualChangeRatio(
      sourceBuffer,
      candidateBuffer,
      removeFurnitureEvaluationMaskBuffer,
    );
    const variantFurnitureEdgeDensity = await calculateMaskedEdgeDensity(
      candidateBuffer,
      removeFurnitureEvaluationMaskBuffer,
    );
    const maskedEdgeDensityDelta = Number(
      (variantFurnitureEdgeDensity - sourceFurnitureEdgeDensity).toFixed(4),
    );
    const persistenceMetrics = await calculateFurniturePersistenceMetrics({
      sourceComponentMaskBuffer: sourceFurnitureComponentMaskBuffer,
      sourceComponents: sourceFurnitureComponents,
      variantBuffer: candidateBuffer,
    });

    return {
      maskedChangeRatio,
      outsideMaskChangeRatio,
      maskedEdgeDensityDelta,
      ...persistenceMetrics,
    };
  };
  const finalizeSurfaceScopedBuffer = async (candidateBuffer) => {
    if (
      (preset.key !== 'remove_furniture' &&
        !preset.key.startsWith('paint_') &&
        !preset.key.startsWith('floor_')) ||
      !maskBuffer
    ) {
      return candidateBuffer;
    }

    const blendMaskBuffer =
      preset.key === 'remove_furniture' && removeFurnitureEvaluationMaskBuffer
        ? removeFurnitureEvaluationMaskBuffer
        : maskBuffer;

    return blendVariantWithSourceMask({
      sourceBuffer,
      variantBuffer: candidateBuffer,
      maskBuffer: blendMaskBuffer,
      maskBlur: preset.key === 'remove_furniture' ? 2.2 : 1.8,
    });
  };

  const candidates = [];
  for (let index = 0; index < providerOutputs.length; index += 1) {
    const output = providerOutputs[index];
    const buffer = await finalizeSurfaceScopedBuffer(
      await sharp(output.outputBuffer).rotate().jpeg({ quality: 92 }).toBuffer(),
    );
    const visualChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer);
    const focusRegionChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer, {
      region: evaluationRegions.focusRegion,
    });
    let maskedChangeRatio = 0;
    let maskedLuminanceDelta = 0;
    let maskedColorShiftRatio = 0;
    let outsideMaskChangeRatio = 0;
    let maskedEdgeDensityDelta = 0;
    let remainingFurnitureOverlapRatio = 0;
    let largestComponentPersistenceRatio = 0;
    let newFurnitureAdditionRatio = 0;
    let clearedMajorComponentCount = 0;
    let totalMajorComponentCount = 0;
    let furnitureCoverageIncreaseRatio = 0;
    if (preset.key === 'remove_furniture') {
      ({
        maskedChangeRatio,
        outsideMaskChangeRatio,
        maskedEdgeDensityDelta,
        remainingFurnitureOverlapRatio,
        largestComponentPersistenceRatio,
        newFurnitureAdditionRatio,
        clearedMajorComponentCount,
        totalMajorComponentCount,
      } = await computeFurnitureRemovalMetrics(buffer));
    }
    if (preset.key.startsWith('floor_') || preset.key.startsWith('paint_')) {
      maskedChangeRatio = await calculateMaskedVisualChangeRatio(sourceBuffer, buffer, maskBuffer);
      maskedLuminanceDelta = await calculateMaskedLuminanceDelta(sourceBuffer, buffer, maskBuffer);
      maskedColorShiftRatio = await calculateMaskedAverageColorShiftRatio(
        sourceBuffer,
        buffer,
        maskBuffer,
      );
      outsideMaskChangeRatio = await calculateOutsideMaskVisualChangeRatio(
        sourceBuffer,
        buffer,
        maskBuffer,
      );
      furnitureCoverageIncreaseRatio = await computeFurnitureCoverageIncreaseRatio(buffer);
      if (preset.key.startsWith('paint_') && paintEvaluationMaskBuffer && sourcePaintEdgeDensity != null) {
        const variantPaintEdgeDensity = await calculateMaskedEdgeDensity(
          buffer,
          paintEvaluationMaskBuffer,
        );
        maskedEdgeDensityDelta = Number(
          (variantPaintEdgeDensity - sourcePaintEdgeDensity).toFixed(4),
        );
      }
    }

    const review = await reviewVisionVariant({
      property: null,
      roomLabel: asset.roomLabel,
      presetKey: preset.key,
      variantCategory: preset.category,
      mimeType: 'image/jpeg',
      sourceImageBase64,
      variantImageBase64: buffer.toString('base64'),
    });
    const topHalfChangeRatio = await calculateVisualChangeRatio(sourceBuffer, buffer, {
      region: evaluationRegions.structureRegion,
    });
    let overallScore = calculateVisionReviewOverallScore(review);
    let shouldHideByDefault = false;
    let rejectionCategory = '';
    let qualityWarning = '';

    if (preset.key === 'remove_furniture') {
      if (visualChangeRatio < 0.15) {
        overallScore = Math.max(0, overallScore - 10);
      }
      if (focusRegionChangeRatio < 0.12) {
        overallScore = Math.max(0, overallScore - 12);
      }
      if (topHalfChangeRatio > 0.12) {
        overallScore = Math.max(0, overallScore - 22);
      }
      if (maskedChangeRatio >= 0.24) {
        overallScore = Math.min(100, overallScore + 14);
      } else if (maskedChangeRatio >= 0.18) {
        overallScore = Math.min(100, overallScore + 8);
      } else {
        overallScore = Math.max(0, overallScore - 16);
      }
      if (maskedEdgeDensityDelta <= -0.01) {
        overallScore = Math.min(100, overallScore + 14);
      } else if (maskedEdgeDensityDelta <= -0.004) {
        overallScore = Math.min(100, overallScore + 8);
      } else {
        overallScore = Math.max(0, overallScore - 16);
      }
      if (outsideMaskChangeRatio > 0.3) {
        overallScore = Math.max(0, overallScore - 10);
      } else if (outsideMaskChangeRatio <= 0.18) {
        overallScore = Math.min(100, overallScore + 4);
      }
      if (remainingFurnitureOverlapRatio >= 0.7) {
        overallScore = Math.max(0, overallScore - 28);
      } else if (remainingFurnitureOverlapRatio >= 0.5) {
        overallScore = Math.max(0, overallScore - 16);
      } else if (remainingFurnitureOverlapRatio <= 0.26) {
        overallScore = Math.min(100, overallScore + 10);
      }
      if (largestComponentPersistenceRatio >= 0.72) {
        overallScore = Math.max(0, overallScore - 24);
      } else if (largestComponentPersistenceRatio <= 0.42 && totalMajorComponentCount > 0) {
        overallScore = Math.min(100, overallScore + 10);
      }
      if (newFurnitureAdditionRatio >= 0.32) {
        overallScore = Math.max(0, overallScore - 32);
      } else if (newFurnitureAdditionRatio >= 0.18) {
        overallScore = Math.max(0, overallScore - 20);
      } else if (newFurnitureAdditionRatio <= 0.06) {
        overallScore = Math.min(100, overallScore + 8);
      }
      if (totalMajorComponentCount > 0 && clearedMajorComponentCount === totalMajorComponentCount) {
        overallScore = Math.min(100, overallScore + 12);
      }

      if (focusRegionChangeRatio < 0.08) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: the premium fallback changed too little in the furniture region.';
        rejectionCategory = 'insufficient_focus_change';
        shouldHideByDefault = true;
      }
      if (topHalfChangeRatio > 0.24) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: upper-architecture drift was detected in the premium fallback.';
        rejectionCategory = rejectionCategory || 'architectural_drift';
      }
      if (maskedChangeRatio < 0.11) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: premium fallback still left too much furniture in place.';
        rejectionCategory = 'furniture_persistence';
        shouldHideByDefault = true;
      }
      if (maskedEdgeDensityDelta > -0.001 && maskedChangeRatio < 0.22) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: premium fallback restaged the room more than it removed furniture.';
        rejectionCategory = 'furniture_persistence';
        shouldHideByDefault = true;
      }
      if (remainingFurnitureOverlapRatio >= 0.6 || largestComponentPersistenceRatio >= 0.72) {
        overallScore = Math.max(0, overallScore - 24);
        qualityWarning =
          'Low-confidence preview: premium fallback still leaves major furniture silhouettes in place.';
        rejectionCategory = 'furniture_persistence';
        shouldHideByDefault = true;
      }
      if (newFurnitureAdditionRatio >= 0.18) {
        overallScore = Math.max(0, overallScore - 24);
        qualityWarning =
          'Low-confidence preview: premium fallback appears to add replacement furniture instead of clearing the room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      }
    }

    if (preset.key.startsWith('floor_')) {
      if (visualChangeRatio < 0.14) {
        overallScore = Math.max(0, overallScore - 18);
      }
      if (maskedChangeRatio < 0.14) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: the premium fallback changed too little in the flooring region.';
        rejectionCategory = 'insufficient_floor_change';
        shouldHideByDefault = true;
      }
      if (outsideMaskChangeRatio > 0.22) {
        overallScore = Math.max(0, overallScore - 12);
      }
      if (topHalfChangeRatio > 0.12) {
        overallScore = Math.max(0, overallScore - 18);
      }
      if (preset.key === 'floor_dark_hardwood') {
        if (maskedLuminanceDelta > -0.035) {
          overallScore = Math.max(0, overallScore - 28);
          qualityWarning =
            'Low-confidence preview: the premium fallback kept the floor too close to the original tone instead of delivering a clearly darker hardwood concept.';
          rejectionCategory = 'insufficient_floor_change';
          shouldHideByDefault = true;
        } else if (maskedLuminanceDelta <= -0.08) {
          overallScore = Math.min(100, overallScore + 10);
        }
      }
      if (preset.key === 'floor_tile_stone') {
        if (maskedColorShiftRatio < 0.08) {
          overallScore = Math.max(0, overallScore - 28);
          qualityWarning =
            'Low-confidence preview: the premium fallback kept the flooring too close to the original material instead of a clear tile or stone shift.';
          rejectionCategory = 'insufficient_floor_change';
          shouldHideByDefault = true;
        } else if (maskedColorShiftRatio >= 0.12) {
          overallScore = Math.min(100, overallScore + 10);
        } else if (maskedColorShiftRatio >= 0.09) {
          overallScore = Math.min(100, overallScore + 4);
        }
        if (maskedLuminanceDelta <= -0.07) {
          overallScore = Math.max(0, overallScore - 20);
          qualityWarning =
            'Low-confidence preview: the premium fallback reads more like dark wood than a believable tile or stone finish.';
          rejectionCategory = 'insufficient_floor_change';
          shouldHideByDefault = true;
        }
      }
      if (furnitureCoverageIncreaseRatio >= 0.025) {
        overallScore = Math.max(0, overallScore - 36);
        qualityWarning =
          'Low-confidence preview: the premium fallback appears to introduce furniture or staging that was not in the source room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      } else if (furnitureCoverageIncreaseRatio >= 0.012) {
        overallScore = Math.max(0, overallScore - 16);
      }
      if (preset.key === 'floor_tile_stone' && furnitureCoverageIncreaseRatio >= 0.015) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: the premium tile or stone concept appears to introduce object-like artifacts in the room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      }
      if (topHalfChangeRatio > 0.16) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: premium fallback introduced drift outside the floor region.';
        rejectionCategory = 'architectural_drift';
        shouldHideByDefault = true;
      }
    }

    if (preset.key.startsWith('paint_')) {
      if (visualChangeRatio < 0.08) {
        overallScore = Math.max(0, overallScore - 12);
      }
      if (topHalfChangeRatio > 0.1) {
        overallScore = Math.max(0, overallScore - 26);
        qualityWarning =
          'Low-confidence preview: the premium fallback appears to change ceiling or upper architectural details instead of only repainting walls.';
        rejectionCategory = 'architectural_drift';
        shouldHideByDefault = true;
      } else if (topHalfChangeRatio > 0.07) {
        overallScore = Math.max(0, overallScore - 10);
      }
      if (maskedChangeRatio < 0.1) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: the premium fallback changed too little in the wall-paint region.';
        rejectionCategory = 'insufficient_paint_change';
        shouldHideByDefault = true;
      }
      if (maskedColorShiftRatio < 0.05) {
        overallScore = Math.max(0, overallScore - 22);
        qualityWarning =
          'Low-confidence preview: the premium fallback kept the wall color too close to the original palette.';
        rejectionCategory = 'insufficient_paint_change';
        shouldHideByDefault = true;
      } else if (maskedColorShiftRatio >= 0.09) {
        overallScore = Math.min(100, overallScore + 12);
      } else if (maskedColorShiftRatio >= 0.07) {
        overallScore = Math.min(100, overallScore + 6);
      }
      if (maskedEdgeDensityDelta > 0.003) {
        overallScore = Math.max(0, overallScore - 34);
        qualityWarning =
          'Low-confidence preview: the premium fallback appears to add new wall features or decor instead of only changing paint.';
        rejectionCategory = 'wall_feature_addition';
        shouldHideByDefault = true;
      } else if (maskedEdgeDensityDelta > 0.001) {
        overallScore = Math.max(0, overallScore - 14);
      }
      if (outsideMaskChangeRatio > 0.24) {
        overallScore = Math.max(0, overallScore - 18);
        qualityWarning =
          'Low-confidence preview: the premium fallback changed too much outside the intended wall-paint region.';
        rejectionCategory = 'architectural_drift';
        shouldHideByDefault = true;
      } else if (outsideMaskChangeRatio > 0.16) {
        overallScore = Math.max(0, overallScore - 8);
      }
      if (furnitureCoverageIncreaseRatio >= 0.025) {
        overallScore = Math.max(0, overallScore - 36);
        qualityWarning =
          'Low-confidence preview: the premium fallback appears to introduce furniture or staging that was not in the source room.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      } else if (furnitureCoverageIncreaseRatio >= 0.012) {
        overallScore = Math.max(0, overallScore - 16);
      }
      if (newFurnitureAdditionRatio >= 0.1) {
        overallScore = Math.max(0, overallScore - 42);
        qualityWarning =
          'Low-confidence preview: the premium fallback appears to invent a new furniture-like object instead of only changing paint.';
        rejectionCategory = 'furniture_restaging';
        shouldHideByDefault = true;
      } else if (newFurnitureAdditionRatio >= 0.04) {
        overallScore = Math.max(0, overallScore - 20);
      }
      if (preset.key === 'paint_bright_white') {
        if (maskedChangeRatio < 0.12) {
          overallScore = Math.max(0, overallScore - 18);
          qualityWarning =
            'Low-confidence preview: the premium fallback changed the walls too little to read as a clearly lighter repaint.';
          rejectionCategory = 'insufficient_paint_change';
          shouldHideByDefault = true;
        }
        if (maskedColorShiftRatio < 0.06) {
          overallScore = Math.max(0, overallScore - 18);
          qualityWarning =
            'Low-confidence preview: the premium fallback kept the wall color shift too subtle for a bright-white repaint.';
          rejectionCategory = 'insufficient_paint_change';
          shouldHideByDefault = true;
        }
        if (outsideMaskChangeRatio > 0.2) {
          overallScore = Math.max(0, overallScore - 16);
        }
        if (topHalfChangeRatio > 0.08) {
          overallScore = Math.max(0, overallScore - 18);
          qualityWarning =
            'Low-confidence preview: the premium bright-white concept is changing upper-room details too much.';
          rejectionCategory = 'architectural_drift';
          shouldHideByDefault = true;
        }
        if (furnitureCoverageIncreaseRatio >= 0.015 || newFurnitureAdditionRatio >= 0.02) {
          overallScore = Math.max(0, overallScore - 26);
          qualityWarning =
            'Low-confidence preview: the premium bright-white repaint appears to introduce object-like additions instead of only changing wall color.';
          rejectionCategory = 'furniture_restaging';
          shouldHideByDefault = true;
        }
        if (maskedLuminanceDelta < 0.034) {
          overallScore = Math.max(0, overallScore - 24);
          qualityWarning =
            'Low-confidence preview: the premium fallback did not brighten the walls enough to read as a crisp white repaint.';
          rejectionCategory = 'insufficient_paint_change';
          shouldHideByDefault = true;
        } else if (maskedLuminanceDelta >= 0.075) {
          overallScore = Math.min(100, overallScore + 12);
        } else if (maskedLuminanceDelta >= 0.05) {
          overallScore = Math.min(100, overallScore + 7);
        }
      }
    }

    const objectRemovalScore =
      preset.key === 'remove_furniture'
        ? calculateObjectRemovalScore({
            visualChangeRatio,
            focusRegionChangeRatio,
            topHalfChangeRatio,
            maskedChangeRatio,
            maskedEdgeDensityDelta,
            outsideMaskChangeRatio,
            remainingFurnitureOverlapRatio,
            largestComponentPersistenceRatio,
            newFurnitureAdditionRatio,
            clearedMajorComponentCount,
            totalMajorComponentCount,
          })
        : 0;

    candidates.push({
      providerKey: 'openai_edit',
      output,
      buffer,
      warning: qualityWarning,
      label: `${renderPlan.label} ${String.fromCharCode(65 + index)}`,
      summary: renderPlan.summary,
      differenceHint: renderPlan.differenceHint,
      effects: [...(renderPlan.effects || []), 'Premium AI fallback'],
      roomPromptAddon,
      presetPromptAddon,
      mode: requestedMode,
      instructions: normalizedInstructions,
      normalizedPlan,
      providerSourceUrl: output.providerSourceUrl || null,
      maskStrategy: resolvedMask.debug?.strategy || null,
      maskCoverageRatio:
        resolvedMask.debug?.coverageRatio ?? resolvedMask.debug?.maskCoverageRatio ?? null,
      rawMaskCoverageRatio: resolvedMask.debug?.rawCoverageRatio ?? null,
      refinementStages: resolvedMask.debug?.refinementStages || [],
      windowRejectionCoverageRatio: resolvedMask.debug?.windowRejectionCoverageRatio ?? null,
      windowBrightPixelRatio: resolvedMask.debug?.windowBrightPixelRatio ?? null,
      windowStructuredPixelRatio: resolvedMask.debug?.windowStructuredPixelRatio ?? null,
      review,
      overallScore,
      visualChangeRatio,
      focusRegionChangeRatio,
      topHalfChangeRatio,
      maskedChangeRatio,
      maskedLuminanceDelta,
      maskedColorShiftRatio,
      outsideMaskChangeRatio,
      maskedEdgeDensityDelta,
      remainingFurnitureOverlapRatio,
      largestComponentPersistenceRatio,
      newFurnitureAdditionRatio,
      clearedMajorComponentCount,
      totalMajorComponentCount,
      furnitureCoverageIncreaseRatio,
      objectRemovalScore,
      shouldHideByDefault,
      rejectionCategory,
    });
  }

  return candidates;
}

async function persistOrchestratedVisionCandidates({
  candidates,
  job,
  asset,
  sourceRecord,
  preset,
  renderPlan,
  resolvedRoomType,
  requestedMode,
  normalizedInstructions,
  normalizedPlan,
  workflowStageKey,
  orchestrationResult,
  roomPromptAddon,
  presetPromptAddon,
}) {
  const persistedVariants = [];
  const topCandidates = candidates.slice(0, 4);

  for (let index = 0; index < topCandidates.length; index += 1) {
    const candidate = topCandidates[index];
    const saved = await saveBinaryBuffer({
      propertyId: asset.propertyId.toString(),
      mimeType: 'image/jpeg',
      buffer: candidate.buffer,
    });

    const variant = await MediaVariantModel.create({
      visionJobId: job._id,
      mediaId: asset._id,
      propertyId: asset.propertyId,
      variantType: preset.key,
      variantCategory: preset.category,
      label: candidate.label || `${renderPlan.label} ${String.fromCharCode(65 + index)}`,
      mimeType: 'image/jpeg',
      storageProvider: saved.storageProvider,
      storageKey: saved.storageKey,
      byteSize: saved.byteSize,
      isSelected: false,
      ...buildVariantLifecycleFields({ isSelected: false }),
      useInBrochure: false,
      useInReport: false,
      metadata: {
        warning: candidate.warning || renderPlan.warning,
        summary: candidate.summary || renderPlan.summary,
        differenceHint: candidate.differenceHint || renderPlan.differenceHint,
        effects: candidate.effects || renderPlan.effects,
        cropInsetPercent: candidate.cropInsetPercent || null,
        sourceAssetId: asset._id.toString(),
        sourceVariantId: sourceRecord?.kind === 'variant' ? sourceRecord.id : '',
        sourceOrigin: sourceRecord?.kind || 'asset',
        sourceLabel: sourceRecord?.label || asset.roomLabel,
        workflowStageKey: workflowStageKey || '',
        roomLabel: asset.roomLabel,
        roomType: resolvedRoomType,
        provider: candidate.providerKey || preset.providerPreference || 'local_sharp',
        presetKey: preset.key,
        promptVersion: preset.promptVersion,
        helperText: preset.helperText,
        recommendedUse: preset.recommendedUse,
        upgradeTier: preset.upgradeTier,
        category: preset.category,
        disclaimerType: preset.disclaimerType,
        roomPromptAddon: candidate.roomPromptAddon || roomPromptAddon,
        presetPromptAddon: candidate.presetPromptAddon || presetPromptAddon,
        mode: requestedMode,
        instructions: normalizedInstructions,
        normalizedPlan,
        providerSourceUrl: candidate.providerSourceUrl || null,
        debug: {
          maskStrategy: candidate.maskStrategy || null,
          maskCoverageRatio: candidate.maskCoverageRatio ?? null,
          rawMaskCoverageRatio: candidate.rawMaskCoverageRatio ?? null,
          refinementStages: candidate.refinementStages || [],
          windowRejectionCoverageRatio: candidate.windowRejectionCoverageRatio ?? null,
          windowBrightPixelRatio: candidate.windowBrightPixelRatio ?? null,
          windowStructuredPixelRatio: candidate.windowStructuredPixelRatio ?? null,
        },
        fallbackApplied: Boolean(orchestrationResult?.fallbackApplied),
        orchestrationAttempts: orchestrationResult?.orchestration?.attempts || [],
        orchestrationElapsedMs: Number(orchestrationResult?.elapsedTimeMs || 0),
        orchestrationTimeBudgetMs: Number(orchestrationResult?.maxExecutionTimeMs || 0),
        orchestrationStoppedEarlyReason: orchestrationResult?.stoppedEarlyReason || '',
        orchestrationTimeBudgetReached: Boolean(orchestrationResult?.timeBudgetReached),
        review: {
          ...(candidate.review || {}),
          overallScore: candidate.overallScore,
          visualChangeRatio: candidate.visualChangeRatio,
          focusRegionChangeRatio: candidate.focusRegionChangeRatio,
          topHalfChangeRatio: candidate.topHalfChangeRatio,
          maskedChangeRatio: candidate.maskedChangeRatio,
          maskedLuminanceDelta: candidate.maskedLuminanceDelta,
          outsideMaskChangeRatio: candidate.outsideMaskChangeRatio,
          maskedEdgeDensityDelta: candidate.maskedEdgeDensityDelta,
          remainingFurnitureOverlapRatio: candidate.remainingFurnitureOverlapRatio,
          largestComponentPersistenceRatio: candidate.largestComponentPersistenceRatio,
          newFurnitureAdditionRatio: candidate.newFurnitureAdditionRatio,
          clearedMajorComponentCount: candidate.clearedMajorComponentCount,
          totalMajorComponentCount: candidate.totalMajorComponentCount,
          furnitureCoverageIncreaseRatio: candidate.furnitureCoverageIncreaseRatio,
          objectRemovalScore: candidate.objectRemovalScore,
          shouldHideByDefault: Boolean(candidate.shouldHideByDefault),
          rejectionCategory: candidate.rejectionCategory || '',
          providerKey: candidate.providerKey || '',
        },
      },
    });

    persistedVariants.push(serializeMediaVariant(variant.toObject()));
  }

  return persistedVariants;
}

export async function createImageEnhancementJob({
  assetId,
  jobType = 'enhance_listing_quality',
  presetKey,
  roomType,
  mode = 'preset',
  instructions = '',
  forceRegenerate = false,
  userPlan = '',
  sourceVariantId = '',
  workflowStageKey = '',
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate image variants.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  const normalizedSourceVariantId = String(sourceVariantId || '').trim();
  const normalizedWorkflowStageKey = String(workflowStageKey || '').trim();
  const sourceVariant = normalizedSourceVariantId
    ? await MediaVariantModel.findOne({ _id: normalizedSourceVariantId, mediaId: asset._id }).lean()
    : null;
  if (normalizedSourceVariantId && !sourceVariant) {
    throw new Error('Selected source variant was not found for this photo.');
  }

  const sourceRecord = sourceVariant
    ? {
        id: sourceVariant._id.toString(),
        kind: 'variant',
        label: sourceVariant.label || asset.roomLabel,
        imageUrl: sourceVariant.imageUrl || '',
        storageProvider: sourceVariant.storageProvider,
        storageKey: sourceVariant.storageKey,
        mimeType: sourceVariant.mimeType || asset.mimeType,
      }
    : {
        id: asset._id.toString(),
        kind: 'asset',
        label: asset.roomLabel,
        imageUrl: asset.imageUrl || '',
        storageProvider: asset.storageProvider,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
      };

  const requestedMode =
    mode === 'freeform' || String(instructions || '').trim() ? 'freeform' : 'preset';
  const normalizedInstructions = String(instructions || '').trim().slice(0, 600);
  const resolvedRoomType = normalizeRoomType(roomType || asset.roomLabel);
  const normalizedPlan =
    requestedMode === 'freeform'
      ? buildFreeformEnhancementPlan(normalizedInstructions, resolvedRoomType)
      : null;
  const resolvedPresetKey =
    requestedMode === 'freeform'
      ? resolveFreeformPresetKey({ presetKey, jobType, normalizedPlan })
      : presetKey || jobType;
  const preset = resolveVisionPreset(resolvedPresetKey);
  const effectiveUserPlan = resolveVisionUserPlan({ preset, userPlan });
  const inputHash = buildVisionJobHash({
    assetId: asset._id.toString(),
    sourceVariantId: normalizedSourceVariantId,
    presetKey: preset.key,
    roomType: resolvedRoomType,
    promptVersion: preset.promptVersion,
    mode: requestedMode,
    instructions: normalizedInstructions,
    userPlan: effectiveUserPlan,
  });
  const canUseCache = shouldUseVisionCache({
    forceRegenerate,
    requestedMode,
    preset,
  });

  if (canUseCache) {
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
      if (cachedVariants.length) {
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
    }
  }

  const job = await ImageJobModel.create({
    mediaId: asset._id,
    propertyId: asset.propertyId,
    jobType: preset.key,
    jobCategory: preset.category,
    status: 'processing',
    provider: 'vision_orchestrator',
    presetKey: preset.key,
    mode: requestedMode,
    instructions: normalizedInstructions,
    normalizedPlan,
    originalUrl: sourceRecord.imageUrl || asset.imageUrl || '',
    roomType: resolvedRoomType,
    promptVersion: preset.promptVersion,
    inputHash,
    attemptCount: 0,
    maxAttempts: preset.providerPreference === 'local_sharp_only' ? 1 : 2,
    currentStage: 'initial',
    cancelledAt: null,
    input: {
      roomLabel: asset.roomLabel,
      roomType: resolvedRoomType,
      mimeType: sourceRecord.mimeType || asset.mimeType,
      prompt: preset.basePrompt,
      helperText: preset.helperText,
      recommendedUse: preset.recommendedUse,
      upgradeTier: preset.upgradeTier,
      userPlan: effectiveUserPlan,
      mode: requestedMode,
      instructions: normalizedInstructions,
      normalizedPlan,
      forceRegenerate,
      sourceAssetId: asset._id.toString(),
      sourceVariantId: sourceRecord.kind === 'variant' ? sourceRecord.id : '',
      sourceOrigin: sourceRecord.kind,
      sourceLabel: sourceRecord.label,
      workflowStageKey: normalizedWorkflowStageKey,
    },
  });

  try {
    const renderPlan =
      requestedMode === 'freeform'
        ? buildFreeformRenderPlan(normalizedPlan)
        : buildPresetRenderPlan(preset.key);
    const roomPromptAddon = getRoomPromptAddon(resolvedRoomType);
    const presetPromptAddon = getPresetPromptAddon(preset.key, resolvedRoomType);
    const freeformPlanPromptAddon =
      requestedMode === 'freeform' ? getFreeformPlanPromptAddon(normalizedPlan) : '';
    const fullPrompt = [
      getStrictInpaintingRules(),
      preset.basePrompt,
      requestedMode === 'freeform'
        ? `Seller instructions: ${normalizedInstructions}`
        : '',
      freeformPlanPromptAddon,
      roomPromptAddon,
      presetPromptAddon,
      getUniversalRealismGuardrails(preset.key),
    ]
      .filter(Boolean)
      .join(' ');
    job.input = {
      ...(job.input || {}),
      fullPrompt,
    };
    const stored = await readStoredAsset({
      storageProvider: sourceRecord.storageProvider,
      storageKey: sourceRecord.storageKey,
    });
    const sourceImageBase64 = stored.buffer.toString('base64');
    const orchestrationResult = await orchestrateVisionJob({
      asset,
      preset,
      roomType: resolvedRoomType,
      instructions: normalizedInstructions,
      normalizedPlan,
      requestedMode,
      userPlan: effectiveUserPlan,
      sourceBuffer: stored.buffer,
      sourceImageBase64,
      existingJob: job.toObject(),
      shouldCancel: async () => {
        const latestJob = await ImageJobModel.findById(job._id).select('status').lean();
        return latestJob?.status === 'cancelled';
      },
      providerRunners: {
        runLocalSharp: async () =>
          buildReviewedLocalSharpCandidates({
            asset,
            preset,
            renderPlan,
            resolvedRoomType,
            requestedMode,
            normalizedInstructions,
            normalizedPlan,
            sourceBuffer: stored.buffer,
            sourceImageBase64,
          }),
        runReplicateProvider: async ({ providerKey }) =>
          buildReviewedReplicateCandidates({
            providerKey,
            asset,
            preset,
            renderPlan,
            resolvedRoomType,
            requestedMode,
            normalizedInstructions,
            normalizedPlan,
            fullPrompt,
            roomPromptAddon,
            presetPromptAddon,
            sourceBuffer: stored.buffer,
            sourceImageBase64,
          }),
        runOpenAiEdit: isOpenAiImageEditConfigured()
          ? async () =>
              buildReviewedOpenAiCandidates({
                asset,
                preset,
                renderPlan,
                resolvedRoomType,
                requestedMode,
                normalizedInstructions,
                normalizedPlan,
                fullPrompt,
                roomPromptAddon,
                presetPromptAddon,
                sourceBuffer: stored.buffer,
                sourceImageBase64,
              })
          : undefined,
      },
    });

    const latestJobState = await ImageJobModel.findById(job._id).select('status').lean();
    if (orchestrationResult.cancelled || latestJobState?.status === 'cancelled') {
      const cancelledJob = await ImageJobModel.findById(job._id);
      if (cancelledJob) {
        cancelledJob.status = 'cancelled';
        cancelledJob.currentStage = 'cancelled';
        cancelledJob.failureReason = 'cancelled_by_user';
        cancelledJob.warning =
          cancelledJob.warning || 'Vision generation was cancelled before a new result was selected.';
        cancelledJob.message = 'Vision generation cancelled.';
        cancelledJob.cancelledAt = cancelledJob.cancelledAt || new Date();
        await cancelledJob.save();
        return {
          cached: false,
          preset,
          job: serializeImageJob(cancelledJob.toObject(), []),
          variants: [],
          variant: null,
        };
      }

      throw new Error('Vision generation was cancelled.');
    }

    if (!orchestrationResult.bestVariant) {
      throw new Error('No provider produced a usable output.');
    }

    let createdVariants = await persistOrchestratedVisionCandidates({
      candidates: orchestrationResult.allCandidates,
      job,
      asset,
      sourceRecord,
      preset,
      renderPlan,
      resolvedRoomType,
      requestedMode,
      normalizedInstructions,
      normalizedPlan,
      workflowStageKey: normalizedWorkflowStageKey,
      orchestrationResult,
      roomPromptAddon,
      presetPromptAddon,
    });
    createdVariants = sortVisionVariants(createdVariants);
    job.status = 'completed';
    job.provider = orchestrationResult.providerUsed || 'vision_orchestrator';
    job.attemptCount = Number(orchestrationResult.providerAttemptCount || 0);
    job.maxAttempts = Number(orchestrationResult.orchestration?.chain?.length || 1);
    const usedFallbackVariant =
      Boolean(orchestrationResult.fallbackApplied) ||
      createdVariants.some((variant) => Boolean(variant?.metadata?.fallbackApplied));
    job.currentStage = usedFallbackVariant ? 'fallback' : 'completed';
    job.fallbackMode = usedFallbackVariant ? 'provider_fallback' : null;
    job.failureReason = '';
    job.outputVariantIds = createdVariants.map((variant) => variant.id);
    job.selectedVariantId = createdVariants[0]?.id || null;
    job.input = {
      ...(job.input || {}),
      userPlan: orchestrationResult.userPlan,
      orchestrationChain: orchestrationResult.orchestration?.chain || [],
      orchestrationAttempts: orchestrationResult.orchestration?.attempts || [],
      orchestrationElapsedMs: Number(orchestrationResult.elapsedTimeMs || 0),
      orchestrationTimeBudgetMs: Number(orchestrationResult.maxExecutionTimeMs || 0),
      orchestrationStoppedEarlyReason: orchestrationResult.stoppedEarlyReason || '',
      orchestrationTimeBudgetReached: Boolean(orchestrationResult.timeBudgetReached),
    };
    job.warning = usedFallbackVariant
      ? 'Primary provider was insufficient, so an advanced AI fallback was used.'
      : renderPlan.warning;
    job.message =
      requestedMode === 'freeform'
        ? `Custom enhancement request saved and processed via ${orchestrationResult.providerUsed || 'vision_orchestrator'}.`
        : `Generated via ${orchestrationResult.providerUsed || 'vision_orchestrator'}${usedFallbackVariant ? ' after fallback' : ''}.`;
    await job.save();

    return {
      cached: false,
      preset,
      job: serializeImageJob(job.toObject(), createdVariants),
      variants: createdVariants,
      variant: createdVariants[0] || null,
    };
  } catch (error) {
    const latestJobState = await ImageJobModel.findById(job._id).select('status').lean();
    if (latestJobState?.status === 'cancelled') {
      const cancelledJob = await ImageJobModel.findById(job._id);
      if (cancelledJob) {
        const cancelledVariants = await loadJobVariants(cancelledJob._id);
        return {
          cached: false,
          preset,
          job: serializeImageJob(cancelledJob.toObject(), cancelledVariants),
          variants: cancelledVariants,
          variant: null,
        };
      }
    }

    job.status = 'failed';
    job.currentStage = 'failed';
    job.failureReason = 'orchestration_failed';
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

  await MediaVariantModel.updateMany(
    { mediaId: assetId },
    {
      $set: {
        isSelected: false,
        ...buildVariantLifecycleFields({ isSelected: false }),
      },
    },
  );
  variant.isSelected = true;
  variant.lifecycleState = 'selected';
  variant.expiresAt = null;
  variant.selectedAt = new Date();
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

  const variant = await MediaVariantModel.findOne({
    _id: variantId,
    ...buildActiveVariantQuery(),
  }).lean();
  return serializeMediaVariant(variant);
}
