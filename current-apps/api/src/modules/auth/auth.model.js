import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

const attributionSchema = new mongoose.Schema(
  {
    anonymousId: { type: String, default: '' },
    platform: { type: String, default: '' },
    source: { type: String, default: '' },
    medium: { type: String, default: '' },
    campaign: { type: String, default: '' },
    adset: { type: String, default: '' },
    ad: { type: String, default: '' },
    route: { type: String, default: '' },
    landingPath: { type: String, default: '' },
    referrer: { type: String, default: '' },
    roleIntent: { type: String, default: '' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    role: {
      type: String,
      enum: ['seller', 'agent', 'provider', 'collaborator', 'admin', 'super_admin'],
      default: 'seller',
    },
    isDemoAccount: { type: Boolean, default: false, index: true },
    isBillingBypass: { type: Boolean, default: false },
    stripeCustomerId: { type: String, default: null, index: true },
    emailVerifiedAt: { type: Date, default: null },
    verificationOtp: { type: otpSchema, default: null },
    lastLoginAt: { type: Date, default: null },
    mobilePhone: { type: String, default: '' },
    smsOptIn: { type: Boolean, default: false },
    smsOptInAt: { type: Date, default: null },
    signupAttribution: { type: attributionSchema, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
