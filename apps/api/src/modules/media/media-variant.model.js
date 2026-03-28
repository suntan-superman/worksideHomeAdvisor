import mongoose from 'mongoose';

const mediaVariantSchema = new mongoose.Schema(
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
    variantType: {
      type: String,
      enum: ['enhance_listing_quality', 'declutter_preview'],
      required: true,
    },
    label: { type: String, required: true },
    mimeType: { type: String, default: 'image/jpeg' },
    storageProvider: { type: String, default: 'local' },
    storageKey: { type: String, required: true },
    byteSize: { type: Number },
    isSelected: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'mediaVariants',
  },
);

mediaVariantSchema.index({ mediaId: 1, createdAt: -1 });

export const MediaVariantModel =
  mongoose.models.MediaVariant || mongoose.model('MediaVariant', mediaVariantSchema);
