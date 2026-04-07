import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreeformEnhancementPlan,
  calculateVisionReviewOverallScore,
  normalizeRoomType,
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

test('calculateVisionReviewOverallScore blends review signals into a rounded overall score', () => {
  const score = calculateVisionReviewOverallScore({
    structuralIntegrityScore: 92,
    artifactScore: 84,
    listingAppealScore: 78,
  });

  assert.equal(score, 86);
});
