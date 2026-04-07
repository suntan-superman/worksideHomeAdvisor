import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { normalizeLandingAttribution, normalizeUsPhoneToE164 } from '@workside/utils';

import { env } from '../../config/env.js';
import {
  sendOtpEmail,
  sendPasswordResetOtpEmail,
  sendWelcomeEmail,
} from '../../services/emailService.js';
import { signSessionToken } from '../../services/sessionService.js';
import {
  sendRegistrationConfirmationSms,
} from '../marketplace-sms/marketplace-sms.service.js';
import { SmsLogModel } from '../marketplace-sms/sms-log.model.js';
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
import { PasswordResetTokenModel } from './password-reset-token.model.js';

function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    isDemoAccount: Boolean(user.isDemoAccount),
    isBillingBypass: Boolean(user.isBillingBypass),
    mobilePhone: user.mobilePhone || '',
    smsOptIn: Boolean(user.smsOptIn),
    smsOptInAt: user.smsOptInAt || null,
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

function buildPasswordResetSessionToken(tokenDocument) {
  return jwt.sign(
    {
      sub: tokenDocument.userId.toString(),
      email: tokenDocument.email,
      resetTokenId: tokenDocument._id.toString(),
      purpose: 'password_reset',
    },
    env.JWT_SECRET,
    { expiresIn: `${env.PASSWORD_RESET_SESSION_TTL_MINUTES}m` },
  );
}

function verifyPasswordResetSessionToken(resetToken) {
  const payload = jwt.verify(resetToken, env.JWT_SECRET);
  if (payload?.purpose !== 'password_reset' || !payload?.resetTokenId) {
    throw createHttpError(401, 'Password reset session is invalid.');
  }
  return payload;
}

function normalizePhonePayload({ mobilePhone = '', smsOptIn = false } = {}) {
  const normalizedPhone = normalizeUsPhoneToE164(mobilePhone);
  if (smsOptIn && !normalizedPhone) {
    throw createHttpError(400, 'A valid US mobile number is required when SMS opt-in is enabled.');
  }

  return {
    mobilePhone: normalizedPhone,
    smsOptIn: Boolean(smsOptIn && normalizedPhone),
    smsOptInAt: smsOptIn && normalizedPhone ? new Date() : null,
  };
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

async function invalidatePasswordResetTokensForUser(userId, excludeId = null) {
  if (!userId) {
    return;
  }

  const updateFilter = {
    userId,
    usedAt: null,
    invalidatedAt: null,
  };

  if (excludeId) {
    updateFilter._id = { $ne: excludeId };
  }

  await PasswordResetTokenModel.updateMany(
    updateFilter,
    {
      $set: {
        invalidatedAt: new Date(),
      },
    },
  );
}

async function requestPasswordResetToken(user) {
  await invalidatePasswordResetTokensForUser(user._id);

  const code = buildOtpCode();
  const otpHash = await bcrypt.hash(code, env.BCRYPT_SALT_ROUNDS);
  const token = await PasswordResetTokenModel.create({
    userId: user._id,
    email: user.email,
    otpHash,
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000),
    attemptCount: 0,
  });

  await sendPasswordResetOtpEmail({
    to: user.email,
    code,
  });

  return token;
}

