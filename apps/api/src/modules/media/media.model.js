import mongoose from 'mongoose';

const photoAnalysisSnapshotSchema = new mongoose.Schema(
  {
    roomGuess: { type: String },
    overallQualityScore: { type: Number },
    lightingScore: { type: Number },
    compositionScore: { type: Number },
    clarityScore: { type: Number },
    bestUse: { type: String },
    issues: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    retakeRecommended: { type: Boolean },
    summary: { type: String },
    disclaimer: { type: String },
    source: { type: String },
    warning: { type: String },
  },
  { _id: false },
);

const mediaAssetSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    roomLabel: { type: String, required: true },
    source: {
      type: String,
      enum: ['mobile_capture', 'mobile_library', 'web_upload', 'third_party_import'],
      default: 'mobile_capture',
    },
    notes: { type: String, default: '' },
    mimeType: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    storageProvider: { type: String, default: 'local' },
    storageKey: { type: String },
    byteSize: { type: Number },
    imageUrl: { type: String },
    imageDataUrl: { type: String },
    listingCandidate: { type: Boolean, default: false },
    listingNote: { type: String, default: '' },
    uploadedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    analysis: { type: photoAnalysisSnapshotSchema, default: null },
  },
  {
    timestamps: true,
    collection: 'mediaAssets',
  },
);

mediaAssetSchema.index({ propertyId: 1, createdAt: -1 });

export const MediaAssetModel =
  mongoose.models.MediaAsset || mongoose.model('MediaAsset', mediaAssetSchema);
