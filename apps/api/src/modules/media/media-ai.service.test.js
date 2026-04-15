import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreeformEnhancementPlan,
  calculateVisionReviewOverallScore,
  getTaskSpecificMaskStrategy,
  normalizeRoomType,
  resolveFreeformPresetKey,
} from './media-ai.service.js';
import {
  buildProviderChain,
  calculatePerceptibilityScore,
  getReplicateSettings,
  isCandidateSufficient,
  rankCandidates,
  resolveVisionUserPlan,
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
        return [
          {
            overallScore: 80,
            maskedChangeRatio: 0.11,
            maskedColorShiftRatio: 0.06,
            maskedEdgeDensityDelta: 0,
            topHalfChangeRatio: 0.03,
            outsideMaskChangeRatio: 0.07,
            furnitureCoverageIncreaseRatio: 0,
            newFurnitureAdditionRatio: 0,
          },
        ];
      },
      runReplicateProvider: async ({ providerKey }) => {
        callOrder.push(providerKey);
        if (providerKey === 'replicate_basic') {
          return [];
        }

        return [
          {
            overallScore: 80,
            maskedChangeRatio: 0.11,
            maskedColorShiftRatio: 0.06,
            maskedLuminanceDelta: 0.03,
            maskedEdgeDensityDelta: 0,
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
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
});

test('paint presets keep a subtle but real replicate wall repaint instead of failing outright', async () => {
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
            overallScore: 70,
            maskedChangeRatio: 0.05,
            maskedColorShiftRatio: 0.02,
            maskedLuminanceDelta: 0.02,
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

  assert.deepEqual(callOrder, [
    'replicate_basic',
    'replicate_advanced',
    'openai_edit',
    'replicate_basic',
    'replicate_advanced',
    'openai_edit',
  ]);
  assert.equal(result.providerUsed, 'openai_edit');
  assert.equal(result.bestVariant?.providerKey, 'openai_edit');
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
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
            overallScore: 67,
            maskedChangeRatio: 0.05,
            maskedColorShiftRatio: 0.018,
            maskedLuminanceDelta: 0.02,
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

  assert.deepEqual(callOrder, [
    'replicate_basic',
    'replicate_advanced',
    'openai_edit',
    'local_sharp',
    'replicate_basic',
    'replicate_advanced',
    'openai_edit',
    'local_sharp',
  ]);
  assert.equal(result.providerUsed, 'local_sharp');
  assert.equal(result.bestVariant?.providerKey, 'local_sharp');
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
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
            maskedChangeRatio: 0.15,
            maskedColorShiftRatio: 0.08,
            maskedLuminanceDelta: 0.03,
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
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
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
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
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
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
});

test('finish presets now keep a safe local fallback candidate instead of hard-failing', async () => {
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
          overallScore: 73,
          maskedChangeRatio: 0.04,
          maskedColorShiftRatio: 0.015,
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
  assert.equal(result.stoppedEarlyReason, 'best_effort_finish_candidate');
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

test('bright white paint sufficiency accepts a subtle but safe brighten-wall candidate', () => {
  assert.equal(
    isCandidateSufficient(
      {
        maskedChangeRatio: 0.13,
        maskedColorShiftRatio: 0.07,
        maskedLuminanceDelta: 0.03,
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
        maskedChangeRatio: 0.19,
        maskedColorShiftRatio: 0.082,
        maskedLuminanceDelta: 0.052,
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
