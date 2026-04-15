import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import {
  analyzePropertyPricing,
  deleteStalePricingAnalysesForProperty,
  getLatestPricingAnalysis,
  pricingServiceDependencies,
} from './pricing.service.js';

function setReadyState(value) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value,
  });
}

function createSortedLeanQuery(result) {
  return {
    select() {
      return this;
    },
    sort() {
      return {
        lean: async () => result,
      };
    },
  };
}

test('analyzePropertyPricing keeps only the latest analysis for a property', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  const propertyDocument = {
    _id: 'property-1',
    toObject() {
      return {
        _id: 'property-1',
        ownerUserId: 'user-1',
        title: 'Living Room Test',
        addressLine1: '123 Main',
        city: 'Bakersfield',
        state: 'CA',
        zip: '93312',
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2400,
        sellerProfile: { goals: ['maximize-profit'] },
      };
    },
  };

  t.mock.method(pricingServiceDependencies.PropertyModel, 'findById', async () => propertyDocument);
  t.mock.method(pricingServiceDependencies, 'getComparableSalesForProperty', async () => ({
    source: 'rentcast',
    usedLiveData: true,
    avm: { estimate: 395000 },
    selectedComps: [
      {
        _id: 'comp-1',
        address: '111 Oak',
        price: 390000,
        sqft: 2300,
        beds: 4,
        baths: 3,
        pricePerSqft: 170,
        distanceMiles: 0.6,
        saleDate: '2026-03-10',
        daysOnMarket: 14,
        propertyType: 'single_family',
        listingType: 'sale',
        latitude: 35.0,
        longitude: -119.0,
        score: 0.92,
        raw: { provider: 'rentcast' },
      },
    ],
    pricing: {
      medianPricePerSqft: 171,
      range: { low: 385000, mid: 395000, high: 405000 },
      variance: 0.03,
      confidence: 0.82,
    },
    warning: '',
  }));
  t.mock.method(pricingServiceDependencies, 'generatePricingInsights', async () => ({
    strengths: ['Good comp set'],
    risks: ['Seasonal variability'],
    summary: 'Use the midpoint.',
    pricingStrategy: 'Start near the midpoint.',
    warning: '',
  }));

  let createdPayload = null;
  t.mock.method(pricingServiceDependencies.PricingAnalysisModel, 'create', async (payload) => {
    createdPayload = payload;
    return {
      _id: 'analysis-new',
      toObject() {
        return {
          _id: 'analysis-new',
          ...payload,
          createdAt: '2026-04-10T12:00:00.000Z',
          updatedAt: '2026-04-10T12:00:00.000Z',
        };
      },
    };
  });

  let deleteFilter = null;
  t.mock.method(pricingServiceDependencies.PricingAnalysisModel, 'deleteMany', async (filter) => {
    deleteFilter = filter;
    return { deletedCount: 3 };
  });

  const analysis = await analyzePropertyPricing('property-1');

  assert.equal(createdPayload.propertyId, 'property-1');
  assert.deepEqual(deleteFilter, {
    propertyId: 'property-1',
    _id: { $ne: 'analysis-new' },
  });
  assert.equal(analysis.id, 'analysis-new');
  assert.equal(analysis.recommendedListMid, 395000);
});

test('deleteStalePricingAnalysesForProperty deletes everything except the kept analysis', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  let receivedFilter = null;
  t.mock.method(pricingServiceDependencies.PricingAnalysisModel, 'deleteMany', async (filter) => {
    receivedFilter = filter;
    return { deletedCount: 2 };
  });

  const deletedCount = await deleteStalePricingAnalysesForProperty('property-55', 'analysis-keep');

  assert.equal(deletedCount, 2);
  assert.deepEqual(receivedFilter, {
    propertyId: 'property-55',
    _id: { $ne: 'analysis-keep' },
  });
});

test('getLatestPricingAnalysis returns the newest stored analysis', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  t.mock.method(pricingServiceDependencies.PricingAnalysisModel, 'findOne', () =>
    createSortedLeanQuery({
      _id: 'analysis-latest',
      propertyId: 'property-88',
      source: 'rentcast',
      usedLiveData: true,
      cacheKey: 'property-88-cache',
      avm: null,
      subjectSnapshot: { title: 'Test Property' },
      selectedComps: [],
      medianPricePerSqft: 180,
      recommendedListLow: 410000,
      recommendedListMid: 420000,
      recommendedListHigh: 430000,
      variance: 0.02,
      confidenceScore: 0.84,
      strengths: ['Fresh data'],
      risks: [],
      summary: 'Latest analysis',
      pricingStrategy: 'Use midpoint',
      warning: null,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
    }),
  );

  const analysis = await getLatestPricingAnalysis('property-88');

  assert.equal(analysis.id, 'analysis-latest');
  assert.equal(analysis.propertyId, 'property-88');
  assert.equal(analysis.recommendedListMid, 420000);
});
