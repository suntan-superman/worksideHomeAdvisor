import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreeformEnhancementPlan,
  calculateVisionReviewOverallScore,
  normalizeRoomType,
  resolveFreeformPresetKey,
} from './media-ai.service.js';

test('normalizeRoomType maps common room labels to canonical room types', () => {
  assert.equal(normalizeRoomType('Living Room'), 'living_room');
  assert.equal(normalizeRoomType('Primary Bedroom'), 'bedroom');
  assert.equal(normalizeRoomType('Front Exterior'), 'exterior');
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
