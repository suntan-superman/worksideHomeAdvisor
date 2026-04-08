import mongoose from 'mongoose';

const visionVariantTypes = [
  'enhance_listing_quality',
  'declutter_preview',
  'declutter_light',
  'declutter_medium',
  'remove_furniture',
  'combined_listing_refresh',
];

const mediaVariantSchema = new mongoose.Schema(
  {
    visionJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageJob',
      default: null,
      index: true,
    },
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
    variantType: {
      type: String,
      enum: visionVariantTypes,
      required: true,
    },
    variantCategory: {
      type: String,
      enum: ['enhancement', 'concept_preview'],
      default: 'enhancement',
    },
    label: { type: String, required: true },
    mimeType: { type: String, default: 'image/jpeg' },
    storageProvider: { type: String, default: 'local' },
    storageKey: { type: String, required: true },
    byteSize: { type: Number },
    isSelected: { type: Boolean, default: false },
    lifecycleState: {
      type: String,
      enum: ['temporary', 'selected'],
      default: 'temporary',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    selectedAt: {
      type: Date,
      default: null,
    },
    useInBrochure: { type: Boolean, default: false },
    useInReport: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'mediaVariants',
  },
);

mediaVariantSchema.index({ mediaId: 1, createdAt: -1 });
mediaVariantSchema.index({ isSelected: 1, expiresAt: 1, createdAt: 1 });

export const MediaVariantModel =
  mongoose.models.MediaVariant || mongoose.model('MediaVariant', mediaVariantSchema);
