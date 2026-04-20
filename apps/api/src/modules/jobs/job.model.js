import mongoose from 'mongoose';

export const JOB_KIND_VALUES = [
  'vision_enhancement',
  'property_flyer',
  'property_report',
];

export const JOB_STATUS_VALUES = [
  'queued',
  'running',
  'reconnecting',
  'failed',
  'completed',
  'cancelled',
];

const jobSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: JOB_KIND_VALUES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: JOB_STATUS_VALUES,
      required: true,
      default: 'queued',
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    mediaAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null,
      index: true,
    },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    workerKey: {
      type: String,
      default: 'api_inline_background',
    },
    currentStage: {
      type: String,
      default: 'queued',
    },
    progressPercent: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      default: '',
    },
    warning: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    collection: 'jobs',
  },
);

jobSchema.index({ propertyId: 1, createdAt: -1 });
jobSchema.index({ mediaAssetId: 1, createdAt: -1 });
jobSchema.index({ kind: 1, status: 1, createdAt: -1 });

export const JobModel = mongoose.models.Job || mongoose.model('Job', jobSchema);
