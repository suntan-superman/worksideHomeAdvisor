import mongoose from 'mongoose';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    invalidatedAt: { type: Date, default: null },
    attemptCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'passwordResetTokens',
  },
);

passwordResetTokenSchema.index({ userId: 1, createdAt: -1 });
passwordResetTokenSchema.index({ email: 1, createdAt: -1 });

export const PasswordResetTokenModel =
  mongoose.models.PasswordResetToken ||
  mongoose.model('PasswordResetToken', passwordResetTokenSchema);
