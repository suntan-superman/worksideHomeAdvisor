import test from 'node:test';
import assert from 'node:assert/strict';

import { SocialPackModel } from '../documents/social-pack.model.js';
import { FlyerModel } from '../documents/flyer.model.js';
import { ReportModel } from '../documents/report.model.js';
import { ImageJobModel } from '../media/image-job.model.js';
import { MediaAssetModel } from '../media/media.model.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { SmsLogModel } from '../marketplace-sms/sms-log.model.js';
import { PricingAnalysisModel } from '../pricing/pricing.model.js';
import { PropertyModel } from './property.model.js';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderReferenceModel,
  ProviderResponseModel,
  ProviderSmsLogModel,
  SavedProviderModel,
} from '../providers/provider-leads.model.js';
import { PublicFunnelEventModel } from '../public/public.model.js';
import { ChecklistModel } from '../tasks/checklist.model.js';
import { AnalysisLockModel } from '../usage/analysis-lock.model.js';
import { UsageTrackingModel } from '../usage/usage-tracking.model.js';
import {
  deletePropertiesByIds,
  propertyLifecycleDependencies,
} from './property-lifecycle.service.js';

function createSelectedLeanQuery(result) {
  return {
    select() {
      return {
        lean: async () => result,
      };
    },
  };
}

test('deletePropertiesByIds removes linked property records and storage references', async (t) => {
  const propertyIds = ['property-1'];
  const storageCalls = [];
  const deleteManyCalls = [];
  const updateManyCalls = [];

  t.mock.method(MediaAssetModel, 'find', () =>
    createSelectedLeanQuery([
      { _id: 'asset-1', storageProvider: 'gcs', storageKey: 'asset-key' },
    ]));
  t.mock.method(MediaVariantModel, 'find', () =>
    createSelectedLeanQuery([
      { _id: 'variant-1', storageProvider: 'gcs', storageKey: 'variant-key' },
    ]));
  t.mock.method(LeadRequestModel, 'find', () =>
    createSelectedLeanQuery([{ _id: 'lead-1' }]));
  t.mock.method(LeadDispatchModel, 'find', () =>
    createSelectedLeanQuery([{ _id: 'dispatch-1' }]));
  t.mock.method(propertyLifecycleDependencies, 'deleteStoredAssetIfUnreferenced', async (payload) => {
    storageCalls.push(payload);
  });

  [
    [MediaVariantModel, 'MediaVariantModel'],
    [ImageJobModel, 'ImageJobModel'],
    [MediaAssetModel, 'MediaAssetModel'],
    [PricingAnalysisModel, 'PricingAnalysisModel'],
    [FlyerModel, 'FlyerModel'],
    [ReportModel, 'ReportModel'],
    [SocialPackModel, 'SocialPackModel'],
    [ChecklistModel, 'ChecklistModel'],
    [SavedProviderModel, 'SavedProviderModel'],
    [ProviderReferenceModel, 'ProviderReferenceModel'],
    [PublicFunnelEventModel, 'PublicFunnelEventModel'],
    [SmsLogModel, 'SmsLogModel'],
    [AnalysisLockModel, 'AnalysisLockModel'],
    [PropertyModel, 'PropertyModel'],
    [ProviderResponseModel, 'ProviderResponseModel'],
    [ProviderSmsLogModel, 'ProviderSmsLogModel'],
    [LeadDispatchModel, 'LeadDispatchModel'],
    [LeadRequestModel, 'LeadRequestModel'],
  ].forEach(([model, label]) => {
    t.mock.method(model, 'deleteMany', async (filter) => {
      deleteManyCalls.push({ label, filter });
      return { acknowledged: true };
    });
  });

  t.mock.method(UsageTrackingModel, 'updateMany', async (filter, update) => {
    updateManyCalls.push({ filter, update });
    return { acknowledged: true };
  });

  const result = await deletePropertiesByIds(propertyIds);

  assert.deepEqual(result, {
    deletedPropertyCount: 1,
    deletedPropertyIds: ['property-1'],
  });
  assert.equal(storageCalls.length, 2);
  assert.deepEqual(storageCalls[0], {
    storageProvider: 'gcs',
    storageKey: 'asset-key',
    excludeAssetId: 'asset-1',
    excludeVariantId: null,
  });
  assert.deepEqual(storageCalls[1], {
    storageProvider: 'gcs',
    storageKey: 'variant-key',
    excludeAssetId: null,
    excludeVariantId: 'variant-1',
  });
  assert.ok(
    deleteManyCalls.some(
      (entry) =>
        entry.label === 'SocialPackModel' &&
        JSON.stringify(entry.filter) === JSON.stringify({ propertyId: { $in: propertyIds } }),
    ),
  );
  assert.ok(
    deleteManyCalls.some(
      (entry) =>
        entry.label === 'AnalysisLockModel' &&
        JSON.stringify(entry.filter) === JSON.stringify({ propertyId: { $in: ['property-1'] } }),
    ),
  );
  assert.ok(
    deleteManyCalls.some(
      (entry) =>
        entry.label === 'PropertyModel' &&
        JSON.stringify(entry.filter) === JSON.stringify({ _id: { $in: propertyIds } }),
    ),
  );
  assert.deepEqual(updateManyCalls, [
    {
      filter: { analyzedPropertyIds: { $in: ['property-1'] } },
      update: { $pull: { analyzedPropertyIds: { $in: ['property-1'] } } },
    },
  ]);
});
