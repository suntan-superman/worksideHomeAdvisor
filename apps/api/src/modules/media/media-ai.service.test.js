import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import {
  analyzeVisionScene,
  bridgeVerticalMaskGaps,
  buildFirstImpressionRecommendations,
  buildBrightWindowExclusionMask,
  buildFreeformEnhancementPlan,
  buildWindowRejectionMask,
  calculateVisionReviewOverallScore,
  classifyListingReadiness,
  enforceVerticalWindowColumns,
  getTaskSpecificMaskStrategy,
  normalizeRoomType,
  planSmartEnhancements,
  resolveSurfaceMaskAtSourceSize,
  resolveFreeformPresetKey,
  segmentWallPlanesAtSourceSize,
  selectViableWallMaskStage,
  shouldSkipPaintGeneration,
} from './media-ai.service.js';
import {
  buildProviderChain,
  calculatePerceptibilityScore,
  evaluatePaintStrength,
  getReplicateSettings,
  isCandidateSufficient,
  isUsablePaintStrength,
  PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY,
  rankCandidates,
  resolveVisionUserPlan,
  scorePaintCandidate,
} from './vision-orchestrator.helpers.js';
import { orchestrateVisionJob } from './vision-orchestrator.service.js';
import { resolveVisionPreset } from './vision-presets.js';

test('normalizeRoomType maps common room labels to canonical room types', () => {
  assert.equal(normalizeRoomType('Living Room'), 'living_room');
  assert.equal(normalizeRoomType('Primary Bedroom'), 'bedroom');
  assert.equal(normalizeRoomType('Front Exterior'), 'exterior');
});

test('task specific mask strategy uses adaptive masks for wall and floor presets', () => {
  assert.equal(getTaskSpecificMaskStrategy('paint_bright_white'), 'adaptive_wall');
  assert.equal(getTaskSpecificMaskStrategy('floor_tile_stone'), 'adaptive_floor');
  assert.equal(getTaskSpecificMaskStrategy('remove_furniture'), 'generic');
});

async function createSyntheticLivingRoomBuffer() {
  const width = 96;
  const height = 72;
  const raw = Buffer.alloc(width * height * 3);

  function setPixel(x, y, red, green, blue) {
    const offset = (y * width + x) * 3;
    raw[offset] = red;
    raw[offset + 1] = green;
    raw[offset + 2] = blue;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 214;
      let green = 212;
      let blue = 206;

      if (y >= 52) {
        red = 60;
        green = 38;
        blue = 28;
      }

      if (x <= 9 && y < 58) {
        red = 186;
        green = 184;
        blue = 178;
      }

      const inLeftWindow = x >= 18 && x <= 36 && y >= 12 && y <= 45;
      const inCenterWindow = x >= 42 && x <= 58 && y >= 12 && y <= 45;
      const inRightWindow = x >= 64 && x <= 84 && y >= 12 && y <= 45;
      if (inLeftWindow || inCenterWindow || inRightWindow) {
        const stripe = y % 4 === 0 || y % 4 === 1;
        red = stripe ? 242 : 208;
        green = stripe ? 244 : 214;
        blue = stripe ? 245 : 220;
      }

      if (y <= 6) {
        red = 188;
        green = 186;
        blue = 180;
      }

      setPixel(x, y, red, green, blue);
    }
  }

  return sharp(raw, {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toBuffer();
}

function createSyntheticProbeBuffer(width, height, pixelFn) {
  const buffer = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = pixelFn(x, y);
      const offset = (y * width + x) * 3;
      buffer[offset] = red;
      buffer[offset + 1] = green;
      buffer[offset + 2] = blue;
    }
  }

  return buffer;
}

test('semantic wall segmentation returns non-zero wall coverage for a living room', async () => {
  const sourceBuffer = await createSyntheticLivingRoomBuffer();
  const result = await segmentWallPlanesAtSourceSize(
    sourceBuffer,
    'living_room',
    'paint_warm_neutral',
  );

  assert.equal(result.debug.strategy, 'semantic_wall');
  assert.ok(result.debug.coverageRatio > 0.04);
  assert.ok(result.debug.rawCoverageRatio >= result.debug.coverageRatio);
  assert.ok(result.debug.refinementStages.length >= 5);
});

test('semantic wall segmentation excludes bright window regions', async () => {
  const sourceBuffer = await createSyntheticLivingRoomBuffer();
  const result = await segmentWallPlanesAtSourceSize(
    sourceBuffer,
    'living_room',
    'paint_warm_neutral',
  );
  const maskRaw = await sharp(result.wallMaskBuffer).removeAlpha().greyscale().raw().toBuffer();
  const width = result.width;

  const centerWindowMaskValue = maskRaw[28 * width + 50];
  const retainedPixelCount = [...maskRaw].filter((value) => value > 0).length;

  assert.ok(centerWindowMaskValue < 100);
  assert.ok(retainedPixelCount > 0);
});

test('wall presets prefer semantic wall segmentation before adaptive fallback', async () => {
  const sourceBuffer = await createSyntheticLivingRoomBuffer();
  const result = await resolveSurfaceMaskAtSourceSize(
    sourceBuffer,
    'paint_warm_neutral',
    'living_room',
  );

  assert.equal(result.debug?.strategy, 'adaptive_wall');
});

test('window rejection identifies bright structured window interiors', () => {
  const width = 20;
  const height = 20;
  const sourceProbe = createSyntheticProbeBuffer(width, height, (x, y) => {
    if (x >= 6 && x <= 13 && y >= 4 && y <= 16) {
      return [(x + y) % 2 === 0 ? 245 : 214, (x + y) % 2 === 0 ? 246 : 216, 248];
    }
    return [198, 196, 190];
  });

  const result = buildWindowRejectionMask({
    sourceProbe,
    width,
    height,
    startY: 2,
    endY: 18,
  });

  assert.equal(result.binaryMask[10 * width + 10], 1);
  assert.ok(result.debug.coverageRatio > 0.05);
});

test('window rejection suppresses blind-like stripe regions', () => {
  const width = 24;
  const height = 18;
  const sourceProbe = createSyntheticProbeBuffer(width, height, (x, y) => {
    if (x >= 7 && x <= 16 && y >= 3 && y <= 15) {
      const brightStripe = x % 2 === 0;
      return brightStripe ? [232, 234, 236] : [186, 188, 190];
    }
    return [192, 191, 187];
  });

  const result = buildWindowRejectionMask({
    sourceProbe,
    width,
    height,
    startY: 2,
    endY: 16,
  });

  assert.equal(result.binaryMask[9 * width + 10], 1);
});

test('window rejection expands stable bay-window columns after seeding', () => {
  const width = 10;
  const height = 12;
  const seeded = new Uint8Array(width * height);

  for (let y = 2; y <= 5; y += 1) {
    seeded[y * width + 4] = 1;
  }

  const expanded = enforceVerticalWindowColumns(seeded, width, height, {
    startY: 1,
    endY: 9,
    minColumnCoverageRatio: 0.18,
  });

  assert.equal(expanded[8 * width + 4], 1);
  assert.equal(expanded[8 * width + 3], 0);
});

test('window rejection does not remove smooth wall surfaces', () => {
  const width = 20;
  const height = 20;
  const sourceProbe = createSyntheticProbeBuffer(width, height, () => [202, 200, 194]);

  const result = buildWindowRejectionMask({
    sourceProbe,
    width,
    height,
    startY: 2,
    endY: 18,
  });

  assert.ok(result.debug.coverageRatio < 0.02);
});

