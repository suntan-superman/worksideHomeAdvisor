import mongoose from 'mongoose';

const analysisLockSchema = new mongoose.Schema(
  {
    propertyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    analysisType: { type: String, required: true, index: true },
    inputHash: { type: String, required: true, index: true },
    status: { type: String, enum: ['processing'], default: 'processing' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000),
      expires: 0,
    },
  },
  {
    timestamps: false,
    collection: 'analysisLocks',
  },
);

analysisLockSchema.index(
  { propertyId: 1, userId: 1, analysisType: 1, inputHash: 1 },
  { unique: true },
);

export const AnalysisLockModel =
  mongoose.models.AnalysisLock || mongoose.model('AnalysisLock', analysisLockSchema);
