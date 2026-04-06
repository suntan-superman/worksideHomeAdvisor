import mongoose from 'mongoose';

import { connectToDatabase } from '../src/lib/db.js';
import { purgeUserAccount } from '../src/modules/auth/auth.service.js';
import { UserModel } from '../src/modules/auth/auth.model.js';
import { PropertyModel } from '../src/modules/properties/property.model.js';
import { ChecklistModel } from '../src/modules/tasks/checklist.model.js';
import { PricingAnalysisModel } from '../src/modules/pricing/pricing.model.js';
import { FlyerModel } from '../src/modules/documents/flyer.model.js';
import { ReportModel } from '../src/modules/documents/report.model.js';
import { MediaAssetModel } from '../src/modules/media/media.model.js';
import { MediaVariantModel } from '../src/modules/media/media-variant.model.js';
import { ImageJobModel } from '../src/modules/media/image-job.model.js';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderReferenceModel,
  ProviderResponseModel,
  ProviderSmsLogModel,
  SavedProviderModel,
} from '../src/modules/providers/provider-leads.model.js';
import { UsageTrackingModel } from '../src/modules/usage/usage-tracking.model.js';
import { PublicFunnelEventModel } from '../src/modules/public/public.model.js';
import { BillingSubscriptionModel } from '../src/modules/billing/billing.model.js';
import {
  buildMediaAssetUrl,
  buildMediaVariantUrl,
  readStoredAsset,
  saveBinaryBuffer,
} from '../src/services/storageService.js';

const DEFAULT_SOURCE_EMAIL = 'demo@worksidesoftware.com';
const DEFAULT_TARGET_EMAIL = 'demo@worksideadvisor.com';

function parseArgs(argv = []) {
  const parsed = {
    sourceEmail: DEFAULT_SOURCE_EMAIL,
    targetEmail: DEFAULT_TARGET_EMAIL,
  };

  for (const arg of argv) {
    if (arg.startsWith('--source=')) {
      parsed.sourceEmail = arg.slice('--source='.length).trim().toLowerCase();
    } else if (arg.startsWith('--target=')) {
      parsed.targetEmail = arg.slice('--target='.length).trim().toLowerCase();
    }
  }

  return parsed;
}

function cloneDocument(document, overrides = {}) {
  const plain = document?.toObject ? document.toObject() : { ...(document || {}) };
  delete plain._id;
  delete plain.__v;
  delete plain.createdAt;
  delete plain.updatedAt;
  return {
    ...plain,
    ...overrides,
  };
}

function toIdString(value) {
  return value?._id?.toString?.() || value?.toString?.() || String(value || '');
}

async function cloneMediaAssets(propertyId, nextPropertyId) {
  const sourceAssets = await MediaAssetModel.find({ propertyId }).sort({ createdAt: 1 });
  const assetIdMap = new Map();

  for (const sourceAsset of sourceAssets) {
    const { buffer } = await readStoredAsset({
      storageProvider: sourceAsset.storageProvider,
      storageKey: sourceAsset.storageKey,
    });
    const storedImage = await saveBinaryBuffer({
      propertyId: nextPropertyId.toString(),
      mimeType: sourceAsset.mimeType,
      buffer,
    });

    const clonedAsset = await MediaAssetModel.create({
      ...cloneDocument(sourceAsset, {
        propertyId: nextPropertyId,
        storageProvider: storedImage.storageProvider,
        storageKey: storedImage.storageKey,
        byteSize: storedImage.byteSize,
      }),
      imageUrl: '',
    });

    clonedAsset.imageUrl = buildMediaAssetUrl(clonedAsset._id.toString());
    await clonedAsset.save();

    assetIdMap.set(sourceAsset._id.toString(), clonedAsset._id);
  }

  return assetIdMap;
}

async function cloneImageJobs(propertyId, nextPropertyId, assetIdMap) {
  const sourceJobs = await ImageJobModel.find({ propertyId }).sort({ createdAt: 1 });
  const jobIdMap = new Map();

  for (const sourceJob of sourceJobs) {
    const clonedJob = await ImageJobModel.create({
      ...cloneDocument(sourceJob, {
        propertyId: nextPropertyId,
        mediaId: assetIdMap.get(toIdString(sourceJob.mediaId)) || null,
        selectedVariantId: null,
        outputVariantIds: [],
      }),
    });

    jobIdMap.set(sourceJob._id.toString(), clonedJob._id);
  }

  return jobIdMap;
}

