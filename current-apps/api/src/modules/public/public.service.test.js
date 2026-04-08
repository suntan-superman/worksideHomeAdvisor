import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSellerPreviewResponse } from './public.service.js';

test('buildSellerPreviewResponse returns an estimated range and checklist', () => {
  const preview = buildSellerPreviewResponse({
    address: '8612 Mainsail Drive',
    city: 'Bakersfield',
    state: 'CA',
    postalCode: '93312',
    propertyType: 'single_family',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2460,
    source: 'facebook',
  });

  assert.ok(preview.estimatedRange.low > 0);
  assert.ok(preview.estimatedRange.mid >= preview.estimatedRange.low);
  assert.ok(preview.estimatedRange.high >= preview.estimatedRange.mid);
  assert.ok(preview.marketReadyScore >= 32);
  assert.ok(preview.marketReadyScore <= 71);
  assert.ok(Array.isArray(preview.previewChecklistItems));
  assert.ok(preview.previewChecklistItems.length > 0);
  assert.ok(preview.previewProviderCategories.includes('photographers'));
});
