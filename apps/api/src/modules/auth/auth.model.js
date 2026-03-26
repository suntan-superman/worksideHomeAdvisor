import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    role: {
      type: String,
      enum: ['seller', 'collaborator', 'admin', 'super_admin'],
      default: 'seller',
    },
    emailVerifiedAt: { type: Date, default: null },
    verificationOtp: { type: otpSchema, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