async function cloneMediaVariants(propertyId, nextPropertyId, assetIdMap, jobIdMap) {
  const sourceVariants = await MediaVariantModel.find({ propertyId }).sort({ createdAt: 1 });
  const variantIdMap = new Map();

  for (const sourceVariant of sourceVariants) {
    const { buffer } = await readStoredAsset({
      storageProvider: sourceVariant.storageProvider,
      storageKey: sourceVariant.storageKey,
    });
    const storedImage = await saveBinaryBuffer({
      propertyId: nextPropertyId.toString(),
      mimeType: sourceVariant.mimeType,
      buffer,
    });

    const clonedVariant = await MediaVariantModel.create({
      ...cloneDocument(sourceVariant, {
        propertyId: nextPropertyId,
        mediaId: assetIdMap.get(toIdString(sourceVariant.mediaId)) || null,
        visionJobId: sourceVariant.visionJobId
          ? jobIdMap.get(toIdString(sourceVariant.visionJobId)) || null
          : null,
        storageProvider: storedImage.storageProvider,
        storageKey: storedImage.storageKey,
        byteSize: storedImage.byteSize,
      }),
    });

    variantIdMap.set(sourceVariant._id.toString(), clonedVariant._id);
  }

  for (const sourceJob of await ImageJobModel.find({ propertyId }).sort({ createdAt: 1 })) {
    const nextJobId = jobIdMap.get(sourceJob._id.toString());
    if (!nextJobId) {
      continue;
    }

    await ImageJobModel.updateOne(
      { _id: nextJobId },
      {
        $set: {
          selectedVariantId: sourceJob.selectedVariantId
            ? variantIdMap.get(toIdString(sourceJob.selectedVariantId)) || null
            : null,
          outputVariantIds: (sourceJob.outputVariantIds || [])
            .map((variantId) => variantIdMap.get(toIdString(variantId)))
            .filter(Boolean),
        },
      },
    );
  }

  return variantIdMap;
}

