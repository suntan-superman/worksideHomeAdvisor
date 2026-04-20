import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQueuedAnalysisPayload, serializeJob } from './jobs.service.js';

test('buildQueuedAnalysisPayload keeps only the durable usage context fields', () => {
  const payload = buildQueuedAnalysisPayload({
    propertyId: 'property-123',
    userId: 'user-456',
    inputHash: 'hash-789',
    usageContext: {
      billingCycleKey: '2026-04-01_to_2026-05-01',
      planCode: 'seller_pro',
      ignored: 'transient-field',
    },
    extra: {
      customizations: { title: 'Test report' },
    },
  });

  assert.deepEqual(payload, {
    propertyId: 'property-123',
    userId: 'user-456',
    inputHash: 'hash-789',
    usageContext: {
      billingCycleKey: '2026-04-01_to_2026-05-01',
      planCode: 'seller_pro',
    },
    customizations: { title: 'Test report' },
  });
});

test('serializeJob normalizes ids and lifecycle fields', () => {
  const serialized = serializeJob({
    _id: { toString: () => 'job-1' },
    kind: 'property_report',
    status: 'queued',
    propertyId: { toString: () => 'property-1' },
    mediaAssetId: { toString: () => 'asset-1' },
    requestedByUserId: { toString: () => 'user-1' },
    workerKey: 'api_inline_background',
    currentStage: 'queued',
    progressPercent: 0,
    message: 'Job queued.',
    warning: '',
    failureReason: '',
    payload: { propertyId: 'property-1' },
    result: null,
    retryCount: 0,
    maxAttempts: 1,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    lastHeartbeatAt: null,
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T00:00:00.000Z',
  });

  assert.equal(serialized.id, 'job-1');
  assert.equal(serialized.kind, 'property_report');
  assert.equal(serialized.status, 'queued');
  assert.equal(serialized.propertyId, 'property-1');
  assert.equal(serialized.mediaAssetId, 'asset-1');
  assert.equal(serialized.requestedByUserId, 'user-1');
  assert.equal(serialized.currentStage, 'queued');
  assert.deepEqual(serialized.payload, { propertyId: 'property-1' });
});
