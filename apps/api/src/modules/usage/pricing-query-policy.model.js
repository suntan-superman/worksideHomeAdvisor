import mongoose from 'mongoose';

export const PRICING_QUERY_POLICY_SINGLETON_KEY = 'pricing-analysis-criteria';

const pricingQueryPolicySchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: PRICING_QUERY_POLICY_SINGLETON_KEY,
    },
    pricingCooldownHours: {
      type: Number,
      required: true,
      default: 24,
      min: 0,
      max: 168,
    },
    maxRunsPerPropertyPerUser: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: 'pricingQueryPolicies',
  },
);

const pricingPropertyUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    propertyId: {
      type: String,
      required: true,
    },
    analysisType: {
      type: String,
      required: true,
      default: 'pricing',
    },
    freshRunsTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastFreshRunAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'pricingPropertyUsages',
  },
);

pricingPropertyUsageSchema.index(
  { userId: 1, propertyId: 1, analysisType: 1 },
  { unique: true },
);

export const PricingQueryPolicyModel =
  mongoose.models.PricingQueryPolicy ||
  mongoose.model('PricingQueryPolicy', pricingQueryPolicySchema);

export const PricingPropertyUsageModel =
  mongoose.models.PricingPropertyUsage ||
  mongoose.model('PricingPropertyUsage', pricingPropertyUsageSchema);