test('bridgeVerticalMaskGaps fills short gaps in stable wall columns', () => {
  const width = 4;
  const height = 8;
  const binary = new Uint8Array([
    0, 0, 0, 0,
    0, 1, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 0,
    0, 1, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]);

  const bridged = bridgeVerticalMaskGaps(binary, width, height, {
    startY: 1,
    endY: 5,
    maxGap: 2,
    minColumnCoverageRatio: 0.6,
  });

  assert.equal(bridged[3 * width + 1], 1);
});

test('buildBrightWindowExclusionMask isolates tall bright textured window regions', () => {
  const width = 12;
  const height = 12;
  const luminance = new Float32Array(width * height).fill(150);
  const texture = new Float32Array(width * height).fill(3);

  for (let y = 1; y <= 10; y += 1) {
    for (let x = 3; x <= 8; x += 1) {
      const index = y * width + x;
      luminance[index] = 228;
      texture[index] = 12;
    }
  }

  const exclusion = buildBrightWindowExclusionMask(luminance, texture, width, height, {
    startY: 1,
    endY: 10,
  });

  assert.equal(exclusion[5 * width + 5], 1);
  assert.equal(exclusion[5 * width + 1], 0);
});

test('selectViableWallMaskStage prefers refined wall stages over broad fallback geometry', () => {
  const selected = selectViableWallMaskStage([
    { stage: 'initial_geometry_seed', coverageRatio: 0.5 },
    { stage: 'after_window_suppression', coverageRatio: 0.24 },
    { stage: 'after_component_filter', coverageRatio: 0.21 },
    { stage: 'hard_geometric_fallback', coverageRatio: 0.61 },
  ]);

  assert.equal(selected?.stage, 'after_component_filter');
});

test('buildFreeformEnhancementPlan extracts floor, wall, and lighting intent', () => {
  const plan = buildFreeformEnhancementPlan(
    'Please remove furniture, change flooring to dark hardwood, change walls to warm white, and brighten the room.',
    'Living room',
  );

  assert.deepEqual(plan.removeObjects, ['furniture']);
  assert.deepEqual(plan.styleChanges, ['brighter lighting']);
  assert.equal(plan.roomType, 'living_room');
  assert.equal(plan.flooring, 'dark hardwood');
  assert.equal(plan.wallColor, 'warm white');
  assert.equal(plan.lighting, 'brighter');
});

test('buildFreeformEnhancementPlan extracts kitchen and exterior concept intent', () => {
  const kitchenPlan = buildFreeformEnhancementPlan(
    'Please paint cabinets sage green with quartz countertops and brighten the kitchen.',
    'Kitchen',
  );
  const exteriorPlan = buildFreeformEnhancementPlan(
    'Refresh the backyard with plants, fixtures, and a pool.',
    'Backyard',
  );

  assert.equal(kitchenPlan.cabinetColor, 'sage green');
  assert.equal(kitchenPlan.countertopMaterial, 'quartz');
  assert.equal(kitchenPlan.roomType, 'kitchen');
  assert.deepEqual(exteriorPlan.exteriorFeatures, ['plants', 'fixtures', 'pool']);
  assert.equal(exteriorPlan.exteriorZone, 'backyard');
  assert.equal(exteriorPlan.roomType, 'exterior');
});

test('buildFreeformEnhancementPlan understands stronger wall-surface phrasing for bold paint requests', () => {
  const plan = buildFreeformEnhancementPlan(
    'Repaint all visible wall surfaces in a deep, rich dark green color. The change must be immediately noticeable at first glance.',
    'Living room',
  );

  assert.equal(plan.roomType, 'living_room');
  assert.equal(plan.wallColor, 'deep rich dark green');
});

test('analyzeVisionScene derives first-impression signals from a bright windowed living room', async () => {
  const sourceBuffer = await createSyntheticLivingRoomBuffer();
  const scene = await analyzeVisionScene(sourceBuffer, 'living_room');

  assert.equal(scene.roomType, 'living_room');
  assert.ok(scene.brightnessScore > 0.4);
  assert.ok(scene.windowCoverage > 0.15);
  assert.ok(scene.wallVisibility > 0.05);
  assert.match(scene.wallToneEstimate, /light|neutral|dark/);
});

test('buildFirstImpressionRecommendations prioritizes clutter, lighting, and wall tone guidance', () => {
  const recommendations = buildFirstImpressionRecommendations({
    clutterScore: 0.7,
    brightnessScore: 0.42,
    lightingQuality: 0.48,
    wallToneEstimate: 'dark',
    windowCoverage: 0.2,
    furnitureDensity: 0.5,
  });

  assert.equal(recommendations.length, 3);
  assert.match(recommendations[0], /clutter/i);
  assert.ok(recommendations.some((item) => /brighten|lighting/i.test(item)));
  assert.ok(recommendations.some((item) => /lighter wall tones/i.test(item)));
});

test('planSmartEnhancements favors declutter and lighting before wall color exploration', () => {
  const plan = planSmartEnhancements({
    roomType: 'living_room',
    clutterLevel: 0.72,
    lightingQuality: 0.45,
    furnitureDensity: 0.22,
    wallVisibility: 0.58,
    windowCoverage: 0.24,
  });

  assert.deepEqual(plan, [
    'declutter',
    'lighting_boost',
    'light_staging',
    'wall_color_test',
  ]);
});

test('classifyListingReadiness returns listing-ready badge for strong clean outputs', () => {
  const result = classifyListingReadiness({
    review: {
      structuralIntegrityScore: 92,
      artifactScore: 88,
      listingAppealScore: 90,
    },
    outsideMaskChangeRatio: 0.04,
  });

  assert.equal(result.label, 'Near Ready');
  assert.equal(result.confidenceBadge, 'Safe Enhancement');
  assert.ok(result.score >= 70);
});

test('resolveFreeformPresetKey routes advanced concept requests to the closest preset', () => {
  assert.equal(
    resolveFreeformPresetKey({
      normalizedPlan: {
        roomType: 'living_room',
        removeObjects: [],
        flooring: 'dark hardwood',
      },
    }),
    'floor_dark_hardwood',
  );
  assert.equal(
    resolveFreeformPresetKey({
      normalizedPlan: {
        roomType: 'kitchen',
        removeObjects: [],
        cabinetColor: 'sage green',
        countertopMaterial: 'quartz',
      },
    }),
    'kitchen_green_cabinets_quartz',
  );
  assert.equal(
    resolveFreeformPresetKey({
      normalizedPlan: {
        roomType: 'exterior',
        removeObjects: [],
        exteriorZone: 'backyard',
        exteriorFeatures: ['plants', 'pool'],
      },
    }),
    'backyard_pool_preview',
  );
  assert.equal(
    resolveFreeformPresetKey({
      jobType: 'enhance_listing_quality',
      normalizedPlan: {
        roomType: 'living_room',
        removeObjects: [],
        wallColor: 'deep rich dark green',
      },
    }),
    'paint_dark_charcoal_test',
  );
});

test('calculateVisionReviewOverallScore blends review signals into a rounded overall score', () => {
  const score = calculateVisionReviewOverallScore({
    structuralIntegrityScore: 92,
    artifactScore: 84,
    listingAppealScore: 78,
  });

  assert.equal(score, 86);
});

test('resolveVisionUserPlan treats remove_furniture as premium by default', () => {
  assert.equal(
    resolveVisionUserPlan({
      preset: {
        key: 'remove_furniture',
        category: 'concept_preview',
        upgradeTier: 'premium',
      },
    }),
    'premium',
  );
});

test('buildProviderChain includes openai_edit for premium remove_furniture when available', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: {
        key: 'remove_furniture',
        category: 'concept_preview',
        providerPreference: 'replicate',
      },
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced', 'openai_edit'],
  );
});

