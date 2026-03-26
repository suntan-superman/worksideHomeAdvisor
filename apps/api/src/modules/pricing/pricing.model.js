import mongoose from 'mongoose';

const compSnapshotSchema = new mongoose.Schema(
  {
    externalId: { type: String },
    address: { type: String, required: true },
    price: { type: Number, required: true },
    sqft: { type: Number },
    beds: { type: Number },
    baths: { type: Number },
    pricePerSqft: { type: Number },
    distanceMiles: { type: Number },
    saleDate: { type: String },
    daysOnMarket: { type: Number },
    propertyType: { type: String },
    listingType: { type: String },
    score: { type: Number },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const pricingAnalysisSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    source: { type: String, required: true },
    usedLiveData: { type: Boolean, default: false },
    cacheKey: { type: String },
    avm: { type: mongoose.Schema.Types.Mixed },
    subjectSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    selectedComps: { type: [compSnapshotSchema], default: [] },
    medianPricePerSqft: { type: Number, required: true },
    recommendedListLow: { type: Number, required: true },
    recommendedListMid: { type: Number, required: true },
    recommendedListHigh: { type: Number, required: true },
    variance: { type: Number, required: true },
    confidenceScore: { type: Number, required: true },
    strengths: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    summary: { type: String, required: true },
    pricingStrategy: { type: String, required: true },
    warning: { type: String },
    rawAnalysis: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'pricingAnalyses',
  },
);

pricingAnalysisSchema.index({ propertyId: 1, createdAt: -1 });

export const PricingAnalysisModel =
  mongoose.models.PricingAnalysis ||
  mongoose.model('PricingAnalysis', pricingAnalysisSchema);
