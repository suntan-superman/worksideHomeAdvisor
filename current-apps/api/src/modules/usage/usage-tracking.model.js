import mongoose from 'mongoose';

const usageTrackingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    billingCycleKey: { type: String, required: true, index: true },
    planCode: { type: String, required: true },
    analyzedPropertyIds: { type: [String], default: [] },
    pricingRunsTotal: { type: Number, default: 0 },
    pricingCacheHits: { type: Number, default: 0 },
    photoAnalysisRuns: { type: Number, default: 0 },
    flyersGenerated: { type: Number, default: 0 },
    flyerCacheHits: { type: Number, default: 0 },
    documentGenerations: { type: Number, default: 0 },
    deniedRequests: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'usageTracking',
  },
);

usageTrackingSchema.index({ userId: 1, billingCycleKey: 1 }, { unique: true });

export const UsageTrackingModel =
  mongoose.models.UsageTracking || mongoose.model('UsageTracking', usageTrackingSchema);