test('wall paint presets now use the replicate paint pipeline', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('paint_bright_white'),
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced', 'openai_edit', 'local_sharp'],
  );
});

test('calculatePerceptibilityScore weights visible wall change signals', () => {
  const score = calculatePerceptibilityScore({
    maskedChangeRatio: 0.2,
    maskedColorShiftRatio: 0.1,
    maskedLuminanceDelta: 0.05,
  });

  assert.equal(score, 0.14);
});

test('scorePaintCandidate keeps a visibly different wall repaint when spill stays controlled', () => {
  const score = scorePaintCandidate(
    {
      maskedChangeRatio: 0.45,
      maskedColorShiftRatio: 0.12,
      maskedLuminanceDelta: 0.08,
      outsideMaskChangeRatio: 0.18,
      paintStrength: { penalties: 2 },
    },
    'paint_warm_neutral',
  );

  assert.equal(score.classification, 'weak');
  assert.equal(score.shouldUse, true);
  assert.ok(score.finalScore > 0.2);
});

test('scorePaintCandidate rejects heavy-penalty no-op wall previews', () => {
  const score = scorePaintCandidate(
    {
      maskedChangeRatio: 0.4079,
      maskedColorShiftRatio: 0.0822,
      maskedLuminanceDelta: 0.0403,
      outsideMaskChangeRatio: 0.2653,
      paintStrength: { penalties: 7 },
    },
    'paint_warm_neutral',
  );

  assert.equal(score.classification, 'weak');
  assert.equal(score.shouldUse, true);
  assert.ok(score.finalScore > 0);
});

test('evaluatePaintStrength penalizes weak repaint candidates using normalized review scores', () => {
  const strength = evaluatePaintStrength({
    overallScore: 86,
    maskedChangeRatio: 0.08,
    maskedColorShiftRatio: 0.04,
    maskedLuminanceDelta: 0.03,
  });

  assert.equal(strength.penalties, 7);
  assert.equal(strength.finalScore, 1.6);
  assert.equal(strength.passes, false);
});

test('evaluatePaintStrength accepts a clearly repainted wall candidate', () => {
  const strength = evaluatePaintStrength({
    overallScore: 88,
    maskedChangeRatio: 1,
    maskedColorShiftRatio: 0.3,
    maskedLuminanceDelta: 0.3,
  });

  assert.equal(strength.penalties, 0);
  assert.equal(strength.finalScore, 8.8);
  assert.equal(strength.passes, true);
});

test('evaluatePaintStrength gives paint_warm_neutral a slightly softer near-pass floor', () => {
  const strength = evaluatePaintStrength(
    {
      overallScore: 7,
      maskedChangeRatio: 0.9902,
      maskedColorShiftRatio: 0.2584,
      maskedLuminanceDelta: 0.2556,
    },
    'paint_warm_neutral',
  );

  assert.equal(strength.minPerceptibility, PAINT_STRENGTH_MIN_USABLE_PERCEPTIBILITY);
  assert.equal(strength.minAcceptableScore, 5);
  assert.equal(strength.penalties, 0);
  assert.equal(strength.finalScore, 7);
  assert.equal(strength.passes, true);
});

test('isUsablePaintStrength accepts a clearly visible but not perfect repaint', () => {
  assert.equal(
    isUsablePaintStrength({
      finalScore: 4.2,
      perceptibilityScore: 0.29,
    }),
    true,
  );
});

test('evaluatePaintStrength derives a usable baseline when review scores are missing', () => {
  const strength = evaluatePaintStrength(
    {
      overallScore: 0,
      maskedChangeRatio: 0.42,
      focusRegionChangeRatio: 0.18,
      maskedColorShiftRatio: 0.14,
      maskedLuminanceDelta: 0.1,
      outsideMaskChangeRatio: 0.08,
    },
    'paint_warm_neutral',
  );

  assert.ok(strength.baselineScore >= 4);
  assert.equal(strength.penalties, 0);
  assert.equal(strength.passes, true);
});

test('paint_warm_neutral sufficiency preserves zero spill metrics instead of coercing them to failure', () => {
  assert.equal(
    isCandidateSufficient(
      {
        overallScore: 7,
        maskedChangeRatio: 0.9902,
        maskedColorShiftRatio: 0.2584,
        maskedLuminanceDelta: 0.2556,
        maskedEdgeDensityDelta: 0,
        topHalfChangeRatio: 0,
        outsideMaskChangeRatio: 0,
        furnitureCoverageIncreaseRatio: 0,
        newFurnitureAdditionRatio: 0,
      },
      'paint_warm_neutral',
    ),
    true,
  );
});

test('paint_warm_neutral accepts strong wall repaint candidates in window-heavy rooms', () => {
  assert.equal(
    isCandidateSufficient(
      {
        overallScore: 0,
        maskedChangeRatio: 0.8379,
        focusRegionChangeRatio: 0.5825,
        maskedColorShiftRatio: 0.1142,
        maskedLuminanceDelta: 0.0841,
        maskedEdgeDensityDelta: -0.0329,
        topHalfChangeRatio: 0.04,
        outsideMaskChangeRatio: 0.5256,
        windowCoverageRatio: 0.5648,
        windowBrightPixelRatio: 0.5401,
        windowStructuredPixelRatio: 0.2132,
        furnitureCoverageIncreaseRatio: 0,
        newFurnitureAdditionRatio: 0,
      },
      'paint_warm_neutral',
    ),
    true,
  );
});

test('paint_warm_neutral still rejects broad spill when the room is not window-heavy', () => {
  assert.equal(
    isCandidateSufficient(
      {
        overallScore: 0,
        maskedChangeRatio: 0.8379,
        focusRegionChangeRatio: 0.5825,
        maskedColorShiftRatio: 0.1142,
        maskedLuminanceDelta: 0.0841,
        maskedEdgeDensityDelta: -0.0329,
        topHalfChangeRatio: 0.04,
        outsideMaskChangeRatio: 0.5256,
        windowCoverageRatio: 0.08,
        windowBrightPixelRatio: 0.12,
        windowStructuredPixelRatio: 0.04,
        furnitureCoverageIncreaseRatio: 0,
        newFurnitureAdditionRatio: 0,
      },
      'paint_warm_neutral',
    ),
    false,
  );
});

test('paint scoring does not misclassify window-heavy wall repaints as a no-op', () => {
  const score = scorePaintCandidate(
    {
      maskedChangeRatio: 0.8379,
      maskedColorShiftRatio: 0.1142,
      maskedLuminanceDelta: 0.0841,
      outsideMaskChangeRatio: 0.5256,
      windowCoverageRatio: 0.5648,
      windowBrightPixelRatio: 0.5401,
      windowStructuredPixelRatio: 0.2132,
      paintStrength: {
        penalties: 3,
      },
    },
    'paint_warm_neutral',
  );

  assert.equal(score.shouldUse, true);
  assert.notEqual(score.classification, 'no-op');
});

test('shouldSkipPaintGeneration skips bright neutral rooms that already present well', () => {
  const decision = shouldSkipPaintGeneration({
    presetKey: 'paint_warm_neutral',
    assetAnalysis: {
      overallQualityScore: 82,
      lightingScore: 78,
      retakeRecommended: false,
    },
    roomMetrics: {
      coverageRatio: 0.26,
      meanLuminance: 0.71,
      meanSaturation: 0.08,
      colorVariance: 0.06,
      luminanceVariance: 0.07,
    },
  });

  assert.equal(decision.skip, true);
  assert.equal(decision.reason, 'room_already_neutral');
});

