import mongoose from 'mongoose';
import { getVisionPresetKeys } from './vision-presets.js';

const visionJobTypes = getVisionPresetKeys();

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
      enum: ['queued', 'processing', 'completed', 'failed', 'needs_user_action'],
      default: 'processing',
    },
    provider: { type: String, default: 'local_sharp' },
    providerJobId: { type: String, default: null },
    presetKey: { type: String, default: null },
    mode: {
      type: String,
      enum: ['preset', 'freeform'],
      default: 'preset',
    },
    instructions: { type: String, default: '' },
    normalizedPlan: { type: mongoose.Schema.Types.Mixed, default: null },
    originalUrl: { type: String, default: '' },
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
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 1 },
    currentStage: {
      type: String,
      enum: ['initial', 'conservative_retry', 'split_retry', 'fallback', 'guided_selection', 'completed'],
      default: 'initial',
    },
    fallbackMode: {
      type: String,
      enum: ['declutter_lite', 'visual_cleanup', 'guided_selection', 'partial_success', null],
      default: null,
    },
    failureReason: { type: String, default: '' },
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
