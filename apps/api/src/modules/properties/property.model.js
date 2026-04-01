import mongoose from 'mongoose';

const sellerProfileSchema = new mongoose.Schema(
  {
    saleTimeline: { type: String },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    urgencyLevel: { type: String },
    targetMoveDate: { type: Date },
    diyPreference: { type: String },
    goals: { type: [String], default: [] },
  },
  { _id: false },
);

const propertySchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    addressLine1: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    propertyType: { type: String, required: true },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    squareFeet: { type: Number },
    lotSizeSqFt: { type: Number },
    yearBuilt: { type: Number },
    selectedListPrice: { type: Number, default: null },
    selectedListPriceSource: {
      type: String,
      enum: ['recommended_low', 'recommended_mid', 'recommended_high', 'custom', ''],
      default: '',
    },
    selectedListPriceUpdatedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    archivedAt: { type: Date, default: null },
    archivedReason: { type: String, default: '' },
    readinessScore: { type: Number, default: 0 },
    sellerProfile: { type: sellerProfileSchema, default: {} },
  },
  {
    timestamps: true,
    collection: 'properties',
  },
);

export const PropertyModel =
  mongoose.models.Property || mongoose.model('Property', propertySchema);
