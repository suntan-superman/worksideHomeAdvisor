import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPhotoReadinessMetrics,
  buildSectionRegistry,
  decideOutputClasses,
  FLYER_CLASS,
  getActionPlanDepthProfile,
  getFlyerToneProfile,
  getSellerReportToneProfile,
  SELLER_REPORT_CLASS,
} from './output-class-engine.js';

test('low readiness + no ready photos + no chosen price resolves to prep classes', () => {
  const metrics = buildPhotoReadinessMetrics({
    photoSummary: {
      listingCandidateCount: 0,
      retakeCount: 5,
    },
    selectedPhotos: [
      { imageUrl: 'https://example.com/a.jpg', listingCandidate: false, score: 44 },
      { imageUrl: 'https://example.com/b.jpg', listingCandidate: false, score: 51 },
    ],
  });

  const classes = decideOutputClasses({
    readinessScore: 39,
    marketplaceReadyPhotoCount: metrics.marketplaceReadyPhotos,
    chosenPricePresent: false,
    checklistCompletionPercent: 41,
    priorityRetakeCount: metrics.priorityRetakes,
  });

  assert.equal(classes.sellerReportClass, SELLER_REPORT_CLASS.PREP);
  assert.equal(classes.flyerClass, FLYER_CLASS.PREVIEW);

  const sections = buildSectionRegistry({
    sellerReportClass: classes.sellerReportClass,
    flyerClass: classes.flyerClass,
    photoMetrics: metrics,
    hasSelectedPrice: false,
  });

  assert.equal(sections.seller.includePhotoPreparationPage, true);
  assert.equal(sections.flyer.includeMarketingGallery, false);
  assert.equal(sections.flyer.includePricingPositioningPage, false);
});

test('mid readiness + some ready photos + chosen price resolves to balanced prelaunch', () => {
  const classes = decideOutputClasses({
    readinessScore: 62,
    marketplaceReadyPhotoCount: 2,
    chosenPricePresent: true,
    checklistCompletionPercent: 60,
    priorityRetakeCount: 2,
  });

  assert.equal(classes.sellerReportClass, SELLER_REPORT_CLASS.BALANCED);
  assert.equal(classes.flyerClass, FLYER_CLASS.PRELAUNCH);

  const tone = getSellerReportToneProfile(classes.sellerReportClass);
  assert.equal(tone.key, 'balanced_guidance');
});

test('near launch + strong gallery + chosen price resolves to launch marketing', () => {
  const classes = decideOutputClasses({
    readinessScore: 82,
    marketplaceReadyPhotoCount: 5,
    chosenPricePresent: true,
    checklistCompletionPercent: 92,
    priorityRetakeCount: 1,
  });

  assert.equal(classes.sellerReportClass, SELLER_REPORT_CLASS.LAUNCH);
  assert.equal(classes.flyerClass, FLYER_CLASS.MARKETING);

  const sections = buildSectionRegistry({
    sellerReportClass: classes.sellerReportClass,
    flyerClass: classes.flyerClass,
    photoMetrics: {
      marketplaceReadyPhotos: 5,
      mustFixBeforeLaunchCount: 1,
    },
    hasSelectedPrice: true,
  });

  assert.equal(sections.seller.includeActionSupportPages, false);
  assert.equal(sections.flyer.includeMarketingGallery, true);
});

test('sparse data edge case still returns safe prep defaults', () => {
  const classes = decideOutputClasses({});
  assert.equal(classes.sellerReportClass, SELLER_REPORT_CLASS.PREP);
  assert.equal(classes.flyerClass, FLYER_CLASS.PREVIEW);
});

test('high readiness with weak gallery mismatch downgrades to balanced prelaunch', () => {
  const classes = decideOutputClasses({
    readinessScore: 78,
    marketplaceReadyPhotoCount: 1,
    chosenPricePresent: true,
    checklistCompletionPercent: 84,
    priorityRetakeCount: 4,
  });

  assert.equal(classes.sellerReportClass, SELLER_REPORT_CLASS.BALANCED);
  assert.equal(classes.flyerClass, FLYER_CLASS.PRELAUNCH);

  const flyerTone = getFlyerToneProfile(classes.flyerClass);
  const actionDepth = getActionPlanDepthProfile(classes.sellerReportClass);
  assert.equal(flyerTone.key, 'prelaunch_persuasive');
  assert.equal(actionDepth.topActionLimit, 3);
});
