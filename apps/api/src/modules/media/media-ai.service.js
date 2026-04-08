import { createHash } from 'node:crypto';

import mongoose from 'mongoose';
import sharp from 'sharp';

import { buildMediaVariantUrl, readStoredAsset, saveBinaryBuffer } from '../../services/storageService.js';
import { reviewVisionVariant } from '../../services/photoAnalysisService.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import { runReplicateInpainting } from './replicate-provider.service.js';
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

async function calculateVisualChangeRatio(sourceBuffer, variantBuffer) {
  const width = 256;
  const height = 256;
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

  const pixelCount = width * height;
  let changedPixels = 0;
  for (let offset = 0; offset < src.length; offset += 3) {
    const delta =
      (Math.abs(src[offset] - next[offset]) +
        Math.abs(src[offset + 1] - next[offset + 1]) +
        Math.abs(src[offset + 2] - next[offset + 2])) /
      3;
    if (delta >= 18) {
      changedPixels += 1;
    }
  }

  return Number((changedPixels / pixelCount).toFixed(4));
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
    return [
      {
        type: 'rect',
        left: Math.round(width * 0.08),
        top: Math.round(height * 0.14),
        width: Math.round(width * 0.84),
        height: Math.round(height * 0.76),
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
        scheduler: preset.scheduler,
        negativePrompt: preset.negativePrompt,
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
          const visualChangeRatio = await calculateVisualChangeRatio(stored.buffer, buffer);
          let overallScore = calculateVisionReviewOverallScore(review);
          if (
            (preset.key === 'remove_furniture' && visualChangeRatio < 0.2) ||
            (preset.key.startsWith('floor_') && visualChangeRatio < 0.12)
          ) {
            overallScore = Math.max(0, overallScore - 18);
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
              upgradeTier: preset.upgradeTier,
              category: preset.category,
              disclaimerType: preset.disclaimerType,
              roomPromptAddon,
              presetPromptAddon,
              mode: requestedMode,
              instructions: normalizedInstructions,
              normalizedPlan,
              providerSourceUrl: getProviderSourceUrl(output),
              review: {
                ...review,
                overallScore,
                visualChangeRatio,
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
    job.outputVariantIds = createdVariants.map((variant) => variant.id);
    job.selectedVariantId = createdVariants[0]?.id || null;
    job.warning = renderPlan.warning;
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
