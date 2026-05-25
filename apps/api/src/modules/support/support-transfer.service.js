import mongoose from 'mongoose';

import { sendSupportLiveTransferAlert } from '../../services/emailService.js';
import { UserModel } from '../auth/auth.model.js';
import { PropertyModel } from '../properties/property.model.js';
import { SupportLiveTransferModel } from './support-transfer.model.js';

function cleanString(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function toObjectIdOrNull(value) {
  const text = cleanString(value, 80);
  if (!text || !mongoose.Types.ObjectId.isValid(text)) return null;
  return new mongoose.Types.ObjectId(text);
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function selectedContext(payload = {}) {
  const context = payload.homeAdvisorContext || payload.context || {};
  return context && typeof context === 'object' ? context : {};
}

function normalizeSupportTransferPayload(payload = {}) {
  const context = selectedContext(payload);
  const user = context.user || {};
  const property = context.selectedProperty || {};
  const workflow = context.workflow || {};

  return {
    product: cleanString(payload.product || context.product || 'home_advisor', 80),
    tenantId: cleanString(payload.tenantId || context.tenantId || 'home-advisor-platform', 120),
    tenantType: cleanString(payload.tenantType || context.tenantType || 'platform', 80),
    source: cleanString(payload.source || 'website_chat', 80),
    sourceUrl: cleanString(payload.sourceUrl, 2000),
    appBaseUrl: cleanString(payload.appBaseUrl, 2000),
    visitorId: cleanString(payload.visitorId, 160),
    chatSessionId: cleanString(payload.chatSessionId || payload.merxusSessionId, 160),
    merxusSessionId: cleanString(payload.merxusSessionId || payload.chatSessionId, 160),
    merxusRequestStatus: cleanString(payload.merxusRequestStatus || payload.merxusStatus, 80),
    merxusErrorMessage: cleanString(payload.merxusErrorMessage, 600),
    leadName: cleanString(payload.leadName, 160),
    leadEmail: cleanString(payload.leadEmail, 240).toLowerCase(),
    authenticated: Boolean(payload.authenticated),
    userId: toObjectIdOrNull(payload.userId || user.id || user._id),
    userRole: cleanString(payload.userRole || user.role, 80),
    userEmail: cleanString(payload.userEmail || user.email, 240).toLowerCase(),
    propertyId: toObjectIdOrNull(payload.propertyId || property.id || property._id),
    propertyTitle: cleanString(payload.propertyTitle || property.title, 240),
    workflowPhase: cleanString(payload.workflowPhase || workflow.currentPhase || workflow.currentPhaseLabel, 160),
    workflowStep: cleanString(payload.workflowStep || workflow.currentStep, 160),
    message: cleanString(payload.message || payload.initialMessage, 1000),
    context: payload.context || null,
    homeAdvisorContext: payload.homeAdvisorContext || context || null,
    metadata: payload.metadata || null,
  };
}

async function hydrateTransferContext(normalized) {
  if (!isMongoConnected()) return normalized;

  const [user, property] = await Promise.all([
    normalized.userId ? UserModel.findById(normalized.userId).lean() : null,
    normalized.propertyId ? PropertyModel.findById(normalized.propertyId).lean() : null,
  ]);

  return {
    ...normalized,
    userRole: normalized.userRole || user?.role || '',
    userEmail: normalized.userEmail || user?.email || '',
    leadEmail: normalized.leadEmail || user?.email || '',
    leadName:
      normalized.leadName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.email?.split('@')[0] ||
      '',
    propertyTitle:
      normalized.propertyTitle ||
      property?.title ||
      [property?.addressLine1, property?.city, property?.state].filter(Boolean).join(', '),
  };
}

function serializeTransfer(record, extras = {}) {
  return {
    id: record._id?.toString?.() || String(record._id),
    product: record.product || 'home_advisor',
    tenantId: record.tenantId || '',
    source: record.source || '',
    sourceUrl: record.sourceUrl || '',
    visitorId: record.visitorId || '',
    chatSessionId: record.chatSessionId || '',
    merxusSessionId: record.merxusSessionId || '',
    merxusRequestStatus: record.merxusRequestStatus || '',
    leadName: record.leadName || '',
    leadEmail: record.leadEmail || '',
    authenticated: Boolean(record.authenticated),
    userId: record.userId?.toString?.() || '',
    userRole: record.userRole || '',
    userEmail: record.userEmail || '',
    propertyId: record.propertyId?.toString?.() || '',
    propertyTitle: record.propertyTitle || '',
    workflowPhase: record.workflowPhase || '',
    workflowStep: record.workflowStep || '',
    message: record.message || '',
    status: record.status || 'requested',
    notificationError: record.notificationError || '',
    notificationAttempts: record.notificationAttempts || 0,
    notifiedAt: record.notifiedAt || null,
    lastRequestedAt: record.lastRequestedAt || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    ...extras,
  };
}

export async function recordSupportLiveTransfer(payload = {}) {
  const hydrated = await hydrateTransferContext(normalizeSupportTransferPayload(payload));
  const now = new Date();

  if (!isMongoConnected()) {
    return {
      persisted: false,
      notificationSent: false,
      transfer: {
        ...hydrated,
        status: 'requested',
        lastRequestedAt: now,
      },
    };
  }

  const filter = hydrated.chatSessionId
    ? { chatSessionId: hydrated.chatSessionId }
    : {
        visitorId: hydrated.visitorId,
        leadEmail: hydrated.leadEmail,
        status: { $ne: 'closed' },
      };

  const record = await SupportLiveTransferModel.findOneAndUpdate(
    filter,
    {
      $set: {
        ...hydrated,
        status: 'requested',
        lastRequestedAt: now,
      },
      $inc: { notificationAttempts: 1 },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  try {
    await sendSupportLiveTransferAlert(record.toObject());
    record.status = 'notified';
    record.notificationError = '';
    record.notifiedAt = new Date();
    await record.save();
  } catch (error) {
    record.status = 'notification_failed';
    record.notificationError = cleanString(error.message, 600);
    await record.save();
  }

  return {
    persisted: true,
    notificationSent: record.status === 'notified',
    transfer: serializeTransfer(record),
  };
}

export async function listSupportLiveTransfers({ limit = 50 } = {}) {
  if (!isMongoConnected()) {
    return {
      dataSource: 'demo',
      summary: {
        open: 0,
        notified: 0,
        notificationFailed: 0,
      },
      items: [],
    };
  }

  const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [items, open, notified, notificationFailed] = await Promise.all([
    SupportLiveTransferModel.find({})
      .sort({ lastRequestedAt: -1, createdAt: -1 })
      .limit(normalizedLimit)
      .lean(),
    SupportLiveTransferModel.countDocuments({ status: { $in: ['requested', 'notification_failed'] } }),
    SupportLiveTransferModel.countDocuments({ status: 'notified' }),
    SupportLiveTransferModel.countDocuments({ status: 'notification_failed' }),
  ]);

  return {
    dataSource: 'mongodb',
    summary: {
      open,
      notified,
      notificationFailed,
    },
    items: items.map(serializeTransfer),
  };
}

