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
