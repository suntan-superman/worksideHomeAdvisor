import mongoose from 'mongoose';

const billingSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stripeCustomerId: { type: String, default: null, index: true },
    stripeCheckoutSessionId: { type: String, default: null, index: true, sparse: true },
    stripeSubscriptionId: { type: String, default: null, index: true, sparse: true },
    stripeInvoiceId: { type: String, default: null },
    productKey: { type: String, required: true },
    planKey: { type: String, required: true, index: true },
    audience: { type: String, enum: ['seller', 'agent'], required: true },
    mode: { type: String, enum: ['payment', 'subscription'], required: true },
    status: { type: String, required: true, default: 'pending' },
    isActive: { type: Boolean, default: false },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    features: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawStripeObject: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'subscriptions',
  },
);

export const BillingSubscriptionModel =
  mongoose.models.BillingSubscription ||
  mongoose.model('BillingSubscription', billingSubscriptionSchema);

const billingWebhookEventSchema = new mongoose.Schema(
  {
    stripeEventId: { type: String, default: '', index: true, sparse: true },
    type: { type: String, default: '', index: true },
    livemode: { type: Boolean, default: false },
    processingStatus: {
      type: String,
      enum: ['processed', 'failed'],
      default: 'processed',
      index: true,
    },
    stripeCreatedAt: { type: Date, default: null, index: true },
    stripeCustomerId: { type: String, default: '', index: true },
    stripeCheckoutSessionId: { type: String, default: '', index: true, sparse: true },
    stripeSubscriptionId: { type: String, default: '', index: true, sparse: true },
    stripeInvoiceId: { type: String, default: '', index: true, sparse: true },
    userId: { type: String, default: '', index: true },
    providerId: { type: String, default: '', index: true },
    planKey: { type: String, default: '', index: true },
    billingKind: { type: String, default: '' },
    eventObjectType: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    resultSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    rawStripeObject: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'billingWebhookEvents',
  },
);

export const BillingWebhookEventModel =
  mongoose.models.BillingWebhookEvent ||
  mongoose.model('BillingWebhookEvent', billingWebhookEventSchema);
