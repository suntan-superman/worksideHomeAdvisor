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
