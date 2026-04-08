import mongoose from 'mongoose';

const visionJobTypes = [
  'enhance_listing_quality',
  'declutter_preview',
  'declutter_light',
  'declutter_medium',
  'remove_furniture',
  'combined_listing_refresh',
];

const imageJobSchema = new mongoose.Schema(
  {
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: visionJobTypes,
      required: true,
    },
    jobCategory: {
      type: String,
      enum: ['enhancement', 'concept_preview'],
      default: 'enhancement',
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'processing',
    },
    provider: { type: String, default: 'local_sharp' },
    providerJobId: { type: String, default: null },
    presetKey: { type: String, default: null },
    roomType: { type: String, default: 'unknown' },
    promptVersion: { type: Number, default: 1 },
    inputHash: { type: String, default: null, index: true },
    selectedVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaVariant',
      default: null,
    },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputVariantIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'MediaVariant',
      default: [],
    },
    message: { type: String, default: '' },
    warning: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'imageJobs',
  },
);

imageJobSchema.index({ mediaId: 1, createdAt: -1 });
imageJobSchema.index({ mediaId: 1, inputHash: 1, createdAt: -1 });

export const ImageJobModel =
  mongoose.models.ImageJob || mongoose.model('ImageJob', imageJobSchema);