async function clonePropertyCollections({
  sourceUser,
  targetUser,
  propertyIdMap,
  assetIdMapByProperty,
  variantIdMapByProperty,
  jobIdMapByProperty,
}) {
  const sourcePropertyIds = [...propertyIdMap.keys()].map((value) => new mongoose.Types.ObjectId(value));

  const [checklists, pricingAnalyses, flyers, reports, savedProviders, providerReferences, leadRequests] =
    await Promise.all([
      ChecklistModel.find({ propertyId: { $in: sourcePropertyIds } }),
      PricingAnalysisModel.find({ propertyId: { $in: sourcePropertyIds } }),
      FlyerModel.find({ propertyId: { $in: sourcePropertyIds } }),
      ReportModel.find({ propertyId: { $in: sourcePropertyIds } }),
      SavedProviderModel.find({ propertyId: { $in: sourcePropertyIds }, userId: sourceUser._id }),
      ProviderReferenceModel.find({ propertyId: { $in: sourcePropertyIds }, userId: sourceUser._id }),
      LeadRequestModel.find({ propertyId: { $in: sourcePropertyIds }, userId: sourceUser._id }),
    ]);

  for (const checklist of checklists) {
    await ChecklistModel.create(
      cloneDocument(checklist, {
        propertyId: propertyIdMap.get(toIdString(checklist.propertyId)),
      }),
    );
  }

  for (const pricingAnalysis of pricingAnalyses) {
    await PricingAnalysisModel.create(
      cloneDocument(pricingAnalysis, {
        propertyId: propertyIdMap.get(toIdString(pricingAnalysis.propertyId)),
      }),
    );
  }

  for (const flyer of flyers) {
    const propertyKey = toIdString(flyer.propertyId);
    const nextPropertyId = propertyIdMap.get(propertyKey);
    const assetMap = assetIdMapByProperty.get(propertyKey) || new Map();
    const variantMap = variantIdMapByProperty.get(propertyKey) || new Map();

    await FlyerModel.create(
      cloneDocument(flyer, {
        propertyId: nextPropertyId,
        selectedPhotos: (flyer.selectedPhotos || []).map((photo) => ({
          ...photo,
          assetId: photo.assetId ? assetMap.get(toIdString(photo.assetId)) || null : null,
        })),
      }),
    );
  }

  for (const report of reports) {
    const propertyKey = toIdString(report.propertyId);
    const nextPropertyId = propertyIdMap.get(propertyKey);
    const assetMap = assetIdMapByProperty.get(propertyKey) || new Map();

    await ReportModel.create(
      cloneDocument(report, {
        propertyId: nextPropertyId,
        selectedPhotos: (report.selectedPhotos || []).map((photo) => ({
          ...photo,
          assetId: photo.assetId ? assetMap.get(toIdString(photo.assetId)) || null : null,
        })),
      }),
    );
  }

  for (const savedProvider of savedProviders) {
    await SavedProviderModel.create(
      cloneDocument(savedProvider, {
        propertyId: propertyIdMap.get(toIdString(savedProvider.propertyId)),
        userId: targetUser._id,
      }),
    );
  }

  for (const providerReference of providerReferences) {
    await ProviderReferenceModel.create(
      cloneDocument(providerReference, {
        propertyId: propertyIdMap.get(toIdString(providerReference.propertyId)),
        userId: targetUser._id,
      }),
    );
  }

  const leadRequestIdMap = new Map();
  for (const leadRequest of leadRequests) {
    const clonedLeadRequest = await LeadRequestModel.create(
      cloneDocument(leadRequest, {
        propertyId: propertyIdMap.get(toIdString(leadRequest.propertyId)),
        userId: targetUser._id,
      }),
    );
    leadRequestIdMap.set(leadRequest._id.toString(), clonedLeadRequest._id);
  }

  const sourceLeadRequestIds = [...leadRequestIdMap.keys()].map((value) => new mongoose.Types.ObjectId(value));
  const [leadDispatches, providerResponses, smsLogs] = await Promise.all([
    LeadDispatchModel.find({ leadRequestId: { $in: sourceLeadRequestIds } }),
    ProviderResponseModel.find({ leadRequestId: { $in: sourceLeadRequestIds } }),
    ProviderSmsLogModel.find({ leadRequestId: { $in: sourceLeadRequestIds } }),
  ]);

  const leadDispatchIdMap = new Map();
  for (const leadDispatch of leadDispatches) {
    const clonedDispatch = await LeadDispatchModel.create(
      cloneDocument(leadDispatch, {
        leadRequestId: leadRequestIdMap.get(toIdString(leadDispatch.leadRequestId)),
      }),
    );
    leadDispatchIdMap.set(leadDispatch._id.toString(), clonedDispatch._id);
  }

  for (const response of providerResponses) {
    await ProviderResponseModel.create(
      cloneDocument(response, {
        leadRequestId: leadRequestIdMap.get(toIdString(response.leadRequestId)),
      }),
    );
  }

  for (const smsLog of smsLogs) {
    await ProviderSmsLogModel.create(
      cloneDocument(smsLog, {
        leadRequestId: smsLog.leadRequestId
          ? leadRequestIdMap.get(toIdString(smsLog.leadRequestId)) || null
          : null,
        leadDispatchId: smsLog.leadDispatchId
          ? leadDispatchIdMap.get(toIdString(smsLog.leadDispatchId)) || null
          : null,
      }),
    );
  }
}

