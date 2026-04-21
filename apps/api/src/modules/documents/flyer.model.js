import mongoose from 'mongoose';

const flyerPhotoSchema = new mongoose.Schema(
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

const flyerSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    flyerType: { type: String, enum: ['sale', 'rental'], default: 'sale' },
    headline: { type: String, required: true },
    subheadline: { type: String, required: true },
    priceText: { type: String, default: '' },
    locationLine: { type: String, required: true },
    summary: { type: String, required: true },
    highlights: { type: [String], default: [] },
    selectedPhotos: { type: [flyerPhotoSchema], default: [] },
    mode: { type: String, enum: ['preview', 'launch_ready', 'premium'], default: 'launch_ready' },
    modeLabel: { type: String, default: '' },
    readinessScore: { type: Number, default: 0 },
    readinessSignals: { type: mongoose.Schema.Types.Mixed, default: {} },
    ctaMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    callToAction: { type: String, required: true },
    disclaimer: { type: String, required: true },
    customizations: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'fallback' },
    rawMarketing: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'flyers',
  },
);

export const FlyerModel = mongoose.models.Flyer || mongoose.model('Flyer', flyerSchema);