test('shouldSkipPaintGeneration keeps paint generation enabled for moodier or varied rooms', () => {
  const decision = shouldSkipPaintGeneration({
    presetKey: 'paint_warm_neutral',
    assetAnalysis: {
      overallQualityScore: 82,
      lightingScore: 78,
      retakeRecommended: false,
    },
    roomMetrics: {
      coverageRatio: 0.24,
      meanLuminance: 0.44,
      meanSaturation: 0.24,
      colorVariance: 0.16,
      luminanceVariance: 0.19,
    },
  });

  assert.equal(decision.skip, false);
});

test('shouldSkipPaintGeneration never skips the hard contrast paint test preset', () => {
  const decision = shouldSkipPaintGeneration({
    presetKey: 'paint_dark_charcoal_test',
    assetAnalysis: {
      overallQualityScore: 82,
      lightingScore: 78,
      retakeRecommended: false,
    },
    roomMetrics: {
      coverageRatio: 0.26,
      meanLuminance: 0.71,
      meanSaturation: 0.08,
      colorVariance: 0.06,
      luminanceVariance: 0.07,
    },
  });

  assert.equal(decision.skip, false);
});

test('floor tone presets now use the replicate finish pipeline', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('floor_light_wood'),
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced', 'openai_edit'],
  );
});

test('tile or stone floors now use the realism-first replicate finish pipeline', () => {
  assert.deepEqual(
    buildProviderChain({
      preset: resolveVisionPreset('floor_tile_stone'),
      userPlan: 'premium',
      openAiAvailable: true,
    }),
    ['replicate_basic', 'replicate_advanced'],
  );
});

test('tile or stone preset uses explicit material-replacement defaults', () => {
  const preset = resolveVisionPreset('floor_tile_stone');

  assert.equal(preset.strength, 0.65);
  assert.equal(preset.numInferenceSteps, 60);
  assert.match(preset.basePrompt, /Completely replace the floor material/i);
  assert.match(preset.basePrompt, /visible grout lines/i);
  assert.match(preset.negativePrompt, /wood texture/i);
  assert.match(preset.negativePrompt, /overlay texture/i);
});

test('paint presets use the replicate paint chain before selecting a winner', async () => {
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_soft_greige'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runLocalSharp: async () => {
        callOrder.push('local_sharp');
        return [];
      },
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        if (providerKey === 'replicate_basic') {
          return [];
        }

        return [
          {
            overallScore: 80,
            maskedChangeRatio: 1,
            maskedColorShiftRatio: 0.3,
            maskedLuminanceDelta: 0.3,
            maskedEdgeDensityDelta: 0.002,
            topHalfChangeRatio: 0.03,
            outsideMaskChangeRatio: 0.07,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced', 'local_sharp']);
  assert.equal(result.providerUsed, 'replicate_advanced');
  assert.equal(result.providerAttemptCount, 3);
});

test('floor presets use the replicate chain when tile or stone is requested', async () => {
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('floor_tile_stone'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        return [
          {
            providerKey,
            overallScore: providerKey === 'replicate_advanced' ? 81 : 78,
            focusRegionChangeRatio: 0.14,
            maskedChangeRatio: 0.16,
            maskedColorShiftRatio: 0.09,
            maskedLuminanceDelta: 0.03,
            maskedEdgeDensityDelta: 0.012,
            topHalfChangeRatio: 0.03,
            outsideMaskChangeRatio: 0.06,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
      runLocalSharp: async () => {
        callOrder.push('local_sharp');
        return [];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced']);
  assert.equal(result.providerUsed, 'replicate_advanced');
  assert.equal(result.providerAttemptCount, 2);
});

test('tile or stone floors keep the best safe replicate candidate when strict thresholds are missed', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('floor_tile_stone'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => [
        {
          providerKey,
          overallScore: providerKey === 'replicate_advanced' ? 77 : 74,
          focusRegionChangeRatio: 0.028,
          maskedChangeRatio: 0.048,
          maskedColorShiftRatio: 0.019,
          maskedLuminanceDelta: 0.009,
          maskedEdgeDensityDelta: 0.0018,
          topHalfChangeRatio: 0.05,
          outsideMaskChangeRatio: 0.1,
          furnitureCoverageIncreaseRatio: 0,
        },
      ],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'replicate_advanced');
  assert.equal(result.bestVariant?.providerKey, 'replicate_advanced');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'poor');
});

test('paint presets reject a subtle replicate wall repaint that misses strength enforcement', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_soft_greige'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        return [
          {
            providerKey,
            overallScore: 88,
            maskedChangeRatio: 0.045,
            maskedColorShiftRatio: 0.02,
            maskedLuminanceDelta: 0.02,
            maskedEdgeDensityDelta: 0.0006,
            topHalfChangeRatio: 0.03,
            outsideMaskChangeRatio: 0.09,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'replicate_basic');
  assert.equal(result.bestVariant?.providerKey, 'replicate_basic');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'poor');
});

test('paint presets accept a visibly changed warm wall candidate when the usable floor is met', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_warm_neutral'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [
        {
          providerKey: 'replicate_basic',
          overallScore: 58,
          maskedChangeRatio: 0.42,
          maskedColorShiftRatio: 0.13,
          maskedLuminanceDelta: 0.09,
          maskedEdgeDensityDelta: 0.001,
          topHalfChangeRatio: 0.03,
          outsideMaskChangeRatio: 0.09,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
      runOpenAiEdit: async () => [],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'replicate_basic');
  assert.equal(result.bestVariant?.providerKey, 'replicate_basic');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'high');
});

test('paint presets accept window-heavy warm wall candidates with high outside-mask change', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_warm_neutral'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [],
      runOpenAiEdit: async () => [
        {
          providerKey: 'openai_edit',
          overallScore: 0,
          maskedChangeRatio: 0.8379,
          focusRegionChangeRatio: 0.5825,
          maskedColorShiftRatio: 0.1142,
          maskedLuminanceDelta: 0.0841,
          maskedEdgeDensityDelta: -0.0329,
          topHalfChangeRatio: 0.04,
          outsideMaskChangeRatio: 0.5256,
          windowCoverageRatio: 0.5648,
          windowBrightPixelRatio: 0.5401,
          windowStructuredPixelRatio: 0.2132,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'openai_edit');
  assert.equal(result.bestVariant?.providerKey, 'openai_edit');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'good');
});

test('paint presets keep a strong local fallback preview when strict review fields are missing', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_warm_neutral'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [],
      runOpenAiEdit: async () => [],
      runLocalSharp: async () => [
        {
          providerKey: 'local_sharp',
          overallScore: 6,
          maskedChangeRatio: 0.9902,
          focusRegionChangeRatio: 0.3469,
          outsideMaskChangeRatio: 0,
          maskedColorShiftRatio: 0.2584,
          maskedLuminanceDelta: 0.2556,
          maskedEdgeDensityDelta: -0.0468,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
    },
  });

  assert.equal(result.providerUsed, 'local_sharp');
  assert.equal(result.bestVariant?.providerKey, 'local_sharp');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'high');
});

test('dark charcoal test preset keeps the first safe visible candidate without strict paint-strength gating', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_dark_charcoal_test'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => [
        {
          providerKey,
          overallScore: 0,
          maskedChangeRatio: 0.32,
          maskedColorShiftRatio: 0.11,
          maskedLuminanceDelta: 0.11,
          maskedEdgeDensityDelta: 0.001,
          topHalfChangeRatio: 0.03,
          outsideMaskChangeRatio: 0.1,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
      runOpenAiEdit: async () => [],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'replicate_basic');
  assert.equal(result.bestVariant?.providerKey, 'replicate_basic');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'high');
});

