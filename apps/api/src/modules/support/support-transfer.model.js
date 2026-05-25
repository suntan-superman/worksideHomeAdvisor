import mongoose from 'mongoose';

const supportLiveTransferSchema = new mongoose.Schema(
  {
    product: { type: String, default: 'home_advisor', index: true },
    tenantId: { type: String, default: 'home-advisor-platform', index: true },
    tenantType: { type: String, default: 'platform' },
    source: { type: String, default: 'website_chat', index: true },
    sourceUrl: { type: String, default: '' },
    appBaseUrl: { type: String, default: '' },
    visitorId: { type: String, default: '', index: true },
    chatSessionId: { type: String, default: '' },
    merxusSessionId: { type: String, default: '', index: true },
    merxusRequestStatus: { type: String, default: '' },
    merxusErrorMessage: { type: String, default: '' },
    leadName: { type: String, default: '' },
    leadEmail: { type: String, default: '', index: true },
    authenticated: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userRole: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    propertyTitle: { type: String, default: '' },
    workflowPhase: { type: String, default: '' },
    workflowStep: { type: String, default: '' },
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['requested', 'notified', 'notification_failed', 'closed'],
      default: 'requested',
      index: true,
    },
    notificationError: { type: String, default: '' },
    notificationAttempts: { type: Number, default: 0 },
    notifiedAt: { type: Date, default: null },
    lastRequestedAt: { type: Date, default: null, index: true },
    context: { type: mongoose.Schema.Types.Mixed, default: null },
    homeAdvisorContext: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'support_live_transfer_requests',
  },
);

supportLiveTransferSchema.index(
  { chatSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { chatSessionId: { $type: 'string', $gt: '' } },
  },
);

export const SupportLiveTransferModel =
  mongoose.models.SupportLiveTransfer ||
  mongoose.model('SupportLiveTransfer', supportLiveTransferSchema);
