import mongoose from 'mongoose';

const reportPhotoSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    roomLabel: { type: String },
    imageUrl: { type: String },
    score: { type: Number },
    listingCandidate: { type: Boolean, default: false },
    listingNote: { type: String, default: '' },
    usesPreferredVariant: { type: Boolean, default: false },
    variantLabel: { type: String, default: '' },
    variantType: { type: String, default: '' },
  },
  { _id: false },
);

const reportCompSchema = new mongoose.Schema(
  {
    address: { type: String },
    price: { type: Number },
    beds: { type: Number },
    baths: { type: Number },
    sqft: { type: Number },
    distanceMiles: { type: Number },
    score: { type: Number },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    reportType: {
      type: String,
      enum: ['seller_intelligence_report'],
      default: 'seller_intelligence_report',
    },
    status: {
      type: String,
      enum: ['completed'],
      default: 'completed',
    },
    reportVersion: {
      type: Number,
      default: 2,
    },
    title: { type: String, required: true },
    executiveSummary: { type: String, required: true },
    pricingSummary: {
      low: { type: Number },
      mid: { type: Number },
      high: { type: Number },
      confidence: { type: Number },
      narrative: { type: String, default: '' },
    },
    selectedComps: { type: [reportCompSchema], default: [] },
    selectedPhotos: { type: [reportPhotoSchema], default: [] },
    checklistItems: { type: [String], default: [] },
    improvementItems: { type: [String], default: [] },
    marketingHighlights: { type: [String], default: [] },
    disclaimer: { type: String, required: true },
    source: { type: String, default: 'system' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'reports',
  },
);

reportSchema.index({ propertyId: 1, createdAt: -1 });

export const ReportModel =
  mongoose.models.Report || mongoose.model('Report', reportSchema);