test('dark charcoal test preset surfaces a strong but spillier diagnostic candidate as best effort', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_dark_charcoal_test'),
    roomType: 'living_room',
    requestedMode: 'freeform',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [],
      runOpenAiEdit: async () => [
        {
          providerKey: 'openai_edit',
          overallScore: 0,
          maskedChangeRatio: 0.7887,
          focusRegionChangeRatio: 0.5345,
          topHalfChangeRatio: 0.7048,
          outsideMaskChangeRatio: 0.4133,
          maskedColorShiftRatio: 0.3715,
          maskedLuminanceDelta: -0.3423,
          maskedEdgeDensityDelta: -0.0796,
          newFurnitureAdditionRatio: 0,
          furnitureCoverageIncreaseRatio: 0,
          perceptibilityScore: 0.5743,
        },
      ],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'openai_edit');
  assert.equal(result.bestVariant?.providerKey, 'openai_edit');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'concept');
});

test('paint presets return best available advisory candidate when the time budget is reached', async () => {
  let now = 0;
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_warm_neutral'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    nowFn: () => now,
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        now = 121_000;
        return [
          {
            providerKey,
            overallScore: 6,
            maskedChangeRatio: 0.35,
            focusRegionChangeRatio: 0.21,
            maskedColorShiftRatio: 0.12,
            maskedLuminanceDelta: 0.08,
            maskedEdgeDensityDelta: 0.001,
            topHalfChangeRatio: 0.05,
            outsideMaskChangeRatio: 0.08,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
      runOpenAiEdit: async () => {
        callOrder.push('openai_edit');
        return [];
      },
      runLocalSharp: async () => {
        callOrder.push('local_sharp');
        return [];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic']);
  assert.equal(result.providerUsed, 'replicate_basic');
  assert.equal(result.bestVariant?.providerKey, 'replicate_basic');
  assert.equal(result.stoppedEarlyReason, 'time_budget_best_available');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'concept');
  assert.equal(result.timeBudgetReached, true);
});

test('paint presets return a best-effort preview instead of advisor-only when a subtle safe candidate exists', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_warm_neutral'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [],
      runOpenAiEdit: async () => [
        {
          providerKey: 'openai_edit',
          overallScore: 0,
          maskedChangeRatio: 0.4508,
          focusRegionChangeRatio: 0.2781,
          outsideMaskChangeRatio: 0.2737,
          maskedColorShiftRatio: 0.0888,
          maskedLuminanceDelta: 0.0278,
          maskedEdgeDensityDelta: 0.0113,
          topHalfChangeRatio: 0.04,
          windowCoverageRatio: 0.18,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, 'openai_edit');
  assert.equal(result.bestVariant?.providerKey, 'openai_edit');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'poor');
});

test('paint ranking prefers clearer visible repaint over safer but barely changed result', () => {
  const ranked = rankCandidates(
    [
      {
        providerKey: 'replicate_basic',
        maskedChangeRatio: 0.08,
        maskedColorShiftRatio: 0.03,
        maskedLuminanceDelta: 0.01,
        maskedEdgeDensityDelta: 0.0004,
        outsideMaskChangeRatio: 0.03,
        topHalfChangeRatio: 0.01,
        furnitureCoverageIncreaseRatio: 0,
        newFurnitureAdditionRatio: 0,
      },
      {
        providerKey: 'replicate_advanced',
        maskedChangeRatio: 0.16,
        maskedColorShiftRatio: 0.08,
        maskedLuminanceDelta: 0.03,
        maskedEdgeDensityDelta: 0.001,
        outsideMaskChangeRatio: 0.04,
        topHalfChangeRatio: 0.01,
        furnitureCoverageIncreaseRatio: 0,
        newFurnitureAdditionRatio: 0,
      },
    ],
    'paint_warm_neutral',
  );

  assert.equal(ranked[0]?.providerKey, 'replicate_advanced');
});

test('paint presets fall through to openai_edit when replicate returns nothing usable', async () => {
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_bright_white'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        return [];
      },
      runOpenAiEdit: async () => {
        callOrder.push('openai_edit');
        return [
          {
            providerKey: 'openai_edit',
            overallScore: 80,
            maskedChangeRatio: 1,
            maskedColorShiftRatio: 0.3,
            maskedLuminanceDelta: 0.3,
            maskedEdgeDensityDelta: 0.001,
            topHalfChangeRatio: 0.05,
            outsideMaskChangeRatio: 0.12,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced', 'openai_edit']);
  assert.equal(result.providerUsed, 'openai_edit');
  assert.equal(result.bestVariant?.providerKey, 'openai_edit');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'high');
});

test('paint presets fall through to local_sharp when ai providers return nothing usable', async () => {
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_bright_white'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        return [];
      },
      runOpenAiEdit: async () => {
        callOrder.push('openai_edit');
        return [];
      },
      runLocalSharp: async () => {
        callOrder.push('local_sharp');
        return [
          {
            providerKey: 'local_sharp',
            overallScore: 80,
            maskedChangeRatio: 1,
            maskedColorShiftRatio: 0.3,
            maskedLuminanceDelta: 0.3,
            maskedEdgeDensityDelta: 0.001,
            topHalfChangeRatio: 0.04,
            outsideMaskChangeRatio: 0.1,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced', 'openai_edit', 'local_sharp']);
  assert.equal(result.providerUsed, 'local_sharp');
  assert.equal(result.bestVariant?.providerKey, 'local_sharp');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'high');
});

test('paint presets retry with stronger settings when first pass is too subtle', async () => {
  const seenStrengths = [];
  let replicateCallCount = 0;
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_warm_neutral'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey, preset }) => {
        if (providerKey !== 'replicate_basic') {
          return [];
        }

        replicateCallCount += 1;
        seenStrengths.push(preset.strength);

        if (replicateCallCount === 1) {
          return [
            {
              providerKey,
              overallScore: 86,
              maskedChangeRatio: 0.06,
              maskedColorShiftRatio: 0.03,
              maskedLuminanceDelta: 0.01,
              maskedEdgeDensityDelta: 0.0008,
              topHalfChangeRatio: 0.02,
              outsideMaskChangeRatio: 0.05,
              furnitureCoverageIncreaseRatio: 0,
              newFurnitureAdditionRatio: 0,
            },
          ];
        }

        return [
          {
            providerKey,
            overallScore: 90,
            maskedChangeRatio: 1,
            maskedColorShiftRatio: 0.3,
            maskedLuminanceDelta: 0.3,
            maskedEdgeDensityDelta: 0.001,
            topHalfChangeRatio: 0.02,
            outsideMaskChangeRatio: 0.04,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
      runOpenAiEdit: async () => [],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(replicateCallCount, 2);
  assert.ok(seenStrengths[1] > seenStrengths[0]);
  assert.equal(result.providerUsed, 'replicate_basic');
});

test('floor presets surface the best-effort finish outcome when tile providers return nothing usable', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('floor_tile_stone'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [],
      runLocalSharp: async () => [],
    },
  });

  assert.equal(result.providerUsed, null);
  assert.equal(result.bestVariant?.providerKey || null, null);
  assert.equal(result.stoppedEarlyReason, 'no_candidates_available');
  assert.equal(result.deliveryMode, 'none');
  assert.equal(result.quality, 'poor');
});

test('floor presets keep a subtle candidate instead of dropping everything as a no-op', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('floor_light_wood'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runLocalSharp: async () => [],
      runReplicateProvider: async () => [
        {
          providerKey: 'replicate_basic',
          overallScore: 71,
          focusRegionChangeRatio: 0.052,
          maskedChangeRatio: 0.007,
          maskedColorShiftRatio: 0.006,
          maskedLuminanceDelta: 0.006,
          outsideMaskChangeRatio: 0.03,
          topHalfChangeRatio: 0.01,
          furnitureCoverageIncreaseRatio: 0,
        },
      ],
    },
  });

  assert.equal(result.providerUsed, 'replicate_basic');
  assert.equal(result.bestVariant?.providerKey, 'replicate_basic');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'poor');
});

