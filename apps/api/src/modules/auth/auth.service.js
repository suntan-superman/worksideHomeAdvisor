import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { normalizeLandingAttribution } from '@workside/utils';

import { env } from '../../config/env.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../services/emailService.js';
import { signSessionToken } from '../../services/sessionService.js';
import { BillingSubscriptionModel } from '../billing/billing.model.js';
import { FlyerModel } from '../documents/flyer.model.js';
import { ReportModel } from '../documents/report.model.js';
import { ImageJobModel } from '../media/image-job.model.js';
import { MediaAssetModel } from '../media/media.model.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import { deleteStoredAssetIfUnreferenced } from '../media/storage-reference.service.js';
import { PricingAnalysisModel } from '../pricing/pricing.model.js';
import { PropertyModel } from '../properties/property.model.js';
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
import { RateLimitEventModel } from '../usage/rate-limit.model.js';
import { UsageTrackingModel } from '../usage/usage-tracking.model.js';
import { recordPublicFunnelEvent } from '../public/public.service.js';
import { UserModel } from './auth.model.js';

function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    isDemoAccount: Boolean(user.isDemoAccount),
    isBillingBypass: Boolean(user.isBillingBypass),
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildOtpCode() {
  const min = 10 ** (env.OTP_LENGTH - 1);
  const max = 10 ** env.OTP_LENGTH - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function storeVerificationOtp(user) {
  const code = buildOtpCode();
  const codeHash = await bcrypt.hash(code, env.BCRYPT_SALT_ROUNDS);

  user.verificationOtp = {
    codeHash,
    expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
    attempts: 0,
  };

  await user.save();
  await sendOtpEmail({ to: user.email, code, role: user.role });
}

async function deleteUserOwnedProperties(propertyIds = []) {
  if (!propertyIds.length) {
    return { deletedPropertyCount: 0 };
  }

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
        await deleteStoredAssetIfUnreferenced({
          storageProvider: asset.storageProvider,
          storageKey: asset.storageKey,
          excludeAssetId: asset.kind === 'asset' ? asset._id : null,
          excludeVariantId: asset.kind === 'variant' ? asset._id : null,
        });
      } catch {
        // Continue deleting account data even if a file/object is already gone.
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
    ChecklistModel.deleteMany({ propertyId: { $in: propertyIds } }),
    SavedProviderModel.deleteMany({ propertyId: { $in: propertyIds } }),
    ProviderReferenceModel.deleteMany({ propertyId: { $in: propertyIds } }),
    PublicFunnelEventModel.deleteMany({ propertyId: { $in: propertyIds } }),
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

  return { deletedPropertyCount: propertyIds.length };
}

export async function purgeUserAccount(
  userId,
  { allowDemoAccount = false, allowAdminAccount = false } = {},
) {
  if (mongoose.connection.readyState !== 1) {
    throw createHttpError(503, 'Database connection is required to delete an account.');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError(404, 'User account not found.');
  }

  if (user.isDemoAccount && !allowDemoAccount) {
    throw createHttpError(403, 'Demo accounts cannot be deleted.');
  }

  if ((user.role === 'admin' || user.role === 'super_admin') && !allowAdminAccount) {
    throw createHttpError(403, 'Admin accounts cannot be deleted.');
  }

  const ownedProperties = await PropertyModel.find({ ownerUserId: user._id })
    .select({ _id: 1 })
    .lean();
  const propertyIds = ownedProperties.map((property) => property._id);
  const { deletedPropertyCount } = await deleteUserOwnedProperties(propertyIds);
  const remainingLeadRequests = await LeadRequestModel.find({ userId: user._id })
    .select({ _id: 1 })
    .lean();
  const remainingLeadRequestIds = remainingLeadRequests.map((request) => request._id);
  const remainingLeadDispatches = remainingLeadRequestIds.length
    ? await LeadDispatchModel.find({ leadRequestId: { $in: remainingLeadRequestIds } })
        .select({ _id: 1 })
        .lean()
    : [];
  const remainingLeadDispatchIds = remainingLeadDispatches.map((dispatch) => dispatch._id);

  if (remainingLeadRequestIds.length) {
    await Promise.all([
      ProviderResponseModel.deleteMany({ leadRequestId: { $in: remainingLeadRequestIds } }),
      ProviderSmsLogModel.deleteMany({
        $or: [
          { leadRequestId: { $in: remainingLeadRequestIds } },
          remainingLeadDispatchIds.length
            ? { leadDispatchId: { $in: remainingLeadDispatchIds } }
            : null,
        ].filter(Boolean),
      }),
      LeadDispatchModel.deleteMany({ leadRequestId: { $in: remainingLeadRequestIds } }),
      LeadRequestModel.deleteMany({ _id: { $in: remainingLeadRequestIds } }),
    ]);
  }

  await Promise.all([
    BillingSubscriptionModel.deleteMany({ userId: user._id }),
    UsageTrackingModel.deleteMany({ userId: user._id }),
    AnalysisLockModel.deleteMany({ userId: String(user._id) }),
    RateLimitEventModel.deleteMany({ userId: String(user._id) }),
    SavedProviderModel.deleteMany({ userId: user._id }),
    ProviderReferenceModel.deleteMany({ userId: user._id }),
    PublicFunnelEventModel.deleteMany({
      $or: [{ userId: user._id }, { email: user.email }],
    }),
    UserModel.deleteOne({ _id: user._id }),
  ]);

  return {
    deleted: true,
    deletedUserId: user._id.toString(),
    deletedPropertyCount,
  };
}

export async function signup(payload) {
  const existingUser = await UserModel.findOne({ email: payload.email.toLowerCase() });

  if (existingUser) {
    throw new Error('An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);

  const user = await UserModel.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role || 'seller',
    signupAttribution: payload.attribution
      ? normalizeLandingAttribution({
          ...payload.attribution,
          roleIntent: payload.role || 'seller',
        })
      : null,
  });

  await storeVerificationOtp(user);

  return {
    userId: user._id.toString(),
    email: user.email,
    requiresOtpVerification: true,
  };
}

export async function login(payload) {
  const user = await UserModel.findOne({ email: payload.email.toLowerCase() });
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);
  if (!passwordMatches) {
    throw new Error('Invalid email or password.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  if (!user.emailVerifiedAt) {
    await storeVerificationOtp(user);

    return {
      requiresOtpVerification: true,
      email: user.email,
    };
  }

  return {
    token: signSessionToken(user),
    user: serializeUser(user),
  };
}

export async function requestOtp(email) {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new Error('No user found for that email.');
  }

  await storeVerificationOtp(user);
  return { sent: true };
}

