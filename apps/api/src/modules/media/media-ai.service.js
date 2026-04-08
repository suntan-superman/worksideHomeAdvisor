import { createHash } from 'node:crypto';

import mongoose from 'mongoose';
import sharp from 'sharp';

import { buildMediaVariantUrl, readStoredAsset, saveBinaryBuffer } from '../../services/storageService.js';
import { reviewVisionVariant } from '../../services/photoAnalysisService.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import {
  runReplicateFurnitureRemoval,
  runReplicateInpainting,
} from './replicate-provider.service.js';
import {
  buildActiveVariantQuery,
  buildVariantLifecycleFields,
} from './variant-lifecycle.service.js';
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

function getUniversalRealismGuardrails() {
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

  if (wallColorPresetKeys.has(presetKey)) {
    return 'Change only the wall color concept. Preserve ceilings, trim, baseboards, doors, windows, outlets, wall texture, shadows, and room geometry.';
  }

  if (flooringPresetKeys.has(presetKey)) {
    return 'Change only the flooring concept. Preserve baseboards, furniture perspective, transitions, reflections, shadows, and the true room geometry. Remove or neutralize area-rug appearance where possible so the floor material change is clearly visible.';
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

async function calculateHistogramDrift(sourceBuffer, variantBuffer, options = {}) {
  const width = 192;
  const height = 192;
  const binsPerChannel = 8;
  const totalBins = binsPerChannel ** 3;
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

  const srcHist = new Float32Array(totalBins);
  const nextHist = new Float32Array(totalBins);
  const toBin = (r, g, b) => {
    const rb = Math.min(binsPerChannel - 1, Math.floor((r / 256) * binsPerChannel));
    const gb = Math.min(binsPerChannel - 1, Math.floor((g / 256) * binsPerChannel));
    const bb = Math.min(binsPerChannel - 1, Math.floor((b / 256) * binsPerChannel));
    return rb * binsPerChannel * binsPerChannel + gb * binsPerChannel + bb;
  };

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * width + x) * 3;
      srcHist[toBin(src[offset], src[offset + 1], src[offset + 2])] += 1;
      nextHist[toBin(next[offset], next[offset + 1], next[offset + 2])] += 1;
    }
  }

  let l1Distance = 0;
  for (let i = 0; i < totalBins; i += 1) {
    const srcNormalized = srcHist[i] / pixelCount;
    const nextNormalized = nextHist[i] / pixelCount;
    l1Distance += Math.abs(srcNormalized - nextNormalized);
  }

  return Number((l1Distance / 2).toFixed(4));
}

async function calculateEdgeDensity(imageBuffer, options = {}) {
  const width = 192;
  const height = 192;
  const region = options.region || null;
  const image = await sharp(imageBuffer)
    .rotate()
    .resize(width, height, { fit: 'cover' })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer();

  const left = Math.max(1, Math.min(width - 2, Math.round((region?.left || 0) * width)));
  const top = Math.max(1, Math.min(height - 2, Math.round((region?.top || 0) * height)));
  const right = Math.max(
    left + 1,
    Math.min(width - 1, Math.round(((region?.left || 0) + (region?.width || 1)) * width)),
  );
  const bottom = Math.max(
    top + 1,
    Math.min(height - 1, Math.round(((region?.top || 0) + (region?.height || 1)) * height)),
  );
  const pixelCount = (right - left) * (bottom - top);
  let edgePixels = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const idx = y * width + x;
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

  return Number((edgePixels / Math.max(1, pixelCount)).toFixed(4));
}

function getPresetEvaluationRegions(presetKey) {
  if (presetKey === 'remove_furniture') {
    return {
      focusRegion: { left: 0.03, top: 0.4, width: 0.94, height: 0.56 },
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

      const idx = y * probeWidth + x;
      binary[idx] = 255;
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
      const centroidX = sumX / Math.max(1, area);
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
      const isLikelyFurniture =
        isLargeAnchorFurniture || isMediumFurniture || isWideSurfaceObject;
      if (!isLikelyFurniture) {
        continue;
      }

      const expand = area > 56 ? 2 : 1;
      for (let yy = Math.max(0, minY - expand); yy <= Math.min(probeHeight - 1, maxY + expand); yy += 1) {
        for (let xx = Math.max(0, minX - expand); xx <= Math.min(probeWidth - 1, maxX + expand); xx += 1) {
          const outIndex = yy * probeWidth + xx;
          furnitureMask[outIndex] = 255;
        }
      }
    }
  }

  const finalMask = bridgeNearbyComponents ? new Uint8Array(furnitureMask.length) : furnitureMask;
  if (bridgeNearbyComponents) {
    // Keep general furniture masks broad enough for protection, but let object-removal
    // mode keep components separate so we can target one object at a time.
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

  const shapeMaskBuffer = await sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'fill' })
    .blur(1.2)
    .png()
    .toBuffer();

  const adaptiveMaskProbe = await buildAdaptiveFurnitureMaskBuffer(sourceBuffer);
  const adaptiveMaskBuffer = await sharp(adaptiveMaskProbe)
    .resize(width, height, { fit: 'fill' })
    .blur(1.3)
    .png()
    .toBuffer();

  if (presetKey === 'remove_furniture') {
    return sharp(shapeMaskBuffer)
      .composite([{ input: adaptiveMaskBuffer, blend: 'lighten' }])
      .png()
      .toBuffer();
  }

  if (String(presetKey || '').startsWith('floor_')) {
    // Protect furniture from flooring transforms by carving it out of the floor mask.
    return sharp(shapeMaskBuffer)
      .composite([{ input: adaptiveMaskBuffer, blend: 'dest-out' }])
      .blur(0.6)
      .png()
      .toBuffer();
  }

  return shapeMaskBuffer;
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

function normalizePixelRegion(region, width, height) {
  return {
    left: region.x / Math.max(1, width),
    top: region.y / Math.max(1, height),
    width: region.width / Math.max(1, width),
    height: region.height / Math.max(1, height),
  };
}

function insetMaskRegion(region, imageWidth, imageHeight, inset) {
  const x = Math.min(
    imageWidth - 1,
    Math.max(0, region.x + inset),
  );
  const y = Math.min(
    imageHeight - 1,
    Math.max(0, region.y + inset),
  );
  const width = Math.max(1, Math.min(imageWidth - x, region.width - inset * 2));
  const height = Math.max(1, Math.min(imageHeight - y, region.height - inset * 2));

  return {
    x,
    y,
    width,
    height,
    area: width * height,
  };
}

function getFurnitureRemovalAttemptConfigs(region, imageWidth, imageHeight) {
  return [
    {
      stage: 'initial',
      strength: 0.52,
      guidanceScale: 8.6,
      numInferenceSteps: 40,
      region,
      promptSuffix:
        'Remove only the selected furniture object inside the mask and reconstruct the newly visible background. Do not restage or replace anything.',
    },
    {
      stage: 'split_retry',
      strength: 0.62,
      guidanceScale: 8.2,
      numInferenceSteps: 46,
      region,
      promptSuffix:
        'Try a stronger surgical removal of the same object. Keep walls, floors, windows, trim, and perspective unchanged. Do not restage the room.',
    },
    {
      stage: 'conservative_retry',
      strength: 0.68,
      guidanceScale: 7.8,
      numInferenceSteps: 52,
      region,
      promptSuffix:
        'Make one final attempt to remove only the masked furniture object while preserving the original room. Do not replace the furniture with different furniture.',
    },
  ];
}

function scoreFurnitureRemovalRegion(region, imageWidth, imageHeight) {
  const areaRatio = region.area / Math.max(1, imageWidth * imageHeight);
  const centerX = (region.x + region.width / 2) / Math.max(1, imageWidth);
  const centerY = (region.y + region.height / 2) / Math.max(1, imageHeight);
  const centrality = 1 - Math.min(1, Math.abs(centerX - 0.5) * 2);
  const lowerMidBias = 1 - Math.min(1, Math.abs(centerY - 0.68) * 2.4);
  const targetAreaBias = 1 - Math.min(1, Math.abs(areaRatio - 0.055) / 0.055);
  const widthPenalty = region.width / Math.max(1, imageWidth) > 0.58 ? 0.72 : 1;

  return Number(
    ((centrality * 0.34 + lowerMidBias * 0.36 + targetAreaBias * 0.3) * widthPenalty).toFixed(4),
  );
}

