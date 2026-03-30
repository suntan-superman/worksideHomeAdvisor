import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { env } from '../../config/env.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../services/emailService.js';
import { deleteStoredAsset } from '../../services/storageService.js';
import { signSessionToken } from '../../services/sessionService.js';
import { BillingSubscriptionModel } from '../billing/billing.model.js';
import { FlyerModel } from '../documents/flyer.model.js';
import { MediaAssetModel } from '../media/media.model.js';
import { PricingAnalysisModel } from '../pricing/pricing.model.js';
import { PropertyModel } from '../properties/property.model.js';
import { AnalysisLockModel } from '../usage/analysis-lock.model.js';
import { RateLimitEventModel } from '../usage/rate-limit.model.js';
import { UsageTrackingModel } from '../usage/usage-tracking.model.js';
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

  return {
    token: signSessionToken(user),
    user: serializeUser(user),
  };
}

export async function deleteAccount(userId) {
  if (mongoose.connection.readyState !== 1) {
    throw createHttpError(503, 'Database connection is required to delete an account.');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw createHttpError(404, 'User account not found.');
  }

  if (user.isDemoAccount) {
    throw createHttpError(403, 'Demo accounts cannot be deleted.');
  }

  if (user.role === 'admin' || user.role === 'super_admin') {
    throw createHttpError(403, 'Admin accounts cannot be deleted.');
  }

  const ownedProperties = await PropertyModel.find({ ownerUserId: user._id }).select({ _id: 1 }).lean();
  const propertyIds = ownedProperties.map((property) => property._id);

  if (propertyIds.length) {
    const mediaAssets = await MediaAssetModel.find({ propertyId: { $in: propertyIds } })
      .select({ storageProvider: 1, storageKey: 1 })
      .lean();

    await Promise.all(
      mediaAssets.map(async (asset) => {
        try {
          await deleteStoredAsset({
            storageProvider: asset.storageProvider,
            storageKey: asset.storageKey,
          });
        } catch (storageError) {
          // Continue deleting account data even if a file/object is already gone.
        }
      }),
    );

    await MediaAssetModel.deleteMany({ propertyId: { $in: propertyIds } });
    await PricingAnalysisModel.deleteMany({ propertyId: { $in: propertyIds } });
    await FlyerModel.deleteMany({ propertyId: { $in: propertyIds } });
    await PropertyModel.deleteMany({ _id: { $in: propertyIds } });
  }

  await BillingSubscriptionModel.deleteMany({ userId: user._id });
  await UsageTrackingModel.deleteMany({ userId: user._id });
  await AnalysisLockModel.deleteMany({ userId: String(user._id) });
  await RateLimitEventModel.deleteMany({ userId: String(user._id) });
  await UserModel.deleteOne({ _id: user._id });

  return {
    deleted: true,
    deletedUserId: user._id.toString(),
    deletedPropertyCount: propertyIds.length,
  };
}
