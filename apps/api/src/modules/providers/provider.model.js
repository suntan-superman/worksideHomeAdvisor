import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema(
  {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCodes: { type: [String], default: [] },
    radiusMiles: { type: Number, default: 25 },
  },
  { _id: false },
);

const leadRoutingSchema = new mongoose.Schema(
  {
    deliveryMode: {
      type: String,
      enum: ['sms', 'email', 'sms_and_email'],
      default: 'sms_and_email',
    },
    notifyPhone: { type: String, default: '' },
    notifyPhoneNormalized: { type: String, default: '', index: true },
    notifyEmail: { type: String, default: '' },
    preferredContactMethod: {
      type: String,
      enum: ['sms', 'email', 'phone'],
      default: 'sms',
    },
    smsOptOut: { type: Boolean, default: false, index: true },
    smsConsentAt: { type: Date, default: null },
  },
  { _id: false },
);

const providerSubscriptionSchema = new mongoose.Schema(
  {
    planCode: { type: String, default: 'provider_basic' },
    status: { type: String, default: 'inactive' },
    stripeCustomerId: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '' },
    stripePriceId: { type: String, default: '' },
  },
  { _id: false },
);

const providerSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    categoryKey: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    websiteUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'paused', 'pending', 'pending_billing', 'suspended'],
      default: 'pending',
      index: true,
    },
    isVerified: { type: Boolean, default: false, index: true },
    isSponsored: { type: Boolean, default: false, index: true },
    qualityScore: { type: Number, default: 60 },
    averageResponseMinutes: { type: Number, default: 120 },
    yearsInBusiness: { type: Number, default: null },
    serviceArea: { type: serviceAreaSchema, default: {} },
    leadRouting: { type: leadRoutingSchema, default: {} },
    subscription: { type: providerSubscriptionSchema, default: {} },
    onboardingSource: { type: String, default: 'admin' },
    outreachSource: { type: String, default: 'manual' },
    invitedAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    firstLeadSentAt: { type: Date, default: null },
    internalNotes: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'providers',
  },
);

providerSchema.index({ categoryKey: 1, status: 1, isSponsored: -1, qualityScore: -1 });
providerSchema.index({ 'serviceArea.city': 1, 'serviceArea.state': 1 });
providerSchema.index({ 'serviceArea.zipCodes': 1 });

const providerCategorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, unique: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    rolloutPhase: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'providerCategories',
  },
);

export const ProviderModel =
  mongoose.models.Provider || mongoose.model('Provider', providerSchema);

export const ProviderCategoryModel =
  mongoose.models.ProviderCategory ||
  mongoose.model('ProviderCategory', providerCategorySchema);
