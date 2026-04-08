import mongoose from 'mongoose';

const rateLimitEventSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    scope: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      expires: 0,
    },
  },
  {
    timestamps: false,
    collection: 'rateLimitEvents',
  },
);

export const RateLimitEventModel =
  mongoose.models.RateLimitEvent || mongoose.model('RateLimitEvent', rateLimitEventSchema);