async function cloneUserLevelCollections(sourceUser, targetUser, propertyIdMap) {
  const [usageRecords, publicEvents, billingSubscriptions] = await Promise.all([
    UsageTrackingModel.find({ userId: sourceUser._id }),
    PublicFunnelEventModel.find({
      $or: [{ userId: sourceUser._id }, { email: sourceUser.email }],
    }),
    BillingSubscriptionModel.find({ userId: sourceUser._id }),
  ]);

  for (const usageRecord of usageRecords) {
    await UsageTrackingModel.create(
      cloneDocument(usageRecord, {
        userId: targetUser._id,
        analyzedPropertyIds: (usageRecord.analyzedPropertyIds || []).map(
          (propertyId) => propertyIdMap.get(String(propertyId))?.toString() || String(propertyId),
        ),
      }),
    );
  }

  for (const publicEvent of publicEvents) {
    const nextPropertyId = publicEvent.propertyId
      ? propertyIdMap.get(toIdString(publicEvent.propertyId)) || null
      : null;

    await PublicFunnelEventModel.create(
      cloneDocument(publicEvent, {
        userId: targetUser._id,
        propertyId: nextPropertyId,
        email: targetUser.email,
      }),
    );
  }

  for (const subscription of billingSubscriptions) {
    await BillingSubscriptionModel.create(
      cloneDocument(subscription, {
        userId: targetUser._id,
        stripeCustomerId: null,
        stripeCheckoutSessionId: null,
        stripeSubscriptionId: null,
        stripeInvoiceId: null,
        rawStripeObject: null,
        metadata: {
          ...(subscription.metadata || {}),
          clonedFromUserId: sourceUser._id.toString(),
          clonedAt: new Date().toISOString(),
        },
      }),
    );
  }
}

async function run() {
  const { sourceEmail, targetEmail } = parseArgs(process.argv.slice(2));
  if (sourceEmail === targetEmail) {
    throw new Error('Source and target emails must be different.');
  }

  const connected = await connectToDatabase();
  if (!connected) {
    throw new Error('Could not connect to MongoDB.');
  }

  const sourceUser = await UserModel.findOne({ email: sourceEmail });
  if (!sourceUser) {
    throw new Error(`Source account not found for ${sourceEmail}.`);
  }

  const existingTarget = await UserModel.findOne({ email: targetEmail });
  if (existingTarget) {
    await purgeUserAccount(existingTarget._id, { allowDemoAccount: true });
  }

  const targetUser = await UserModel.create({
    email: targetEmail,
    passwordHash: sourceUser.passwordHash,
    firstName: sourceUser.firstName,
    lastName: sourceUser.lastName,
    role: sourceUser.role,
    isDemoAccount: false,
    isBillingBypass: true,
    stripeCustomerId: null,
    emailVerifiedAt: sourceUser.emailVerifiedAt || new Date(),
    verificationOtp: null,
    lastLoginAt: sourceUser.lastLoginAt || null,
    signupAttribution: sourceUser.signupAttribution || null,
  });

  const sourceProperties = await PropertyModel.find({ ownerUserId: sourceUser._id }).sort({ createdAt: 1 });
  const propertyIdMap = new Map();
  const assetIdMapByProperty = new Map();
  const variantIdMapByProperty = new Map();
  const jobIdMapByProperty = new Map();

  for (const sourceProperty of sourceProperties) {
    const clonedProperty = await PropertyModel.create(
      cloneDocument(sourceProperty, {
        ownerUserId: targetUser._id,
      }),
    );
    propertyIdMap.set(sourceProperty._id.toString(), clonedProperty._id);

    const assetMap = await cloneMediaAssets(sourceProperty._id, clonedProperty._id);
    const jobMap = await cloneImageJobs(sourceProperty._id, clonedProperty._id, assetMap);
    const variantMap = await cloneMediaVariants(
      sourceProperty._id,
      clonedProperty._id,
      assetMap,
      jobMap,
    );

    assetIdMapByProperty.set(sourceProperty._id.toString(), assetMap);
    jobIdMapByProperty.set(sourceProperty._id.toString(), jobMap);
    variantIdMapByProperty.set(sourceProperty._id.toString(), variantMap);
  }

  await clonePropertyCollections({
    sourceUser,
    targetUser,
    propertyIdMap,
    assetIdMapByProperty,
    variantIdMapByProperty,
    jobIdMapByProperty,
  });
  await cloneUserLevelCollections(sourceUser, targetUser, propertyIdMap);

  console.log(`Cloned ${sourceEmail} into ${targetEmail}.`);
  console.log(`User ID: ${targetUser._id.toString()}`);
  console.log(`Properties cloned: ${sourceProperties.length}`);
  console.log('Workspace data copied with new media storage objects.');
  console.log('Stripe customer/subscription identities were intentionally not copied.');
}

run()
  .catch((error) => {
    console.error('');
    console.error('Failed to clone the demo account.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