test('floor presets keep even extremely subtle raw candidates instead of filtering them out', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('floor_light_wood'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runLocalSharp: async () => [],
      runReplicateProvider: async () => [
        {
          providerKey: 'replicate_basic',
          overallScore: 68,
          focusRegionChangeRatio: 0.03,
          maskedChangeRatio: 0,
          maskedColorShiftRatio: 0,
          maskedLuminanceDelta: 0,
          outsideMaskChangeRatio: 0.01,
          topHalfChangeRatio: 0,
          furnitureCoverageIncreaseRatio: 0,
        },
      ],
    },
  });

  assert.equal(result.providerUsed, 'replicate_basic');
  assert.equal(result.bestVariant?.providerKey, 'replicate_basic');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'poor');
});

test('paint presets accept a strong local candidate after weak ai outputs', async () => {
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_soft_greige'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async () => [
        {
          overallScore: 92,
          maskedChangeRatio: 0.03,
          maskedColorShiftRatio: 0.01,
          maskedEdgeDensityDelta: 0.0002,
          topHalfChangeRatio: 0.02,
          outsideMaskChangeRatio: 0.02,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
      runLocalSharp: async () => [
        {
          providerKey: 'local_sharp',
          overallScore: 84,
          maskedChangeRatio: 1,
          maskedColorShiftRatio: 0.3,
          maskedLuminanceDelta: 0.3,
          maskedEdgeDensityDelta: 0.0001,
          topHalfChangeRatio: 0.02,
          outsideMaskChangeRatio: 0.03,
          furnitureCoverageIncreaseRatio: 0,
          newFurnitureAdditionRatio: 0,
        },
      ],
    },
  });

  assert.equal(result.providerUsed, 'local_sharp');
  assert.equal(result.bestVariant?.providerKey, 'local_sharp');
  assert.equal(result.stoppedEarlyReason, 'ranked_best_candidate');
  assert.equal(result.deliveryMode, 'always_return_best');
  assert.equal(result.quality, 'high');
});

test('getReplicateSettings reduces remove_furniture sample counts for faster execution', () => {
  const basicSettings = getReplicateSettings('replicate_basic', {
    key: 'remove_furniture',
    outputCount: 3,
    guidanceScale: 9,
    numInferenceSteps: 43,
    strength: 0.93,
  });
  const advancedSettings = getReplicateSettings('replicate_advanced', {
    key: 'remove_furniture',
    outputCount: 3,
    guidanceScale: 9,
    numInferenceSteps: 43,
    strength: 0.93,
  });

  assert.equal(basicSettings.outputCount, 3);
  assert.equal(advancedSettings.outputCount, 3);
  assert.equal(advancedSettings.numInferenceSteps, 47);
});

test('getReplicateSettings caps bright white wall samples at four outputs', () => {
  const basicSettings = getReplicateSettings('replicate_basic', {
    key: 'paint_bright_white',
    outputCount: 4,
    guidanceScale: 9.4,
    numInferenceSteps: 54,
    strength: 0.95,
  });
  const advancedSettings = getReplicateSettings('replicate_advanced', {
    key: 'paint_bright_white',
    outputCount: 4,
    guidanceScale: 9.4,
    numInferenceSteps: 54,
    strength: 0.95,
  });

  assert.equal(basicSettings.outputCount, 4);
  assert.equal(advancedSettings.outputCount, 4);
});

test('remove_furniture sufficiency rejects candidates with strong persistence overlap', () => {
  assert.equal(
    isCandidateSufficient(
      {
        objectRemovalScore: 0.22,
        remainingFurnitureOverlapRatio: 0.71,
        largestComponentPersistenceRatio: 0.81,
        newFurnitureAdditionRatio: 0.08,
        focusRegionChangeRatio: 0.18,
        maskedChangeRatio: 0.28,
        maskedEdgeDensityDelta: -0.01,
      },
      'remove_furniture',
    ),
    false,
  );

  assert.equal(
    isCandidateSufficient(
      {
        objectRemovalScore: 0.24,
        remainingFurnitureOverlapRatio: 0.24,
        largestComponentPersistenceRatio: 0.33,
        newFurnitureAdditionRatio: 0.05,
        focusRegionChangeRatio: 0.18,
        maskedChangeRatio: 0.28,
        maskedEdgeDensityDelta: -0.01,
      },
      'remove_furniture',
    ),
    true,
  );
});

test('remove_furniture ranking prefers lower persistence over prettier restaging', () => {
  const ranked = rankCandidates(
    [
      {
        overallScore: 88,
        objectRemovalScore: 0.19,
        remainingFurnitureOverlapRatio: 0.68,
        largestComponentPersistenceRatio: 0.74,
        newFurnitureAdditionRatio: 0.09,
        maskedChangeRatio: 0.33,
      },
      {
        overallScore: 83,
        objectRemovalScore: 0.19,
        remainingFurnitureOverlapRatio: 0.21,
        largestComponentPersistenceRatio: 0.29,
        newFurnitureAdditionRatio: 0.04,
        maskedChangeRatio: 0.24,
      },
    ],
    'remove_furniture',
  );

  assert.equal(ranked[0]?.remainingFurnitureOverlapRatio, 0.21);
});

test('remove_furniture sufficiency rejects candidates that add substitute furniture', () => {
  assert.equal(
    isCandidateSufficient(
      {
        objectRemovalScore: 0.23,
        remainingFurnitureOverlapRatio: 0.26,
        largestComponentPersistenceRatio: 0.34,
        newFurnitureAdditionRatio: 0.31,
        focusRegionChangeRatio: 0.19,
        maskedChangeRatio: 0.26,
        maskedEdgeDensityDelta: -0.01,
      },
      'remove_furniture',
    ),
    false,
  );
});

test('remove_furniture ranking penalizes newly added furniture staging', () => {
  const ranked = rankCandidates(
    [
      {
        overallScore: 90,
        objectRemovalScore: 0.22,
        remainingFurnitureOverlapRatio: 0.2,
        largestComponentPersistenceRatio: 0.32,
        newFurnitureAdditionRatio: 0.29,
        maskedChangeRatio: 0.28,
      },
      {
        overallScore: 84,
        objectRemovalScore: 0.22,
        remainingFurnitureOverlapRatio: 0.2,
        largestComponentPersistenceRatio: 0.32,
        newFurnitureAdditionRatio: 0.05,
        maskedChangeRatio: 0.21,
      },
    ],
    'remove_furniture',
  );

  assert.equal(ranked[0]?.newFurnitureAdditionRatio, 0.05);
});

test('paint preset sufficiency rejects candidates that add new wall features', () => {
  assert.equal(
    isCandidateSufficient(
      {
        maskedChangeRatio: 0.16,
        maskedColorShiftRatio: 0.08,
        maskedLuminanceDelta: 0.04,
        maskedEdgeDensityDelta: 0.009,
        topHalfChangeRatio: 0.04,
        outsideMaskChangeRatio: 0.12,
        furnitureCoverageIncreaseRatio: 0.004,
      },
      'paint_bright_white',
    ),
    false,
  );
});

