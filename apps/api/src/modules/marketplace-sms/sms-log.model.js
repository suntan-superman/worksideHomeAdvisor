import mongoose from 'mongoose';

const smsLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeadRequest',
      default: null,
      index: true,
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true,
    },
    to: { type: String, default: '' },
    from: { type: String, default: '' },
    body: { type: String, default: '' },
    status: { type: String, default: '' },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      default: null,
      index: true,
    },
    messageSid: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'smsLogs',
  },
);

export const SmsLogModel =
  mongoose.models.SmsLog || mongoose.model('SmsLog', smsLogSchema);