export async function verifyEmailOtp(payload) {
  const user = await UserModel.findOne({ email: payload.email.toLowerCase() });
  if (!user || !user.verificationOtp) {
    throw new Error('Verification code not found.');
  }

  if (user.verificationOtp.expiresAt < new Date()) {
    throw new Error('Verification code expired.');
  }

  const valid = await bcrypt.compare(payload.otpCode, user.verificationOtp.codeHash);
  if (!valid) {
    user.verificationOtp.attempts += 1;
    await user.save();
    throw new Error('Verification code is invalid.');
  }

  user.emailVerifiedAt = new Date();
  user.verificationOtp = null;
  await user.save();
  await sendWelcomeEmail({
    to: user.email,
    firstName: user.firstName,
    role: user.role,
  });

  if (user.signupAttribution) {
    await recordPublicFunnelEvent({
      eventName: 'signup_completed',
      anonymousId: user.signupAttribution.anonymousId,
      userId: user._id.toString(),
      email: user.email,
      attribution: user.signupAttribution,
      payload: {
        role: user.role,
      },
      sessionStage: 'signup_completed',
    });
  }

  return {
    token: signSessionToken(user),
    user: serializeUser(user),
  };
}

export async function deleteAccount(userId) {
  return purgeUserAccount(userId);
}