test('paint preset sufficiency rejects candidates with upper-structure drift', () => {
  assert.equal(
    isCandidateSufficient(
      {
        maskedChangeRatio: 0.16,
        maskedColorShiftRatio: 0.08,
        maskedLuminanceDelta: 0.04,
        maskedEdgeDensityDelta: 0.001,
        topHalfChangeRatio: 0.14,
        outsideMaskChangeRatio: 0.12,
        furnitureCoverageIncreaseRatio: 0.004,
      },
      'paint_bright_white',
    ),
    false,
  );
});

test('paint preset sufficiency rejects candidates that introduce furniture-like additions', () => {
  assert.equal(
    isCandidateSufficient(
      {
        maskedChangeRatio: 0.18,
        maskedColorShiftRatio: 0.08,
        maskedLuminanceDelta: 0.04,
        maskedEdgeDensityDelta: 0.0005,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.1,
        furnitureCoverageIncreaseRatio: 0.006,
        newFurnitureAdditionRatio: 0.18,
      },
      'paint_bright_white',
    ),
    false,
  );
});

test('bright white paint sufficiency accepts a clearly repainted and safe wall candidate', () => {
  assert.equal(
    isCandidateSufficient(
      {
        overallScore: 88,
        maskedChangeRatio: 1,
        maskedColorShiftRatio: 0.3,
        maskedLuminanceDelta: 0.3,
        maskedEdgeDensityDelta: 0.0005,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.12,
        furnitureCoverageIncreaseRatio: 0.004,
        newFurnitureAdditionRatio: 0.01,
      },
      'paint_bright_white',
    ),
    true,
  );
});

test('warm neutral paint sufficiency accepts a near-pass but clearly repainted wall candidate', () => {
  assert.equal(
    isCandidateSufficient(
      {
        overallScore: 7,
        maskedChangeRatio: 0.9902,
        maskedColorShiftRatio: 0.2584,
        maskedLuminanceDelta: 0.2556,
        maskedEdgeDensityDelta: -0.0468,
        topHalfChangeRatio: 0.04,
        outsideMaskChangeRatio: 0,
        furnitureCoverageIncreaseRatio: 0,
        newFurnitureAdditionRatio: 0,
      },
      'paint_warm_neutral',
    ),
    true,
  );
});

test('paint preset ranking prefers cleaner wall repaints over added wall detail', () => {
  const ranked = rankCandidates(
    [
      {
        overallScore: 88,
        maskedChangeRatio: 0.18,
        maskedColorShiftRatio: 0.09,
        maskedEdgeDensityDelta: 0.011,
        outsideMaskChangeRatio: 0.1,
        furnitureCoverageIncreaseRatio: 0.004,
      },
      {
        overallScore: 84,
        maskedChangeRatio: 0.16,
        maskedColorShiftRatio: 0.08,
        maskedEdgeDensityDelta: 0.0004,
        outsideMaskChangeRatio: 0.12,
        furnitureCoverageIncreaseRatio: 0.004,
      },
    ],
    'paint_bright_white',
  );

  assert.equal(ranked[0]?.maskedEdgeDensityDelta, 0.0004);
});

test('paint preset ranking prefers lower upper-structure drift over brighter but invasive repaint', () => {
  const ranked = rankCandidates(
    [
      {
        overallScore: 88,
        maskedChangeRatio: 0.18,
        maskedColorShiftRatio: 0.09,
        maskedLuminanceDelta: 0.07,
        maskedEdgeDensityDelta: 0.0006,
        topHalfChangeRatio: 0.18,
        outsideMaskChangeRatio: 0.11,
        furnitureCoverageIncreaseRatio: 0.004,
      },
      {
        overallScore: 84,
        maskedChangeRatio: 0.16,
        maskedColorShiftRatio: 0.08,
        maskedLuminanceDelta: 0.05,
        maskedEdgeDensityDelta: 0.0007,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.12,
        furnitureCoverageIncreaseRatio: 0.004,
      },
    ],
    'paint_bright_white',
  );

  assert.equal(ranked[0]?.topHalfChangeRatio, 0.03);
});

test('paint preset ranking prefers a stronger safe white repaint over a weaker safe repaint', () => {
  const ranked = rankCandidates(
    [
      {
        label: 'Subtle white',
        overallScore: 91,
        maskedChangeRatio: 0.14,
        maskedColorShiftRatio: 0.056,
        maskedLuminanceDelta: 0.026,
        maskedEdgeDensityDelta: -0.001,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.08,
        furnitureCoverageIncreaseRatio: 0,
      },
      {
        label: 'Clear white repaint',
        overallScore: 88,
        maskedChangeRatio: 1,
        maskedColorShiftRatio: 0.3,
        maskedLuminanceDelta: 0.3,
        maskedEdgeDensityDelta: -0.0005,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.08,
        furnitureCoverageIncreaseRatio: 0,
      },
    ],
    'paint_bright_white',
  );

  assert.equal(ranked[0]?.label, 'Clear white repaint');
});

test('paint preset ranking penalizes introduced furniture over a stronger repaint', () => {
  const ranked = rankCandidates(
    [
      {
        label: 'Furniture added',
        overallScore: 95,
        maskedChangeRatio: 0.22,
        maskedColorShiftRatio: 0.095,
        maskedLuminanceDelta: 0.058,
        maskedEdgeDensityDelta: 0.0004,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.08,
        furnitureCoverageIncreaseRatio: 0.005,
        newFurnitureAdditionRatio: 0.22,
      },
      {
        label: 'Safe repaint',
        overallScore: 88,
        maskedChangeRatio: 0.18,
        maskedColorShiftRatio: 0.082,
        maskedLuminanceDelta: 0.05,
        maskedEdgeDensityDelta: 0.0005,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.08,
        furnitureCoverageIncreaseRatio: 0.005,
        newFurnitureAdditionRatio: 0,
      },
    ],
    'paint_bright_white',
  );

  assert.equal(ranked[0]?.label, 'Safe repaint');
});

test('tile or stone floor sufficiency rejects dark wood-like candidates', () => {
  assert.equal(
    isCandidateSufficient(
      {
        focusRegionChangeRatio: 0.16,
        maskedChangeRatio: 0.19,
        maskedColorShiftRatio: 0.05,
        maskedLuminanceDelta: -0.09,
        topHalfChangeRatio: 0.04,
        outsideMaskChangeRatio: 0.1,
        furnitureCoverageIncreaseRatio: 0.004,
      },
      'floor_tile_stone',
    ),
    false,
  );
});

test('tile or stone floor sufficiency accepts clear material change via luminance and grout structure', () => {
  assert.equal(
    isCandidateSufficient(
      {
        focusRegionChangeRatio: 0.12,
        maskedChangeRatio: 0.14,
        maskedColorShiftRatio: 0.04,
        maskedLuminanceDelta: 0.06,
        maskedEdgeDensityDelta: 0.02,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.08,
        furnitureCoverageIncreaseRatio: 0,
      },
      'floor_tile_stone',
    ),
    true,
  );
});

test('tile or stone floor ranking prefers truer material shift over wood-like darkening', () => {
  const ranked = rankCandidates(
    [
      {
        label: 'Dark wood-like floor',
        overallScore: 92,
        focusRegionChangeRatio: 0.18,
        maskedChangeRatio: 0.22,
        maskedColorShiftRatio: 0.06,
        maskedLuminanceDelta: -0.09,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.1,
        furnitureCoverageIncreaseRatio: 0,
      },
      {
        label: 'Clear tile or stone shift',
        overallScore: 88,
        focusRegionChangeRatio: 0.17,
        maskedChangeRatio: 0.2,
        maskedColorShiftRatio: 0.11,
        maskedLuminanceDelta: -0.02,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.08,
        furnitureCoverageIncreaseRatio: 0,
      },
    ],
    'floor_tile_stone',
  );

  assert.equal(ranked[0]?.label, 'Clear tile or stone shift');
});

