import mongoose from 'mongoose';

const propertySnapshotSchema = new mongoose.Schema(
  {
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
  },
  { _id: false },
);

const leadRequestSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedByRole: {
      type: String,
      enum: ['seller', 'agent', 'admin'],
      default: 'seller',
    },
    categoryKey: { type: String, required: true, index: true },
    source: { type: String, default: 'checklist_task' },
    sourceRefId: { type: String, default: '' },
    propertySnapshot: { type: propertySnapshotSchema, default: {} },
    status: {
      type: String,
      enum: ['open', 'routing', 'matched', 'completed', 'expired', 'cancelled'],
      default: 'open',
      index: true,
    },
    maxProviders: { type: Number, default: 3 },
    message: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'leadRequests',
  },
);

leadRequestSchema.index({ propertyId: 1, createdAt: -1 });

const leadDispatchSchema = new mongoose.Schema(
  {
    leadRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadRequest',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'accepted', 'declined', 'expired', 'failed'],
      default: 'queued',
      index: true,
    },
    deliveryChannels: { type: [String], default: ['dashboard'] },
    sentAt: { type: Date, default: null },
    smsSentAt: { type: Date, default: null },
    smsMessageSid: { type: String, default: '' },
    smsError: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
    responseStatus: {
      type: String,
      enum: ['accepted', 'declined', 'help', 'opted_out', 'custom_reply', 'no_response', null],
      default: null,
    },
    leadFeeCents: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'leadDispatches',
  },
);

leadDispatchSchema.index({ leadRequestId: 1, providerId: 1 }, { unique: true });

const providerResponseSchema = new mongoose.Schema(
  {
    leadRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadRequest',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    responseStatus: {
      type: String,
      enum: ['accepted', 'declined', 'help', 'opted_out', 'custom_reply', 'no_response'],
      required: true,
    },
    note: { type: String, default: '' },
    rawBody: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'providerResponses',
  },
);

providerResponseSchema.index({ leadRequestId: 1, providerId: 1, createdAt: -1 });

const savedProviderSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    categoryKey: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'savedProviders',
  },
);

savedProviderSchema.index({ propertyId: 1, userId: 1, providerId: 1 }, { unique: true });

const providerAnalyticsSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    monthKey: { type: String, required: true, index: true },
    leadCount: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    declinedCount: { type: Number, default: 0 },
    expiredCount: { type: Number, default: 0 },
    avgResponseMinutes: { type: Number, default: 0 },
    billableLeadCount: { type: Number, default: 0 },
    revenueCents: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'providerAnalytics',
  },
);

providerAnalyticsSchema.index({ providerId: 1, monthKey: 1 }, { unique: true });

const providerSmsLogSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      default: null,
      index: true,
    },
    leadRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadRequest',
      default: null,
      index: true,
    },
    leadDispatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadDispatch',
      default: null,
      index: true,
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true,
    },
    messageType: { type: String, default: 'lead' },
    fromPhone: { type: String, default: '' },
    toPhone: { type: String, default: '' },
    body: { type: String, default: '' },
    twilioMessageSid: { type: String, default: '' },
    deliveryStatus: { type: String, default: '' },
    parseStatus: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'providerSmsLogs',
  },
);

export const LeadRequestModel =
  mongoose.models.LeadRequest || mongoose.model('LeadRequest', leadRequestSchema);

export const LeadDispatchModel =
  mongoose.models.LeadDispatch || mongoose.model('LeadDispatch', leadDispatchSchema);

export const ProviderResponseModel =
  mongoose.models.ProviderResponse ||
  mongoose.model('ProviderResponse', providerResponseSchema);

export const SavedProviderModel =
  mongoose.models.SavedProvider || mongoose.model('SavedProvider', savedProviderSchema);

export const ProviderAnalyticsModel =
  mongoose.models.ProviderAnalytics ||
  mongoose.model('ProviderAnalytics', providerAnalyticsSchema);

export const ProviderSmsLogModel =
  mongoose.models.ProviderSmsLog ||
  mongoose.model('ProviderSmsLog', providerSmsLogSchema);
