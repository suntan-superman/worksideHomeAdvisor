import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { PasswordResetTokenModel } from './password-reset-token.model.js';
import { UserModel } from './auth.model.js';
import {
  authServiceDependencies,
  updateAuthenticatedUser,
  verifyForgotPasswordOtp,
} from './auth.service.js';

function setReadyState(value) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value,
  });
}

test('verifyForgotPasswordOtp verifies a valid reset code and returns a reset session token', async (t) => {
  const tokenDocument = {
    _id: 'reset-token-1',
    userId: 'user-1',
    email: 'seller@example.com',
    usedAt: null,
    invalidatedAt: null,
    verifiedAt: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attemptCount: 0,
    async save() {
      return this;
    },
  };

  t.mock.method(PasswordResetTokenModel, 'findOne', () => ({
    sort: async () => tokenDocument,
  }));
  t.mock.method(authServiceDependencies, 'bcryptCompare', async () => true);

  const result = await verifyForgotPasswordOtp({
    email: 'seller@example.com',
    otpCode: '123456',
  });

  assert.equal(typeof result.resetToken, 'string');
  assert.ok(result.resetToken.length > 20);
  assert.equal(result.expiresInMinutes > 0, true);
  assert.ok(tokenDocument.verifiedAt instanceof Date);
});

test('verifyForgotPasswordOtp invalidates the token after too many wrong attempts', async (t) => {
  const tokenDocument = {
    _id: 'reset-token-2',
    userId: 'user-1',
    email: 'seller@example.com',
    usedAt: null,
    invalidatedAt: null,
    verifiedAt: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attemptCount: 4,
    async save() {
      return this;
    },
  };

  t.mock.method(PasswordResetTokenModel, 'findOne', () => ({
    sort: async () => tokenDocument,
  }));
  t.mock.method(authServiceDependencies, 'bcryptCompare', async () => false);

  await assert.rejects(
    () =>
      verifyForgotPasswordOtp({
        email: 'seller@example.com',
        otpCode: '999999',
      }),
    /Password reset code is invalid\./,
  );

  assert.equal(tokenDocument.attemptCount, 5);
  assert.ok(tokenDocument.invalidatedAt instanceof Date);
});

test('updateAuthenticatedUser trims names and preserves existing smsOptInAt when sms stays enabled', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  const optedInAt = new Date('2026-04-01T10:00:00.000Z');
  const user = {
    _id: 'user-1',
    email: 'seller@example.com',
    role: 'seller',
    firstName: 'Old',
    lastName: 'Name',
    isDemoAccount: false,
    isBillingBypass: false,
    mobilePhone: '+16615551212',
    smsOptIn: true,
    smsOptInAt: optedInAt,
    signupAttribution: null,
    async save() {
      return this;
    },
  };

  t.mock.method(UserModel, 'findById', async () => user);

  const result = await updateAuthenticatedUser('user-1', {
    firstName: '  Demo  ',
    lastName: '  Seller ',
    mobilePhone: '(661) 555-3434',
    smsOptIn: true,
  });

  assert.equal(user.firstName, 'Demo');
  assert.equal(user.lastName, 'Seller');
  assert.equal(user.mobilePhone, '+16615553434');
  assert.equal(user.smsOptIn, true);
  assert.equal(user.smsOptInAt, optedInAt);
  assert.equal(result.firstName, 'Demo');
  assert.equal(result.mobilePhone, '+16615553434');
});

test('updateAuthenticatedUser rejects sms opt-in without a valid mobile number', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  const user = {
    _id: 'user-1',
    email: 'seller@example.com',
    role: 'seller',
    firstName: 'Demo',
    lastName: 'Seller',
    isDemoAccount: false,
    isBillingBypass: false,
    mobilePhone: '',
    smsOptIn: false,
    smsOptInAt: null,
    signupAttribution: null,
    async save() {
      return this;
    },
  };

  t.mock.method(UserModel, 'findById', async () => user);

  await assert.rejects(
    () =>
      updateAuthenticatedUser('user-1', {
        mobilePhone: 'not-a-phone',
        smsOptIn: true,
      }),
    /A valid US mobile number is required when SMS opt-in is enabled\./,
  );
});