test('tile or stone floor ranking prefers a stronger tile-material signal over a near-original safe candidate', () => {
  const ranked = rankCandidates(
    [
      {
        label: 'Near-original safe floor',
        overallScore: 91,
        focusRegionChangeRatio: 0.08,
        maskedChangeRatio: 0.11,
        maskedColorShiftRatio: 0.035,
        maskedLuminanceDelta: 0.02,
        maskedEdgeDensityDelta: 0.002,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.05,
        furnitureCoverageIncreaseRatio: 0,
      },
      {
        label: 'Tile-like local floor',
        overallScore: 78,
        focusRegionChangeRatio: 0.12,
        maskedChangeRatio: 0.15,
        maskedColorShiftRatio: 0.04,
        maskedLuminanceDelta: 0.055,
        maskedEdgeDensityDelta: 0.018,
        topHalfChangeRatio: 0.03,
        outsideMaskChangeRatio: 0.07,
        furnitureCoverageIncreaseRatio: 0,
      },
    ],
    'floor_tile_stone',
  );

  assert.equal(ranked[0]?.label, 'Tile-like local floor');
});

test('remove_furniture orchestration evaluates the full provider chain before selecting a winner', async () => {
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: {
      key: 'remove_furniture',
      category: 'concept_preview',
      providerPreference: 'replicate',
      upgradeTier: 'premium',
    },
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        if (providerKey === 'replicate_basic') {
          return [
            {
              overallScore: 86,
              objectRemovalScore: 0.21,
              remainingFurnitureOverlapRatio: 0.24,
              largestComponentPersistenceRatio: 0.34,
              newFurnitureAdditionRatio: 0.04,
              focusRegionChangeRatio: 0.17,
              maskedChangeRatio: 0.21,
              maskedEdgeDensityDelta: -0.01,
            },
          ];
        }

        return [
          {
            overallScore: 82,
            objectRemovalScore: 0.28,
            remainingFurnitureOverlapRatio: 0.11,
            largestComponentPersistenceRatio: 0.18,
            newFurnitureAdditionRatio: 0.03,
            focusRegionChangeRatio: 0.2,
            maskedChangeRatio: 0.28,
            maskedEdgeDensityDelta: -0.014,
          },
        ];
      },
      runOpenAiEdit: async () => {
        callOrder.push('openai_edit');
        return [
          {
            overallScore: 80,
            objectRemovalScore: 0.26,
            remainingFurnitureOverlapRatio: 0.16,
            largestComponentPersistenceRatio: 0.22,
            newFurnitureAdditionRatio: 0.02,
            focusRegionChangeRatio: 0.19,
            maskedChangeRatio: 0.27,
            maskedEdgeDensityDelta: -0.015,
          },
        ];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced', 'openai_edit']);
  assert.equal(result.providerUsed, 'replicate_advanced');
  assert.equal(result.providerAttemptCount, 3);
});

test('remove_furniture orchestration exits early when an advanced candidate is already exceptional', async () => {
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: {
      key: 'remove_furniture',
      category: 'concept_preview',
      providerPreference: 'replicate',
      upgradeTier: 'premium',
    },
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        if (providerKey === 'replicate_basic') {
          return [
            {
              overallScore: 82,
              objectRemovalScore: 0.19,
              remainingFurnitureOverlapRatio: 0.34,
              largestComponentPersistenceRatio: 0.44,
              newFurnitureAdditionRatio: 0.08,
              focusRegionChangeRatio: 0.16,
              maskedChangeRatio: 0.22,
              maskedEdgeDensityDelta: -0.01,
              outsideMaskChangeRatio: 0.16,
              topHalfChangeRatio: 0.08,
              clearedMajorComponentCount: 2,
              totalMajorComponentCount: 4,
            },
          ];
        }

        return [
          {
            overallScore: 90,
            objectRemovalScore: 0.34,
            remainingFurnitureOverlapRatio: 0.08,
            largestComponentPersistenceRatio: 0.12,
            newFurnitureAdditionRatio: 0.02,
            focusRegionChangeRatio: 0.21,
            maskedChangeRatio: 0.31,
            maskedEdgeDensityDelta: -0.016,
            outsideMaskChangeRatio: 0.12,
            topHalfChangeRatio: 0.06,
            clearedMajorComponentCount: 4,
            totalMajorComponentCount: 4,
          },
        ];
      },
      runOpenAiEdit: async () => {
        callOrder.push('openai_edit');
        return [];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced']);
  assert.equal(result.providerUsed, 'replicate_advanced');
  assert.equal(result.stoppedEarlyReason, 'high_confidence_candidate');
});

test('remove_furniture orchestration does not stop at the time budget before stronger providers run', async () => {
  let now = 0;
  const callOrder = [];
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: {
      key: 'remove_furniture',
      category: 'concept_preview',
      providerPreference: 'replicate',
      upgradeTier: 'premium',
    },
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    nowFn: () => now,
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        now = 151_000;
        return [
          {
            overallScore: 82,
            objectRemovalScore: 0.19,
            remainingFurnitureOverlapRatio: 0.3,
            largestComponentPersistenceRatio: 0.38,
            newFurnitureAdditionRatio: 0.08,
            focusRegionChangeRatio: 0.16,
            maskedChangeRatio: 0.22,
            maskedEdgeDensityDelta: -0.01,
            outsideMaskChangeRatio: 0.2,
            topHalfChangeRatio: 0.08,
            clearedMajorComponentCount: 2,
            totalMajorComponentCount: 4,
          },
        ];
      },
      runOpenAiEdit: async () => {
        callOrder.push('openai_edit');
        return [
          {
            overallScore: 88,
            objectRemovalScore: 0.27,
            remainingFurnitureOverlapRatio: 0.14,
            largestComponentPersistenceRatio: 0.2,
            newFurnitureAdditionRatio: 0.03,
            focusRegionChangeRatio: 0.21,
            maskedChangeRatio: 0.29,
            maskedEdgeDensityDelta: -0.014,
            outsideMaskChangeRatio: 0.16,
            topHalfChangeRatio: 0.07,
            clearedMajorComponentCount: 4,
            totalMajorComponentCount: 4,
          },
        ];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic', 'replicate_advanced', 'openai_edit']);
  assert.equal(result.providerUsed, 'openai_edit');
  assert.equal(result.timeBudgetReached, false);
});

test('vision orchestration stops after cancellation is requested between providers', async () => {
  const callOrder = [];
  let shouldCancelChecks = 0;
  const result = await orchestrateVisionJob({
    asset: { roomLabel: 'Living room' },
    preset: resolveVisionPreset('paint_soft_greige'),
    roomType: 'living_room',
    requestedMode: 'preset',
    userPlan: 'premium',
    sourceBuffer: Buffer.from('source'),
    sourceImageBase64: 'source',
    shouldCancel: async () => {
      shouldCancelChecks += 1;
      return shouldCancelChecks >= 3;
    },
    providerRunners: {
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        return [
          {
            providerKey,
            overallScore: 80,
            maskedChangeRatio: 1,
            maskedColorShiftRatio: 0.3,
            maskedLuminanceDelta: 0.3,
            maskedEdgeDensityDelta: 0.002,
            topHalfChangeRatio: 0.03,
            outsideMaskChangeRatio: 0.07,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
      runLocalSharp: async () => {
        callOrder.push('local_sharp');
        return [];
      },
    },
  });

  assert.deepEqual(callOrder, ['replicate_basic']);
  assert.equal(result.cancelled, true);
  assert.equal(result.stoppedEarlyReason, 'cancelled');
  assert.equal(result.bestVariant, null);
});
