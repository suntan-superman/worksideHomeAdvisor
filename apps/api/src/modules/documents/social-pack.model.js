import mongoose from 'mongoose';

const socialPhotoSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    roomLabel: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
  },
  { _id: false },
);

const socialVariantSchema = new mongoose.Schema(
  {
    format: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    guidance: { type: String, default: '' },
  },
  { _id: false },
);

const socialPackSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    headline: { type: String, required: true },
    primaryText: { type: String, required: true },
    shortCaption: { type: String, required: true },
    cta: { type: String, required: true },
    disclaimers: { type: [String], default: [] },
    selectedPhotos: { type: [socialPhotoSchema], default: [] },
    variants: { type: [socialVariantSchema], default: [] },
    markdown: { type: String, default: '' },
    source: { type: String, default: 'fallback' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'socialPacks',
  },
);

socialPackSchema.index({ propertyId: 1, createdAt: -1 });

export const SocialPackModel =
  mongoose.models.SocialPack || mongoose.model('SocialPack', socialPackSchema);
