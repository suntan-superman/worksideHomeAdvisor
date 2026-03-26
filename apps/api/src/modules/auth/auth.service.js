import bcrypt from 'bcryptjs';

import { env } from '../../config/env.js';
import { sendOtpEmail } from '../../services/emailService.js';
import { signSessionToken } from '../../services/sessionService.js';
import { UserModel } from './auth.model.js';

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
  await sendOtpEmail({ to: user.email, code });
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
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        firstName: user.firstName,
      lastName: user.lastName,
    },
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

  return {
    token: signSessionToken(user),
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}