function buildFurnitureRemovalCropRegion(region, imageWidth, imageHeight) {
  const padding = Math.max(22, Math.min(96, Math.round(Math.max(region.width, region.height) * 0.55)));
  return expandMaskRegion(region, imageWidth, imageHeight, padding);
}

async function extractImageRegionBuffer(imageBuffer, region) {
  return sharp(imageBuffer)
    .extract({
      left: Math.max(0, Math.round(region.x)),
      top: Math.max(0, Math.round(region.y)),
      width: Math.max(1, Math.round(region.width)),
      height: Math.max(1, Math.round(region.height)),
    })
    .png()
    .toBuffer();
}

async function compositeImageRegionBuffer(baseBuffer, overlayBuffer, region) {
  const resizedOverlay = await sharp(overlayBuffer)
    .resize(region.width, region.height, { fit: 'fill' })
    .jpeg({ quality: 94 })
    .toBuffer();

  return sharp(baseBuffer)
    .composite([
      {
        input: resizedOverlay,
        left: Math.max(0, Math.round(region.x)),
        top: Math.max(0, Math.round(region.y)),
      },
    ])
    .jpeg({ quality: 94 })
    .toBuffer();
}

function getFurnitureRemovalRejectReasons({
  maskedChangeRatio,
  targetRegionChangeRatio,
  maskedEdgeDensityDelta,
  outsideMaskChangeRatio,
  topHalfChangeRatio,
  structureHistogramDrift,
}) {
  const reasons = [];
  if (maskedChangeRatio < 0.1) {
    reasons.push('masked_change_too_low');
  }
  if (targetRegionChangeRatio < 0.07) {
    reasons.push('room_region_change_too_low');
  }
  if (maskedEdgeDensityDelta > -0.008) {
    reasons.push('object_silhouette_persisted');
  }
  if (outsideMaskChangeRatio > 0.22) {
    reasons.push('outside_target_change_too_high');
  }
  if (topHalfChangeRatio > 0.3 && structureHistogramDrift > 0.18) {
    reasons.push('upper_architecture_change_too_high');
  }
  if (structureHistogramDrift > 0.48) {
    reasons.push('upper_structure_drift_too_high');
  }
  return reasons;
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

async function extractMaskRegions(maskBuffer, options = {}) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const raw = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const binary = new Uint8Array(width * height);
  let whitePixels = 0;
  for (let i = 0; i < binary.length; i += 1) {
    const value = raw[i * 3];
    if (value > 32) {
      binary[i] = 1;
      whitePixels += 1;
    }
  }
  const visited = new Uint8Array(binary.length);
  const minRegionArea = Math.max(120, Math.round(width * height * (options.minAreaRatio || 0.003)));
  const regions = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!binary[start] || visited[start]) {
        continue;
      }
      const queue = [start];
      visited[start] = 1;
      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (queue.length) {
        const index = queue.pop();
        const cx = index % width;
        const cy = Math.floor(index / width);
        area += 1;
        if (cx < minX) {
          minX = cx;
        }
        if (cx > maxX) {
          maxX = cx;
        }
        if (cy < minY) {
          minY = cy;
        }
        if (cy > maxY) {
          maxY = cy;
        }
        for (const [dx, dy] of directions) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const next = ny * width + nx;
          if (!binary[next] || visited[next]) {
            continue;
          }
          visited[next] = 1;
          queue.push(next);
        }
      }
      if (area < minRegionArea) {
        continue;
      }
      regions.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        area,
      });
    }
  }

  const overlapThreshold = 0.35;
  const merged = [];
  for (const region of regions.sort((left, right) => right.area - left.area)) {
    let mergedIntoExisting = false;
    for (const current of merged) {
      const intersectionX1 = Math.max(region.x, current.x);
      const intersectionY1 = Math.max(region.y, current.y);
      const intersectionX2 = Math.min(region.x + region.width, current.x + current.width);
      const intersectionY2 = Math.min(region.y + region.height, current.y + current.height);
      const intersectionWidth = Math.max(0, intersectionX2 - intersectionX1);
      const intersectionHeight = Math.max(0, intersectionY2 - intersectionY1);
      const intersectionArea = intersectionWidth * intersectionHeight;
      const minArea = Math.min(region.area, current.area);
      if (minArea > 0 && intersectionArea / minArea >= overlapThreshold) {
        const unionLeft = Math.min(region.x, current.x);
        const unionTop = Math.min(region.y, current.y);
        const unionRight = Math.max(region.x + region.width, current.x + current.width);
        const unionBottom = Math.max(region.y + region.height, current.y + current.height);
        current.x = unionLeft;
        current.y = unionTop;
        current.width = unionRight - unionLeft;
        current.height = unionBottom - unionTop;
        current.area = Math.max(current.area, region.area) + intersectionArea;
        mergedIntoExisting = true;
        break;
      }
    }
    if (!mergedIntoExisting) {
      merged.push({ ...region });
    }
  }

  return {
    width,
    height,
    coverageRatio: Number((whitePixels / Math.max(1, width * height)).toFixed(4)),
    regions: merged.sort((left, right) => right.area - left.area),
  };
}

async function extractMaskComponents(maskBuffer, options = {}) {
  const metadata = await sharp(maskBuffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const raw = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const binary = new Uint8Array(width * height);
  let whitePixels = 0;
  for (let i = 0; i < binary.length; i += 1) {
    const value = raw[i * 3];
    if (value > 32) {
      binary[i] = 1;
      whitePixels += 1;
    }
  }

  const visited = new Uint8Array(binary.length);
  const minComponentArea = Math.max(
    6,
    Math.round(width * height * (options.minAreaRatio || 0.003)),
  );
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const components = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!binary[start] || visited[start]) {
        continue;
      }
      const queue = [start];
      const pixels = [];
      visited[start] = 1;
      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (queue.length) {
        const index = queue.pop();
        const cx = index % width;
        const cy = Math.floor(index / width);
        pixels.push(index);
        area += 1;
        if (cx < minX) {
          minX = cx;
        }
        if (cx > maxX) {
          maxX = cx;
        }
        if (cy < minY) {
          minY = cy;
        }
        if (cy > maxY) {
          maxY = cy;
        }
        for (const [dx, dy] of directions) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const next = ny * width + nx;
          if (!binary[next] || visited[next]) {
            continue;
          }
          visited[next] = 1;
          queue.push(next);
        }
      }
      if (area < minComponentArea) {
        continue;
      }

      const rgba = Buffer.alloc(width * height * 4);
      for (const pixelIndex of pixels) {
        const offset = pixelIndex * 4;
        rgba[offset] = 255;
        rgba[offset + 1] = 255;
        rgba[offset + 2] = 255;
        rgba[offset + 3] = 255;
      }

      components.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        area,
        maskBuffer: await sharp(rgba, {
          raw: { width, height, channels: 4 },
        })
          .png()
          .toBuffer(),
      });
    }
  }

  return {
    width,
    height,
    coverageRatio: Number((whitePixels / Math.max(1, width * height)).toFixed(4)),
    components: components.sort((left, right) => right.area - left.area),
  };
}

async function buildMaskBufferFromRegion(maskWidth, maskHeight, region) {
  const svg = `
    <svg width="${maskWidth}" height="${maskHeight}" viewBox="0 0 ${maskWidth} ${maskHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${maskWidth}" height="${maskHeight}" fill="black" />
      <rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" rx="${Math.round(Math.min(maskWidth, maskHeight) * 0.02)}" ry="${Math.round(Math.min(maskWidth, maskHeight) * 0.02)}" fill="white" />
    </svg>
  `;
  return sharp(Buffer.from(svg))
    .resize(maskWidth, maskHeight, { fit: 'fill' })
    .blur(0.8)
    .png()
    .toBuffer();
}

