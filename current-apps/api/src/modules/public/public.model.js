import mongoose from 'mongoose';

const attributionSchema = new mongoose.Schema(
  {
    platform: { type: String, default: 'direct', index: true },
    source: { type: String, default: 'direct', index: true },
    medium: { type: String, default: 'organic', index: true },
    campaign: { type: String, default: 'general', index: true },
    adset: { type: String, default: '' },
    ad: { type: String, default: '' },
    roleIntent: { type: String, default: '', index: true },
    route: { type: String, default: '' },
    landingPath: { type: String, default: '' },
    referrer: { type: String, default: '' },
  },
  { _id: false },
);

const publicFunnelEventSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true, index: true },
    anonymousId: { type: String, default: '', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    email: { type: String, default: '', index: true },
    attribution: { type: attributionSchema, default: {} },
    previewContext: { type: mongoose.Schema.Types.Mixed, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    sessionStage: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'public_funnel_events',
  },
);

export const PublicFunnelEventModel =
  mongoose.models.PublicFunnelEvent ||
  mongoose.model('PublicFunnelEvent', publicFunnelEventSchema);