async function getLatestActivePasswordResetToken(email) {
  return PasswordResetTokenModel.findOne({
    email: String(email || '').toLowerCase(),
    usedAt: null,
    invalidatedAt: null,
  }).sort({ createdAt: -1 });
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
    SmsLogModel.deleteMany({ propertyId: { $in: propertyIds } }),
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
    PasswordResetTokenModel.deleteMany({ userId: user._id }),
    SmsLogModel.deleteMany({ userId: user._id }),
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

  const normalizedPhone = normalizePhonePayload({
    mobilePhone: payload.mobilePhone,
    smsOptIn: payload.smsOptIn,
  });

  const user = await UserModel.create({
    email: payload.email.toLowerCase(),
    passwordHash,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role || 'seller',
    mobilePhone: normalizedPhone.mobilePhone,
    smsOptIn: normalizedPhone.smsOptIn,
    smsOptInAt: normalizedPhone.smsOptInAt,
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

export async function requestForgotPasswordOtp(email) {
  const normalizedEmail = String(email || '').toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail });
  if (!user) {
    return { sent: true };
  }

  await requestPasswordResetToken(user);
  return { sent: true };
}

export async function verifyForgotPasswordOtp(payload) {
  const resetToken = await getLatestActivePasswordResetToken(payload.email);
  if (!resetToken) {
    throw createHttpError(404, 'Password reset code not found.');
  }

  if (resetToken.usedAt || resetToken.invalidatedAt) {
    throw createHttpError(400, 'Password reset code is no longer valid.');
  }

  if (resetToken.expiresAt < new Date()) {
    resetToken.invalidatedAt = new Date();
    await resetToken.save();
    throw createHttpError(400, 'Password reset code expired.');
  }

  if (resetToken.attemptCount >= 5) {
    resetToken.invalidatedAt = resetToken.invalidatedAt || new Date();
    await resetToken.save();
    throw createHttpError(429, 'Too many password reset attempts. Request a new code.');
  }

  const valid = await bcrypt.compare(payload.otpCode, resetToken.otpHash);
  if (!valid) {
    resetToken.attemptCount += 1;
    if (resetToken.attemptCount >= 5) {
      resetToken.invalidatedAt = new Date();
    }
    await resetToken.save();
    throw createHttpError(400, 'Password reset code is invalid.');
  }

  resetToken.verifiedAt = new Date();
  await resetToken.save();

  return {
    resetToken: buildPasswordResetSessionToken(resetToken),
    expiresInMinutes: env.PASSWORD_RESET_SESSION_TTL_MINUTES,
  };
}

export async function resetForgottenPassword({
  resetToken,
  newPassword,
  confirmPassword = '',
}) {
  if (confirmPassword && newPassword !== confirmPassword) {
    throw createHttpError(400, 'Passwords do not match.');
  }

  const payload = verifyPasswordResetSessionToken(resetToken);
  const tokenDocument = await PasswordResetTokenModel.findById(payload.resetTokenId);
  if (!tokenDocument) {
    throw createHttpError(404, 'Password reset session not found.');
  }

  if (tokenDocument.usedAt || tokenDocument.invalidatedAt) {
    throw createHttpError(400, 'Password reset session is no longer valid.');
  }

  if (!tokenDocument.verifiedAt) {
    throw createHttpError(400, 'Password reset code must be verified before setting a new password.');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || user.email.toLowerCase() !== tokenDocument.email.toLowerCase()) {
    throw createHttpError(404, 'User account not found.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  user.lastLoginAt = new Date();
  await user.save();

  tokenDocument.usedAt = new Date();
  await tokenDocument.save();
  await invalidatePasswordResetTokensForUser(user._id, tokenDocument._id);

  return {
    token: signSessionToken(user),
    user: serializeUser(user),
  };
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
  if (user.smsOptIn && user.mobilePhone) {
    await sendRegistrationConfirmationSms(user).catch(() => null);
  }

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

export async function getAuthenticatedUser(userId) {
  if (mongoose.connection.readyState !== 1) {
    throw createHttpError(503, 'Database connection is required to load account details.');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError(404, 'User account not found.');
  }

  return serializeUser(user);
}

export async function updateAuthenticatedUser(userId, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw createHttpError(503, 'Database connection is required to update account details.');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError(404, 'User account not found.');
  }

  if (typeof payload.firstName === 'string') {
    user.firstName = payload.firstName.trim();
  }

  if (typeof payload.lastName === 'string') {
    user.lastName = payload.lastName.trim();
  }

  if (payload.mobilePhone !== undefined || payload.smsOptIn !== undefined) {
    const normalizedPhone = normalizePhonePayload({
      mobilePhone: payload.mobilePhone !== undefined ? payload.mobilePhone : user.mobilePhone,
      smsOptIn: payload.smsOptIn !== undefined ? payload.smsOptIn : user.smsOptIn,
    });

    user.mobilePhone = normalizedPhone.mobilePhone;
    user.smsOptIn = normalizedPhone.smsOptIn;
    user.smsOptInAt = normalizedPhone.smsOptIn ? (user.smsOptInAt || normalizedPhone.smsOptInAt) : null;
  }

  await user.save();
  return serializeUser(user);
}