function expandMaskRegion(region, imageWidth, imageHeight, padding) {
  const x = Math.max(0, region.x - padding);
  const y = Math.max(0, region.y - padding);
  const right = Math.min(imageWidth, region.x + region.width + padding);
  const bottom = Math.min(imageHeight, region.y + region.height + padding);
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
    area: Math.max(1, (right - x) * (bottom - y)),
  };
}

async function executeFurnitureRemovalObjectStrategy({
  asset,
  job,
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
}) {
  const normalizedSourceBuffer = await sharp(sourceBuffer).rotate().jpeg({ quality: 96 }).toBuffer();
  const sourceMetadata = await sharp(normalizedSourceBuffer).metadata();
  const sourceWidth = Number(sourceMetadata.width || 0);
  const sourceHeight = Number(sourceMetadata.height || 0);
  const sourceImageBase64 = normalizedSourceBuffer.toString('base64');
  const fallbackMaskBuffer = await buildInpaintingMaskBuffer(
    normalizedSourceBuffer,
    preset.key,
    resolvedRoomType,
  );
  const adaptiveFurnitureMaskProbe = await buildAdaptiveFurnitureMaskBuffer(normalizedSourceBuffer, {
    bridgeNearbyComponents: false,
  });
  let componentAnalysis = await extractMaskComponents(adaptiveFurnitureMaskProbe, {
    minAreaRatio: 0.0035,
  });
  if (!componentAnalysis.components.length) {
    const fallbackRegionAnalysis = await extractMaskRegions(fallbackMaskBuffer, { minAreaRatio: 0.0025 });
    componentAnalysis = {
      width: sourceWidth,
      height: sourceHeight,
      coverageRatio: fallbackRegionAnalysis.coverageRatio,
      components: fallbackRegionAnalysis.regions.map((region) => ({
        ...region,
        maskBuffer: null,
      })),
    };
  }

  const objectTargets = await Promise.all(
    componentAnalysis.components.map(async (component, index) => {
      const componentRegion =
        componentAnalysis.width === sourceWidth && componentAnalysis.height === sourceHeight
          ? {
              x: component.x,
              y: component.y,
              width: component.width,
              height: component.height,
              area: component.area,
            }
          : {
              x: Math.max(0, Math.round((component.x / Math.max(1, componentAnalysis.width)) * sourceWidth)),
              y: Math.max(0, Math.round((component.y / Math.max(1, componentAnalysis.height)) * sourceHeight)),
              width: Math.max(
                1,
                Math.round((component.width / Math.max(1, componentAnalysis.width)) * sourceWidth),
              ),
              height: Math.max(
                1,
                Math.round((component.height / Math.max(1, componentAnalysis.height)) * sourceHeight),
              ),
              area: Math.max(
                1,
                Math.round(
                  (component.area / Math.max(1, componentAnalysis.width * componentAnalysis.height)) *
                    sourceWidth *
                    sourceHeight,
                ),
              ),
            };
      const padding = Math.max(
        8,
        Math.min(18, Math.round(Math.max(componentRegion.width, componentRegion.height) * 0.12)),
      );
      const expandedRegion = expandMaskRegion(
        componentRegion,
        sourceWidth,
        sourceHeight,
        padding,
      );
      const componentMaskBuffer = component.maskBuffer
        ? await sharp(component.maskBuffer)
            .resize(sourceWidth, sourceHeight, { fit: 'fill' })
            .blur(0.9)
            .png()
            .toBuffer()
        : await buildMaskBufferFromRegion(sourceWidth, sourceHeight, componentRegion);
      return {
        index,
        focusRegion: componentRegion,
        region: expandedRegion,
        maskBuffer: componentMaskBuffer,
        priority: scoreFurnitureRemovalRegion(
          componentRegion,
          sourceWidth,
          sourceHeight,
        ),
      };
    }),
  );
  const rankedObjectTargets = objectTargets
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }
      return left.region.area - right.region.area;
    })
    .slice(0, 4);
  const maskRegionAnalysis = {
    width: sourceWidth,
    height: sourceHeight,
    coverageRatio: componentAnalysis.coverageRatio,
    regions: rankedObjectTargets.map((target) => ({
      ...target.focusRegion,
      area: target.focusRegion.area || target.focusRegion.width * target.focusRegion.height,
    })),
  };

  const attemptLog = [
    {
      stage: 'mask_analysis',
      maskCoverageRatio: componentAnalysis.coverageRatio,
      targetCount: rankedObjectTargets.length,
      providerStrategy: preset.providerStrategy || 'object_removal',
      targetOrder: rankedObjectTargets.map((target) => ({
        index: target.index,
        priority: target.priority,
        focusRegion: target.focusRegion,
        cropRegion: target.region,
      })),
    },
  ];

  if (!rankedObjectTargets.length) {
    return {
      status: 'needs_user_action',
      attemptCount: 0,
      currentStage: 'guided_selection',
      fallbackMode: 'guided_selection',
      failureReason: 'no_object_targets',
      message:
        'We could not isolate individual furniture objects in this photo. Try a straighter angle or a tighter crop on the object you want removed first.',
      warning:
        'Object-level furniture targeting could not find reliable removal zones in this image.',
      attemptLog,
      maskRegionAnalysis,
      objectTargets: [],
      createdVariants: [],
    };
  }

  const objectMaskBuffers = await Promise.all(
    rankedObjectTargets.map((target) => Promise.resolve(target.maskBuffer)),
  );

  const evaluationRegions = getPresetEvaluationRegions(preset.key);
  let workingBuffer = normalizedSourceBuffer;
  let attemptCount = 0;
  const successfulTargets = [];
  const failedTargets = [];

  for (let targetIndex = 0; targetIndex < rankedObjectTargets.length; targetIndex += 1) {
    const target = rankedObjectTargets[targetIndex];
    const maskBuffer = objectMaskBuffers[targetIndex];
    const cropRegion = buildFurnitureRemovalCropRegion(
      target.region,
      maskRegionAnalysis.width,
      maskRegionAnalysis.height,
    );
    const targetRegionWithinCrop = {
      x: Math.max(0, target.focusRegion.x - cropRegion.x),
      y: Math.max(0, target.focusRegion.y - cropRegion.y),
      width: Math.min(cropRegion.width, target.focusRegion.width),
      height: Math.min(cropRegion.height, target.focusRegion.height),
    };
    const normalizedTargetRegionWithinCrop = normalizePixelRegion(
      targetRegionWithinCrop,
      cropRegion.width,
      cropRegion.height,
    );
    const normalizedTargetRegionOnImage = normalizePixelRegion(
      target.focusRegion,
      sourceWidth,
      sourceHeight,
    );
    const cropMaskBuffer = await extractImageRegionBuffer(maskBuffer, cropRegion);
    const attemptConfigs = getFurnitureRemovalAttemptConfigs(
      target.focusRegion,
      sourceWidth,
      sourceHeight,
    );

    let acceptedTarget = null;
    let bestSoftCandidate = null;
    for (const attemptConfig of attemptConfigs) {
      const currentCropBuffer = await extractImageRegionBuffer(workingBuffer, cropRegion);
      const sourceMaskedEdgeDensity = await calculateMaskedEdgeDensity(currentCropBuffer, cropMaskBuffer);
      const providerOutputs = await runReplicateFurnitureRemoval({
        image: currentCropBuffer,
        mask: cropMaskBuffer,
        model: preset.replicateModel,
        prompt: `${fullPrompt} ${attemptConfig.promptSuffix}`,
        strength: attemptConfig.strength,
        outputCount: 1,
        guidanceScale: attemptConfig.guidanceScale,
        numInferenceSteps: attemptConfig.numInferenceSteps,
        scheduler: preset.scheduler,
        negativePrompt: preset.negativePrompt,
        seed: Math.floor(Math.random() * 1_000_000_000),
      });
      attemptCount += 1;

      if (!providerOutputs.length) {
        attemptLog.push({
          attempt: attemptCount,
          stage: attemptConfig.stage,
          targetIndex,
          sourceRegionIndex: target.index,
          priority: target.priority,
          outputCount: 0,
          result: 'no_output',
        });
        continue;
      }

      const candidateCropBuffer = await convertReplicateOutputToBuffer(providerOutputs[0]);
      const candidateFullBuffer = await compositeImageRegionBuffer(
        workingBuffer,
        candidateCropBuffer,
        cropRegion,
      );
      const maskedChangeRatio = await calculateMaskedVisualChangeRatio(
        currentCropBuffer,
        candidateCropBuffer,
        cropMaskBuffer,
      );
      const targetRegionChangeRatio = await calculateVisualChangeRatio(
        workingBuffer,
        candidateFullBuffer,
        {
          region: normalizedTargetRegionOnImage,
        },
      );
      const variantMaskedEdgeDensity = await calculateMaskedEdgeDensity(
        candidateCropBuffer,
        cropMaskBuffer,
      );
      const maskedEdgeDensityDelta = Number(
        (variantMaskedEdgeDensity - sourceMaskedEdgeDensity).toFixed(4),
      );
      const outsideMaskChangeRatio = await calculateOutsideMaskVisualChangeRatio(
        currentCropBuffer,
        candidateCropBuffer,
        cropMaskBuffer,
      );
      const topHalfChangeRatio = await calculateVisualChangeRatio(
        normalizedSourceBuffer,
        candidateFullBuffer,
        {
          region: evaluationRegions.structureRegion,
        },
      );
      const structureHistogramDrift = await calculateHistogramDrift(
        normalizedSourceBuffer,
        candidateFullBuffer,
        {
          region: evaluationRegions.structureRegion,
        },
      );
      const architecturePreserved =
        topHalfChangeRatio <= 0.16 ||
        (topHalfChangeRatio <= 0.3 &&
          structureHistogramDrift <= 0.18 &&
          outsideMaskChangeRatio <= 0.16);
      const strictAccepted =
        maskedChangeRatio >= 0.14 &&
        targetRegionChangeRatio >= 0.1 &&
        (maskedEdgeDensityDelta <= -0.006 || maskedChangeRatio >= 0.24) &&
        outsideMaskChangeRatio <= 0.16 &&
        architecturePreserved &&
        structureHistogramDrift <= 0.44;
      const softArchitecturePreserved =
        topHalfChangeRatio <= 0.18 ||
        (topHalfChangeRatio <= 0.34 &&
          structureHistogramDrift <= 0.18 &&
          outsideMaskChangeRatio <= 0.2);
      const softAccepted =
        maskedChangeRatio >= 0.1 &&
        targetRegionChangeRatio >= 0.07 &&
        maskedEdgeDensityDelta <= -0.008 &&
        outsideMaskChangeRatio <= 0.2 &&
        softArchitecturePreserved &&
        structureHistogramDrift <= 0.48;
      const practicalArchitecturePreserved =
        topHalfChangeRatio <= 0.2 ||
        (topHalfChangeRatio <= 0.36 &&
          structureHistogramDrift <= 0.16 &&
          outsideMaskChangeRatio <= 0.22);
      const practicalPartialAccepted =
        maskedChangeRatio >= 0.35 &&
        targetRegionChangeRatio >= 0.25 &&
        maskedEdgeDensityDelta <= 0 &&
        outsideMaskChangeRatio <= 0.22 &&
        practicalArchitecturePreserved &&
        structureHistogramDrift <= 0.18;
      const rejectReasons = getFurnitureRemovalRejectReasons({
        maskedChangeRatio,
        targetRegionChangeRatio,
        maskedEdgeDensityDelta,
        outsideMaskChangeRatio,
        topHalfChangeRatio,
        structureHistogramDrift,
      });
      const primaryRejectReason = rejectReasons[0] || 'thresholds_not_met';

      attemptLog.push({
        attempt: attemptCount,
        stage: attemptConfig.stage,
        targetIndex,
        sourceRegionIndex: target.index,
        priority: target.priority,
        outputCount: providerOutputs.length,
        maskedChangeRatio,
        targetRegionChangeRatio,
        maskedEdgeDensityDelta,
        outsideMaskChangeRatio,
        topHalfChangeRatio,
        structureHistogramDrift,
        primaryRejectReason:
          strictAccepted || softAccepted || practicalPartialAccepted ? null : primaryRejectReason,
        rejectReasons:
          strictAccepted || softAccepted || practicalPartialAccepted ? [] : rejectReasons,
        result: strictAccepted
          ? 'accepted'
          : softAccepted
          ? 'soft_accepted'
          : practicalPartialAccepted
          ? 'practical_partial'
          : 'rejected',
      });

      if ((softAccepted || practicalPartialAccepted) && !strictAccepted) {
        const softCandidate = {
          buffer: candidateFullBuffer,
          maskedChangeRatio,
          targetRegionChangeRatio,
          maskedEdgeDensityDelta,
          outsideMaskChangeRatio,
          topHalfChangeRatio,
          structureHistogramDrift,
          primaryRejectReason: practicalPartialAccepted ? 'practical_partial' : primaryRejectReason,
          lowConfidence: true,
        };
        if (
          !bestSoftCandidate ||
          softCandidate.maskedChangeRatio > bestSoftCandidate.maskedChangeRatio
        ) {
          bestSoftCandidate = softCandidate;
        }
      }

      if (!strictAccepted) {
        continue;
      }

      acceptedTarget = {
        buffer: candidateFullBuffer,
        maskedChangeRatio,
        targetRegionChangeRatio,
        maskedEdgeDensityDelta,
        outsideMaskChangeRatio,
        topHalfChangeRatio,
        structureHistogramDrift,
        primaryRejectReason: null,
        lowConfidence: false,
      };
      break;
    }

    if (!acceptedTarget && bestSoftCandidate) {
      acceptedTarget = bestSoftCandidate;
    }

    if (acceptedTarget) {
      workingBuffer = acceptedTarget.buffer;
      successfulTargets.push({
        targetIndex,
        sourceRegionIndex: target.index,
        priority: target.priority,
        region: target.focusRegion,
        ...acceptedTarget,
      });
    } else {
      failedTargets.push({
        targetIndex,
        sourceRegionIndex: target.index,
        priority: target.priority,
        region: target.focusRegion,
      });
    }
  }

  if (!successfulTargets.length) {
    return {
      status: 'needs_user_action',
      attemptCount,
      currentStage: 'guided_selection',
      fallbackMode: 'guided_selection',
      failureReason: 'object_removal_failed',
      message:
        'We tried isolated object removal first, but none of the object targets could be removed cleanly. Try a straighter angle or a tighter object photo.',
      warning:
        'Object-level removal attempts preserved room safety, but no target produced real subtraction.',
      attemptLog,
      maskRegionAnalysis,
      objectTargets: rankedObjectTargets,
      createdVariants: [],
    };
  }

  const hasLowConfidenceTarget = successfulTargets.some((target) => target.lowConfidence);
  const review = await reviewVisionVariant({
    property: null,
    roomLabel: asset.roomLabel,
    presetKey: preset.key,
    variantCategory: preset.category,
    mimeType: 'image/jpeg',
    sourceImageBase64,
    variantImageBase64: workingBuffer.toString('base64'),
  });
  const overallScore = Math.max(
    0,
    calculateVisionReviewOverallScore(review) - (failedTargets.length ? 4 : 0),
  );
  const saved = await saveBinaryBuffer({
    propertyId: asset.propertyId.toString(),
    mimeType: 'image/jpeg',
    buffer: workingBuffer,
  });
  const variant = await MediaVariantModel.create({
    visionJobId: job._id,
    mediaId: asset._id,
    propertyId: asset.propertyId,
    variantType: preset.key,
    variantCategory: preset.category,
    label: failedTargets.length ? `${renderPlan.label} Partial Success` : `${renderPlan.label} A`,
    mimeType: 'image/jpeg',
    storageProvider: saved.storageProvider,
    storageKey: saved.storageKey,
    byteSize: saved.byteSize,
    isSelected: false,
    ...buildVariantLifecycleFields({ isSelected: false }),
    useInBrochure: false,
    useInReport: false,
    metadata: {
      warning: failedTargets.length || hasLowConfidenceTarget
        ? 'We removed some isolated furniture objects, but overlapping pieces or lower-confidence removals may still need separate passes.'
        : renderPlan.warning,
      summary: renderPlan.summary,
      differenceHint: renderPlan.differenceHint,
      effects: [
        ...(renderPlan.effects || []),
        'Object-level removal strategy',
        failedTargets.length || hasLowConfidenceTarget
          ? 'Partial success'
          : 'Isolated target subtraction',
      ],
      sourceAssetId: asset._id.toString(),
      roomLabel: asset.roomLabel,
      roomType: resolvedRoomType,
      provider: 'replicate',
      providerStrategy: preset.providerStrategy || 'object_removal',
      presetKey: preset.key,
      promptVersion: preset.promptVersion,
      helperText: preset.helperText,
      recommendedUse: preset.recommendedUse,
      upgradeTier: preset.upgradeTier,
      category: preset.category,
      disclaimerType: preset.disclaimerType,
      roomPromptAddon,
      presetPromptAddon,
      mode: requestedMode,
      instructions: normalizedInstructions,
      normalizedPlan,
      maskStrategy: 'object_level_crop_masks',
      fallbackMode: failedTargets.length ? 'partial_success' : null,
        review: {
          ...review,
          overallScore,
          successfulObjectCount: successfulTargets.length,
          failedObjectCount: failedTargets.length,
          lowConfidenceObjectCount: successfulTargets.filter((target) => target.lowConfidence).length,
          successfulTargets,
        },
      },
  });

  return {
    status: 'completed',
    attemptCount,
    currentStage: failedTargets.length ? 'fallback' : 'completed',
    fallbackMode: failedTargets.length ? 'partial_success' : null,
    attemptLog,
    maskRegionAnalysis,
    objectTargets: rankedObjectTargets,
    createdVariants: [serializeMediaVariant(variant.toObject())],
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
  presetKey,
  roomType,
  promptVersion,
  mode = 'preset',
  instructions = '',
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        assetId,
        presetKey,
        roomType,
        promptVersion,
        mode,
        instructions: String(instructions || '').trim().toLowerCase(),
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

export async function listMediaVariants(assetId) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const variants = await MediaVariantModel.find({ mediaId: assetId })
    .find(buildActiveVariantQuery())
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
  mode = 'preset',
  instructions = '',
  forceRegenerate = false,
  maskUrl = '',
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate image variants.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

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
  const inputHash = buildVisionJobHash({
    assetId: asset._id.toString(),
    presetKey: preset.key,
    roomType: resolvedRoomType,
    promptVersion: preset.promptVersion,
    mode: requestedMode,
    instructions: normalizedInstructions,
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
    provider: preset.providerPreference || 'local_sharp',
    presetKey: preset.key,
    mode: requestedMode,
    instructions: normalizedInstructions,
    normalizedPlan,
    originalUrl: asset.imageUrl || '',
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
      upgradeTier: preset.upgradeTier,
      mode: requestedMode,
      instructions: normalizedInstructions,
      normalizedPlan,
      forceRegenerate,
      maskUrl: String(maskUrl || ''),
    },
    attemptCount: 0,
    maxAttempts: preset.key === 'remove_furniture' ? 4 : 1,
    currentStage: 'initial',
    fallbackMode: null,
    failureReason: '',
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
      if ((preset.providerStrategy || '') === 'object_removal') {
        const objectRemovalResult = await executeFurnitureRemovalObjectStrategy({
          asset,
          job,
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
        });
        job.attemptCount = objectRemovalResult.attemptCount;
        job.currentStage = objectRemovalResult.currentStage;
        job.fallbackMode = objectRemovalResult.fallbackMode;
        job.input = {
          ...(job.input || {}),
          attemptLog: objectRemovalResult.attemptLog,
          maskRegionAnalysis: objectRemovalResult.maskRegionAnalysis,
          objectTargets: objectRemovalResult.objectTargets,
        };

        if (objectRemovalResult.status === 'needs_user_action') {
          job.status = 'needs_user_action';
          job.failureReason = objectRemovalResult.failureReason;
          job.message = objectRemovalResult.message;
          job.warning = objectRemovalResult.warning;
          await job.save();
          return {
            cached: false,
            preset,
            job: serializeImageJob(job.toObject(), []),
            variants: [],
            variant: null,
          };
        }

        createdVariants = objectRemovalResult.createdVariants;
      } else {
      const maskBuffer = await buildInpaintingMaskBuffer(
        stored.buffer,
        preset.key,
        resolvedRoomType,
      );
      const attemptLog = [];
      let maskRegionAnalysis = null;
      let splitMaskBuffers = [];
      let splitMaskRegions = [];
      if (preset.key === 'remove_furniture') {
        const adaptiveFurnitureMask = await buildAdaptiveFurnitureMaskAtSourceSize(stored.buffer);
        maskRegionAnalysis = await extractMaskRegions(adaptiveFurnitureMask.adaptiveMaskBuffer, {
          minAreaRatio: 0.0018,
        });
        if (!maskRegionAnalysis.regions.length) {
          maskRegionAnalysis = await extractMaskRegions(maskBuffer, { minAreaRatio: 0.0028 });
        }
        const padding = Math.max(
          8,
          Math.min(20, Math.round(Math.min(maskRegionAnalysis.width, maskRegionAnalysis.height) * 0.03)),
        );
        splitMaskRegions = maskRegionAnalysis.regions
          .slice(0, 3)
          .map((region) =>
            expandMaskRegion(
              region,
              maskRegionAnalysis.width,
              maskRegionAnalysis.height,
              padding,
            ),
          );
        splitMaskBuffers = await Promise.all(
          splitMaskRegions.map((region) =>
            buildMaskBufferFromRegion(
              maskRegionAnalysis.width,
              maskRegionAnalysis.height,
              region,
            ),
          ),
        );
        attemptLog.push({
          stage: 'mask_analysis',
          maskCoverageRatio: maskRegionAnalysis.coverageRatio,
          splitCount: splitMaskBuffers.length,
          forceSplit:
            maskRegionAnalysis.coverageRatio > 0.25 || maskRegionAnalysis.regions.length > 1,
        });
      }
      let activeMaskBuffer =
        preset.key === 'remove_furniture' && splitMaskBuffers.length
          ? splitMaskBuffers[0]
          : maskBuffer;
      let activeMaskRegion =
        preset.key === 'remove_furniture' && splitMaskRegions.length ? splitMaskRegions[0] : null;
      const initialPrompt =
        preset.key === 'remove_furniture'
          ? `${fullPrompt} Remove ONLY the furniture inside the masked area. Do not restage, replace, recolor, or reshape furniture. If the task cannot be completed safely, return the original image unchanged.`
          : fullPrompt;
      let providerOutputs = await runReplicateInpainting({
        image: stored.buffer,
        mask: activeMaskBuffer,
        model: preset.replicateModel,
        prompt: initialPrompt,
        strength: preset.key === 'remove_furniture' ? 0.3 : preset.strength,
        outputCount:
          preset.key === 'remove_furniture'
            ? 2
            : preset.outputCount || 2,
        guidanceScale:
          preset.key === 'remove_furniture'
            ? 10
            : preset.guidanceScale,
        numInferenceSteps: preset.key === 'remove_furniture' ? 30 : preset.numInferenceSteps,
        scheduler: preset.scheduler,
        negativePrompt: preset.negativePrompt,
        seed: Math.floor(Math.random() * 1_000_000_000),
      });
      job.attemptCount = 1;
      job.currentStage = 'initial';
      attemptLog.push({
        attempt: 1,
        stage: 'initial',
        maskType:
          preset.key === 'remove_furniture' && splitMaskRegions.length ? 'split_region_0' : 'full_mask',
        strength: preset.key === 'remove_furniture' ? 0.3 : preset.strength,
        guidanceScale:
          preset.key === 'remove_furniture'
            ? 10
            : preset.guidanceScale,
        outputCount: providerOutputs.length,
      });
      createdVariants = [];
      const rejectedCandidates = [];
      const evaluationRegions = getPresetEvaluationRegions(preset.key);
      for (let index = 0; index < providerOutputs.length; index += 1) {
        let output = providerOutputs[index];
        let buffer = await convertReplicateOutputToBuffer(output);
        let activeEvaluationRegion =
          preset.key === 'remove_furniture' && activeMaskRegion && maskRegionAnalysis
            ? normalizePixelRegion(
                activeMaskRegion,
                maskRegionAnalysis.width,
                maskRegionAnalysis.height,
              )
            : evaluationRegions.focusRegion;
        let visualChangeRatio = await calculateVisualChangeRatio(stored.buffer, buffer);
        let focusRegionChangeRatio = await calculateVisualChangeRatio(stored.buffer, buffer, {
          region: activeEvaluationRegion,
        });
        if (preset.key === 'remove_furniture') {
          const maxRefinementPasses = splitMaskBuffers.length > 1 ? Math.min(2, splitMaskBuffers.length - 1) : 1;
          let refinementPass = 0;
          while (refinementPass < maxRefinementPasses && focusRegionChangeRatio < 0.18) {
            const attemptNumber = Math.min(4, job.attemptCount + 1);
            const splitMaskIndex = splitMaskBuffers.length
              ? Math.min(refinementPass + 1, splitMaskBuffers.length - 1)
              : 0;
            const useSplitMask = splitMaskBuffers.length > 0;
            const stage = refinementPass === 0 ? 'conservative_retry' : 'split_retry';
            activeMaskBuffer = useSplitMask ? splitMaskBuffers[splitMaskIndex] : maskBuffer;
            activeMaskRegion =
              useSplitMask && splitMaskRegions[splitMaskIndex]
                ? splitMaskRegions[splitMaskIndex]
                : activeMaskRegion;
            activeEvaluationRegion =
              activeMaskRegion && maskRegionAnalysis
                ? normalizePixelRegion(
                    activeMaskRegion,
                    maskRegionAnalysis.width,
                    maskRegionAnalysis.height,
                  )
                : evaluationRegions.focusRegion;
            const refinementOutputs = await runReplicateInpainting({
              image: buffer,
              mask: activeMaskBuffer,
              model: preset.replicateModel,
              prompt: `${fullPrompt} Remove ONLY the furniture inside the masked area. Do not restage, replace, recolor, or reshape furniture. Keep walls, floors, windows, lighting, and room geometry unchanged. If the task cannot be completed safely, return the original image unchanged.`,
              strength: refinementPass === 0 ? 0.28 : 0.26,
              outputCount: 1,
              guidanceScale: refinementPass === 0 ? 10 : 9.8,
              numInferenceSteps: refinementPass === 0 ? 32 : 28,
              scheduler: preset.scheduler,
              negativePrompt: preset.negativePrompt,
              seed: Math.floor(Math.random() * 1_000_000_000),
            });
            if (!refinementOutputs.length) {
              break;
            }

            output = refinementOutputs[0];
            buffer = await convertReplicateOutputToBuffer(output);
            visualChangeRatio = await calculateVisualChangeRatio(stored.buffer, buffer);
            focusRegionChangeRatio = await calculateVisualChangeRatio(stored.buffer, buffer, {
              region: activeEvaluationRegion,
            });
            job.attemptCount = attemptNumber;
            job.currentStage = stage;
            attemptLog.push({
              attempt: attemptNumber,
              stage,
              maskType: useSplitMask ? `split_region_${splitMaskIndex}` : 'full_mask',
              strength: refinementPass === 0 ? 0.28 : 0.26,
              guidanceScale: refinementPass === 0 ? 10 : 9.8,
              outputCount: 1,
              focusRegionChangeRatio,
            });
            refinementPass += 1;
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
        const topHalfChangeRatio = await calculateVisualChangeRatio(stored.buffer, buffer, {
          region: evaluationRegions.structureRegion,
        });
        const structureHistogramDrift = await calculateHistogramDrift(stored.buffer, buffer, {
          region: evaluationRegions.structureRegion,
        });
        const sourceFocusEdgeDensity =
          preset.key === 'remove_furniture'
            ? await calculateEdgeDensity(stored.buffer, {
                region: activeEvaluationRegion,
              })
            : null;
        const variantFocusEdgeDensity =
          preset.key === 'remove_furniture'
            ? await calculateEdgeDensity(buffer, {
                region: activeEvaluationRegion,
              })
            : null;
        const focusEdgeDensityDelta =
          preset.key === 'remove_furniture'
            ? Number((variantFocusEdgeDensity - sourceFocusEdgeDensity).toFixed(4))
            : null;
        let overallScore = calculateVisionReviewOverallScore(review);
        let rejectForArchitecturalDrift = false;
        let qualityWarning = '';

        if (preset.key === 'remove_furniture') {
          if (visualChangeRatio < 0.1) {
            overallScore = Math.max(0, overallScore - 16);
          }
          if (focusRegionChangeRatio < 0.1) {
            overallScore = Math.max(0, overallScore - 18);
          }
          if (focusEdgeDensityDelta > -0.002) {
            overallScore = Math.max(0, overallScore - 14);
          }
          if (topHalfChangeRatio > 0.12) {
            overallScore = Math.max(0, overallScore - 20);
          }
          if (visualChangeRatio > 0.7) {
            overallScore = Math.max(0, overallScore - 24);
          }
          if (structureHistogramDrift > 0.5) {
            overallScore = Math.max(0, overallScore - 22);
          }
          if (focusRegionChangeRatio < 0.08) {
            rejectForArchitecturalDrift = true;
            qualityWarning = 'Rejected variant due to insufficient furniture removal in the target region.';
          }
          if (focusRegionChangeRatio < 0.14 && focusEdgeDensityDelta > -0.003) {
            rejectForArchitecturalDrift = true;
            qualityWarning =
              'Rejected variant due to furniture persistence (visual restyle without meaningful subtraction).';
          }
          if (topHalfChangeRatio > 0.16) {
            rejectForArchitecturalDrift = true;
            qualityWarning = 'Rejected variant due to likely structural drift in upper architecture.';
          }
          if (visualChangeRatio > 0.78) {
            rejectForArchitecturalDrift = true;
            qualityWarning = 'Rejected variant due to scene-identity drift (room appears replaced).';
          }
          if (structureHistogramDrift > 0.58) {
            rejectForArchitecturalDrift = true;
            qualityWarning = 'Rejected variant due to scene-identity drift in upper structure region.';
          }
        }

        if (preset.key.startsWith('floor_')) {
          if (visualChangeRatio < 0.14) {
            overallScore = Math.max(0, overallScore - 20);
          }
          if (topHalfChangeRatio > 0.09) {
            overallScore = Math.max(0, overallScore - 20);
          }
          if (topHalfChangeRatio > 0.14) {
            rejectForArchitecturalDrift = true;
            qualityWarning = 'Rejected variant due to likely structural drift outside floor regions.';
          }
        }

        if (rejectForArchitecturalDrift) {
          rejectedCandidates.push({
            index,
            output,
            buffer,
            review,
            overallScore,
            visualChangeRatio,
            focusRegionChangeRatio,
            focusEdgeDensityDelta,
            topHalfChangeRatio,
            structureHistogramDrift,
            rejectReason: qualityWarning,
            roomPromptAddon,
            presetPromptAddon,
          });
          continue;
        }

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
          ...buildVariantLifecycleFields({ isSelected: false }),
          useInBrochure: false,
          useInReport: false,
          metadata: {
            warning: qualityWarning || renderPlan.warning,
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
            upgradeTier: preset.upgradeTier,
            category: preset.category,
            disclaimerType: preset.disclaimerType,
            roomPromptAddon,
            presetPromptAddon,
            mode: requestedMode,
            instructions: normalizedInstructions,
            normalizedPlan,
            maskStrategy:
              preset.key === 'remove_furniture'
                ? 'shape_plus_component_aware_furniture_segmentation'
                : 'shape_mask',
            providerSourceUrl: getProviderSourceUrl(output),
            review: {
              ...review,
              overallScore,
              visualChangeRatio,
              focusRegionChangeRatio,
              focusEdgeDensityDelta,
              sourceFocusEdgeDensity,
              variantFocusEdgeDensity,
              topHalfChangeRatio,
              structureHistogramDrift,
            },
          },
        });

        createdVariants.push(serializeMediaVariant(variant.toObject()));
      }

      if (!createdVariants.length) {
        if (preset.key === 'remove_furniture' && rejectedCandidates.length) {
          if (splitMaskBuffers.length && maskRegionAnalysis?.regions?.length) {
            let segmentedBuffer = stored.buffer;
            let segmentedSuccessCount = 0;
            const segmentedRegionLimit = Math.min(2, splitMaskBuffers.length, maskRegionAnalysis.regions.length);
            for (let splitIndex = 0; splitIndex < segmentedRegionLimit; splitIndex += 1) {
              const splitOutputs = await runReplicateInpainting({
                image: segmentedBuffer,
                mask: splitMaskBuffers[splitIndex],
                model: preset.replicateModel,
                prompt: `${fullPrompt} Remove only the isolated furniture object(s) inside this mask. Do not restage or replace removed furniture. Keep all architecture, windows, walls, and room identity unchanged.`,
                strength: 0.52,
                outputCount: 1,
                guidanceScale: 9.8,
                numInferenceSteps: (preset.numInferenceSteps || 40) + 10,
                scheduler: preset.scheduler,
                negativePrompt: preset.negativePrompt,
                seed: Math.floor(Math.random() * 1_000_000_000),
              });
              if (!splitOutputs.length) {
                continue;
              }
              const splitCandidateBuffer = await convertReplicateOutputToBuffer(splitOutputs[0]);
              const splitRegion = maskRegionAnalysis.regions[splitIndex];
              const normalizedRegion = {
                left: splitRegion.x / maskRegionAnalysis.width,
                top: splitRegion.y / maskRegionAnalysis.height,
                width: splitRegion.width / maskRegionAnalysis.width,
                height: splitRegion.height / maskRegionAnalysis.height,
              };
              const localRegionChangeRatio = await calculateVisualChangeRatio(
                segmentedBuffer,
                splitCandidateBuffer,
                { region: normalizedRegion },
              );
              const splitTopHalfChangeRatio = await calculateVisualChangeRatio(
                segmentedBuffer,
                splitCandidateBuffer,
                { region: evaluationRegions.structureRegion },
              );
              const splitSourceEdgeDensity = await calculateEdgeDensity(segmentedBuffer, {
                region: normalizedRegion,
              });
              const splitVariantEdgeDensity = await calculateEdgeDensity(splitCandidateBuffer, {
                region: normalizedRegion,
              });
              const splitEdgeDensityDelta = Number(
                (splitVariantEdgeDensity - splitSourceEdgeDensity).toFixed(4),
              );
              const splitStructureHistogramDrift = await calculateHistogramDrift(
                segmentedBuffer,
                splitCandidateBuffer,
                { region: evaluationRegions.structureRegion },
              );
              const splitAttemptNumber = Math.min(4, job.attemptCount + 1);
              attemptLog.push({
                attempt: splitAttemptNumber,
                stage: 'split_retry',
                maskType: `split_region_${splitIndex}`,
                strength: 0.52,
                guidanceScale: 9.8,
                outputCount: 1,
                localRegionChangeRatio,
                splitEdgeDensityDelta,
                splitTopHalfChangeRatio,
                splitStructureHistogramDrift,
              });
              job.attemptCount = splitAttemptNumber;
              job.currentStage = 'split_retry';

              if (
                localRegionChangeRatio >= 0.08 &&
                (splitEdgeDensityDelta <= -0.003 || localRegionChangeRatio >= 0.14) &&
                splitTopHalfChangeRatio <= 0.16 &&
                splitStructureHistogramDrift <= 0.58
              ) {
                segmentedBuffer = splitCandidateBuffer;
                segmentedSuccessCount += 1;
              }
            }

            if (segmentedSuccessCount > 0) {
              const saved = await saveBinaryBuffer({
                propertyId: asset.propertyId.toString(),
                mimeType: 'image/jpeg',
                buffer: segmentedBuffer,
              });
              const segmentedVariant = await MediaVariantModel.create({
                visionJobId: job._id,
                mediaId: asset._id,
                propertyId: asset.propertyId,
                variantType: preset.key,
                variantCategory: preset.category,
                label: `${renderPlan.label} Partial Success`,
                mimeType: 'image/jpeg',
                storageProvider: saved.storageProvider,
                storageKey: saved.storageKey,
                byteSize: saved.byteSize,
                isSelected: false,
                ...buildVariantLifecycleFields({ isSelected: false }),
                useInBrochure: false,
                useInReport: false,
                metadata: {
                  warning:
                    'We safely removed some isolated furniture, but additional objects may need separate passes.',
                  summary: renderPlan.summary,
                  differenceHint:
                    'This split-pass result prioritizes structural safety while removing isolated furniture clusters.',
                  effects: [...(renderPlan.effects || []), 'Split-pass partial success'],
                  sourceAssetId: asset._id.toString(),
                  roomLabel: asset.roomLabel,
                  roomType: resolvedRoomType,
                  provider: 'replicate',
                  presetKey: preset.key,
                  promptVersion: preset.promptVersion,
                  helperText: preset.helperText,
                  recommendedUse: preset.recommendedUse,
                  upgradeTier: preset.upgradeTier,
                  category: preset.category,
                  disclaimerType: preset.disclaimerType,
                  mode: requestedMode,
                  instructions: normalizedInstructions,
                  normalizedPlan,
                  maskStrategy: 'split_component_regions',
                  fallbackMode: 'partial_success',
                  review: {
                    segmentedSuccessCount,
                    segmentedPassApplied: true,
                  },
                },
              });
              createdVariants.push(serializeMediaVariant(segmentedVariant.toObject()));
              job.fallbackMode = 'partial_success';
              job.currentStage = 'fallback';
            }
          }

          if (createdVariants.length) {
            // Split-pass recovery succeeded; skip broader fallback selection.
          } else {
          const conservativeCandidate = [...rejectedCandidates]
            .filter(
              (candidate) =>
                candidate.topHalfChangeRatio <= 0.16 &&
                candidate.structureHistogramDrift <= 0.58 &&
                candidate.focusRegionChangeRatio >= 0.12 &&
                candidate.visualChangeRatio >= 0.24 &&
                candidate.focusEdgeDensityDelta <= -0.003,
            )
            .sort((left, right) => {
              if (left.structureHistogramDrift !== right.structureHistogramDrift) {
                return left.structureHistogramDrift - right.structureHistogramDrift;
              }
              if (left.topHalfChangeRatio !== right.topHalfChangeRatio) {
                return left.topHalfChangeRatio - right.topHalfChangeRatio;
              }
              return right.focusRegionChangeRatio - left.focusRegionChangeRatio;
            })[0];

          if (conservativeCandidate) {
            const saved = await saveBinaryBuffer({
              propertyId: asset.propertyId.toString(),
              mimeType: 'image/jpeg',
              buffer: conservativeCandidate.buffer,
            });

            const conservativeVariant = await MediaVariantModel.create({
              visionJobId: job._id,
              mediaId: asset._id,
              propertyId: asset.propertyId,
              variantType: preset.key,
              variantCategory: preset.category,
              label: `${renderPlan.label} Partial Success`,
              mimeType: 'image/jpeg',
              storageProvider: saved.storageProvider,
              storageKey: saved.storageKey,
              byteSize: saved.byteSize,
              isSelected: false,
              ...buildVariantLifecycleFields({ isSelected: false }),
              useInBrochure: false,
              useInReport: false,
              metadata: {
                warning:
                  'We safely improved part of the room. Additional objects may need separate edits.',
                summary: renderPlan.summary,
                differenceHint:
                  'This fallback preserves room identity but may leave some furniture in place.',
                effects: [...(renderPlan.effects || []), 'Partial success fallback'],
                sourceAssetId: asset._id.toString(),
                roomLabel: asset.roomLabel,
                roomType: resolvedRoomType,
                provider: 'replicate',
                presetKey: preset.key,
                promptVersion: preset.promptVersion,
                helperText: preset.helperText,
                recommendedUse: preset.recommendedUse,
                upgradeTier: preset.upgradeTier,
                category: preset.category,
                disclaimerType: preset.disclaimerType,
                roomPromptAddon: conservativeCandidate.roomPromptAddon,
                presetPromptAddon: conservativeCandidate.presetPromptAddon,
                mode: requestedMode,
                instructions: normalizedInstructions,
                normalizedPlan,
                maskStrategy: 'shape_plus_component_aware_furniture_segmentation',
                fallbackMode: 'partial_success',
                providerSourceUrl: getProviderSourceUrl(conservativeCandidate.output),
                review: {
                  ...conservativeCandidate.review,
                  overallScore: Math.max(0, conservativeCandidate.overallScore - 8),
                  visualChangeRatio: conservativeCandidate.visualChangeRatio,
                  focusRegionChangeRatio: conservativeCandidate.focusRegionChangeRatio,
                  topHalfChangeRatio: conservativeCandidate.topHalfChangeRatio,
                  structureHistogramDrift: conservativeCandidate.structureHistogramDrift,
                  conservativeFallbackApplied: true,
                },
              },
            });

            createdVariants.push(serializeMediaVariant(conservativeVariant.toObject()));
            job.fallbackMode = 'partial_success';
            job.currentStage = 'fallback';
          } else {
            const sawSceneReplacement =
              rejectedCandidates.some((candidate) =>
                String(candidate?.rejectReason || '').toLowerCase().includes('scene-identity drift'),
              ) || rejectedCandidates.some((candidate) => candidate.structureHistogramDrift > 0.5);

            if (sawSceneReplacement) {
              job.status = 'needs_user_action';
              job.currentStage = 'guided_selection';
              job.fallbackMode = 'guided_selection';
              job.failureReason = 'scene_replacement_risk';
              job.message =
                'Full furniture removal was unsafe for this photo angle. Try selecting one isolated furniture group first.';
              job.warning =
                'Scene replacement risk detected. Guided selection is recommended for safer removal.';
              job.input = {
                ...(job.input || {}),
                attemptLog,
                maskRegionAnalysis,
              };
              await job.save();
              return {
                cached: false,
                preset,
                job: serializeImageJob(job.toObject(), []),
                variants: [],
                variant: null,
              };
            } else {
              job.status = 'needs_user_action';
              job.currentStage = 'guided_selection';
              job.fallbackMode = 'guided_selection';
              job.failureReason = 'structural_drift';
              job.message =
                'This room is complex for full furniture removal. Try selecting individual items for better results.';
              job.warning = 'Broad structural drift detected during furniture-removal attempts.';
              job.input = {
                ...(job.input || {}),
                attemptLog,
                maskRegionAnalysis,
              };
              await job.save();
              return {
                cached: false,
                preset,
                job: serializeImageJob(job.toObject(), []),
                variants: [],
                variant: null,
              };
            }
          }
          }
        } else if (rejectedCandidates.length) {
          const fallbackCandidate = [...rejectedCandidates]
            .sort((left, right) => {
              if (preset.key === 'remove_furniture') {
                if (left.focusRegionChangeRatio !== right.focusRegionChangeRatio) {
                  return right.focusRegionChangeRatio - left.focusRegionChangeRatio;
                }
              }
              if (left.topHalfChangeRatio !== right.topHalfChangeRatio) {
                return left.topHalfChangeRatio - right.topHalfChangeRatio;
              }
              return right.visualChangeRatio - left.visualChangeRatio;
            })[0];

          const saved = await saveBinaryBuffer({
            propertyId: asset.propertyId.toString(),
            mimeType: 'image/jpeg',
            buffer: fallbackCandidate.buffer,
          });

          const fallbackVariant = await MediaVariantModel.create({
            visionJobId: job._id,
            mediaId: asset._id,
            propertyId: asset.propertyId,
            variantType: preset.key,
            variantCategory: preset.category,
            label: `${renderPlan.label} Fallback`,
            mimeType: 'image/jpeg',
            storageProvider: saved.storageProvider,
            storageKey: saved.storageKey,
            byteSize: saved.byteSize,
            isSelected: false,
            ...buildVariantLifecycleFields({ isSelected: false }),
            useInBrochure: false,
            useInReport: false,
            metadata: {
              warning:
                'Low-confidence fallback: most generated variants were rejected for structural drift. Review before any public use.',
              summary: renderPlan.summary,
              differenceHint: renderPlan.differenceHint,
              effects: [...(renderPlan.effects || []), 'Low-confidence fallback'],
              sourceAssetId: asset._id.toString(),
              roomLabel: asset.roomLabel,
              roomType: resolvedRoomType,
              provider: 'replicate',
              presetKey: preset.key,
              promptVersion: preset.promptVersion,
              helperText: preset.helperText,
              recommendedUse: preset.recommendedUse,
              upgradeTier: preset.upgradeTier,
              category: preset.category,
              disclaimerType: preset.disclaimerType,
              roomPromptAddon: fallbackCandidate.roomPromptAddon,
              presetPromptAddon: fallbackCandidate.presetPromptAddon,
              mode: requestedMode,
              instructions: normalizedInstructions,
              normalizedPlan,
              maskStrategy:
                preset.key === 'remove_furniture'
                  ? 'shape_plus_component_aware_furniture_segmentation'
                  : 'shape_mask',
              providerSourceUrl: getProviderSourceUrl(fallbackCandidate.output),
              review: {
                ...fallbackCandidate.review,
                overallScore: Math.max(0, fallbackCandidate.overallScore - 12),
                visualChangeRatio: fallbackCandidate.visualChangeRatio,
                focusRegionChangeRatio: fallbackCandidate.focusRegionChangeRatio,
                topHalfChangeRatio: fallbackCandidate.topHalfChangeRatio,
                structureHistogramDrift: fallbackCandidate.structureHistogramDrift,
                fallbackApplied: true,
              },
            },
          });

          createdVariants.push(serializeMediaVariant(fallbackVariant.toObject()));
        } else {
          throw new Error(
            'Generated variants failed quality safeguards due to heavy structural drift. Please retry with a different source photo angle or a narrower transformation request.',
          );
        }
      }
      job.input = {
        ...(job.input || {}),
        attemptLog,
        maskRegionAnalysis,
      };
      }
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
        ...buildVariantLifecycleFields({ isSelected: false }),
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
          upgradeTier: preset.upgradeTier,
          category: preset.category,
          disclaimerType: preset.disclaimerType,
          roomPromptAddon: rendered.roomPromptAddon,
          mode: requestedMode,
          instructions: normalizedInstructions,
          normalizedPlan,
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
    if (!job.attemptCount) {
      job.attemptCount = 1;
    }
    job.currentStage = job.fallbackMode ? 'fallback' : 'completed';
    const usedFallbackVariant = createdVariants.some(
      (variant) =>
        Boolean(
          variant?.metadata?.review?.fallbackApplied ||
            variant?.metadata?.review?.conservativeFallbackApplied ||
            variant?.metadata?.fallbackMode,
        ),
    );
    job.outputVariantIds = createdVariants.map((variant) => variant.id);
    job.selectedVariantId = createdVariants[0]?.id || null;
    if (usedFallbackVariant) {
      if (job.fallbackMode === 'declutter_lite') {
        job.warning =
          'Full furniture removal was not reliable for this room. A lighter declutter enhancement was applied.';
      } else if (job.fallbackMode === 'partial_success') {
        job.warning =
          'Partial success fallback returned. Additional objects may need separate edits.';
      } else {
        job.warning =
          'Fallback variant returned. Strict furniture-removal or drift safeguards rejected most candidates.';
      }
    } else {
      job.warning = renderPlan.warning;
    }
    job.message =
      requestedMode === 'freeform'
        ? 'Custom enhancement request saved and processed.'
        : `${createdVariants.length} ${renderPlan.label.toLowerCase()} variant${createdVariants.length === 1 ? '' : 's'} generated.`;
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
    job.currentStage = job.currentStage || 'initial';
    job.message = 'Image variant generation failed.';
    job.warning = error.message;
    job.failureReason = error.message;
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
