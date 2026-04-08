import { SocialPackModel } from '../documents/social-pack.model.js';
import { FlyerModel } from '../documents/flyer.model.js';
import { ReportModel } from '../documents/report.model.js';
import { ImageJobModel } from '../media/image-job.model.js';
import { MediaAssetModel } from '../media/media.model.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { deleteStoredAssetIfUnreferenced } from '../media/storage-reference.service.js';
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

export const propertyLifecycleDependencies = {
  deleteStoredAssetIfUnreferenced,
};

function toPropertyIdStrings(propertyIds = []) {
  return propertyIds.map((propertyId) => propertyId?.toString?.() || String(propertyId)).filter(Boolean);
}

export async function deletePropertiesByIds(propertyIds = []) {
  if (!propertyIds.length) {
    return { deletedPropertyCount: 0, deletedPropertyIds: [] };
  }

  const propertyIdStrings = toPropertyIdStrings(propertyIds);
  const [mediaAssets, mediaVariants, leadRequests] = await Promise.all([
    MediaAssetModel.find({ propertyId: { $in: propertyIds } })
      .select({ _id: 1, storageProvider: 1, storageKey: 1 })
      .lean(),
    MediaVariantModel.find({ propertyId: { $in: propertyIds } })
      .select({ _id: 1, storageProvider: 1, storageKey: 1 })
      .lean(),
    LeadRequestModel.find({ propertyId: { $in: propertyIds } })
      .select({ _id: 1 })
      .lean(),
  ]);

  const leadRequestIds = leadRequests.map((request) => request._id);
  const leadDispatches = leadRequestIds.length
    ? await LeadDispatchModel.find({ leadRequestId: { $in: leadRequestIds } })
        .select({ _id: 1 })
        .lean()
    : [];
  const leadDispatchIds = leadDispatches.map((dispatch) => dispatch._id);

  await Promise.all(
    [
      ...mediaAssets.map((asset) => ({ kind: 'asset', ...asset })),
      ...mediaVariants.map((variant) => ({ kind: 'variant', ...variant })),
    ].map(async (asset) => {
      try {
        await propertyLifecycleDependencies.deleteStoredAssetIfUnreferenced({
          storageProvider: asset.storageProvider,
          storageKey: asset.storageKey,
          excludeAssetId: asset.kind === 'asset' ? asset._id : null,
          excludeVariantId: asset.kind === 'variant' ? asset._id : null,
        });
      } catch {
        // Continue deleting property data even if a referenced file/object is already gone.
      }
    }),
  );

  await Promise.all([
    MediaVariantModel.deleteMany({ propertyId: { $in: propertyIds } }),
    ImageJobModel.deleteMany({ propertyId: { $in: propertyIds } }),
    MediaAssetModel.deleteMany({ propertyId: { $in: propertyIds } }),
    PricingAnalysisModel.deleteMany({ propertyId: { $in: propertyIds } }),
    FlyerModel.deleteMany({ propertyId: { $in: propertyIds } }),
    ReportModel.deleteMany({ propertyId: { $in: propertyIds } }),
    SocialPackModel.deleteMany({ propertyId: { $in: propertyIds } }),
    ChecklistModel.deleteMany({ propertyId: { $in: propertyIds } }),
    SavedProviderModel.deleteMany({ propertyId: { $in: propertyIds } }),
    ProviderReferenceModel.deleteMany({ propertyId: { $in: propertyIds } }),
    PublicFunnelEventModel.deleteMany({ propertyId: { $in: propertyIds } }),
    SmsLogModel.deleteMany({ propertyId: { $in: propertyIds } }),
    AnalysisLockModel.deleteMany({ propertyId: { $in: propertyIdStrings } }),
    UsageTrackingModel.updateMany(
      { analyzedPropertyIds: { $in: propertyIdStrings } },
      { $pull: { analyzedPropertyIds: { $in: propertyIdStrings } } },
    ),
    PropertyModel.deleteMany({ _id: { $in: propertyIds } }),
  ]);

  if (leadRequestIds.length) {
    await Promise.all([
      ProviderResponseModel.deleteMany({ leadRequestId: { $in: leadRequestIds } }),
      ProviderSmsLogModel.deleteMany({
        $or: [
          { leadRequestId: { $in: leadRequestIds } },
          leadDispatchIds.length ? { leadDispatchId: { $in: leadDispatchIds } } : null,
        ].filter(Boolean),
      }),
      LeadDispatchModel.deleteMany({ leadRequestId: { $in: leadRequestIds } }),
      LeadRequestModel.deleteMany({ _id: { $in: leadRequestIds } }),
    ]);
  }

  return {
    deletedPropertyCount: propertyIds.length,
    deletedPropertyIds: propertyIdStrings,
  };
}
