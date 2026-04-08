import { env } from '../../config/env.js';
import { BRANDING } from '@workside/branding';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderAnalyticsModel,
  ProviderResponseModel,
  ProviderSmsLogModel,
} from '../providers/provider-leads.model.js';
import { ProviderModel } from '../providers/provider.model.js';
import { parseProviderReply } from './provider-reply-parser.service.js';
import { sendProviderLeadEmail } from '../../services/emailService.js';

const TEMPLATE_BY_CATEGORY = {
  inspector: 'New Workside lead: Home inspection request near {{zip}}. Reply YES to accept or NO to decline.',
  title_company: 'New Workside lead: Title services request near {{zip}}. Reply YES to accept or NO to decline.',
  photographer: 'New Workside lead: Real estate photo request near {{zip}}. Reply YES to accept or NO to decline.',
  cleaning_service: 'New Workside lead: Home prep request near {{zip}}. Reply YES to accept or NO to decline.',
};

export function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return value.startsWith('+') ? value : `+${digits}`;
}

function isSmsEnabledForProvider(provider) {
  return (
    provider?.status === 'active' &&
    provider?.leadRouting?.smsOptOut !== true &&
    ['sms', 'sms_and_email'].includes(provider?.leadRouting?.deliveryMode || 'sms_and_email') &&
    normalizePhoneNumber(provider?.leadRouting?.notifyPhone || provider?.phone)
  );
}

function isEmailEnabledForProvider(provider) {
  return (
    provider?.status === 'active' &&
    ['email', 'sms_and_email'].includes(provider?.leadRouting?.deliveryMode || 'sms_and_email') &&
    String(provider?.leadRouting?.notifyEmail || provider?.email || '').trim()
  );
}

function isTwilioConfigured() {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER),
  );
}

function buildLeadSmsBody({ leadRequest }) {
  const zip = leadRequest?.propertySnapshot?.zip || 'your area';
  const categoryKey = leadRequest?.categoryKey || '';
  const template = TEMPLATE_BY_CATEGORY[categoryKey] || 'New Workside lead available near {{zip}}. Reply YES to accept or NO to decline.';
  return template.replace('{{zip}}', zip);
}

function buildReplySmsBody(type) {
  if (type === 'accepted') {
    return 'Thanks - you have accepted this Workside lead. We will mark you as engaged for this request.';
  }
  if (type === 'declined') {
    return 'No problem - we marked this Workside lead as declined. You will keep receiving future eligible requests unless you opt out.';
  }
  if (type === 'help') {
    return `Workside provider SMS: Reply YES to accept a lead, NO to decline, STOP to opt out. Support: ${BRANDING.supportEmail}.`;
  }
  if (type === 'opted_out') {
    return 'You have been opted out of Workside provider SMS notifications. Reply START later when re-enable support is added.';
  }
  return '';
}

async function sendTwilioMessage({ to, body }) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const payload = new URLSearchParams();
  payload.set('To', to);
  payload.set('Body', body);

  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    payload.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    payload.set('From', env.TWILIO_FROM_NUMBER);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Twilio send failed with ${response.status}`);
  }

  return data;
}

async function upsertProviderAnalytics(providerId, mutator) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const record =
    (await ProviderAnalyticsModel.findOne({ providerId, monthKey })) ||
    (await ProviderAnalyticsModel.create({ providerId, monthKey }));

  mutator(record);
  await record.save();
}

async function refreshLeadRequestStatus(leadRequestId) {
  const dispatches = await LeadDispatchModel.find({ leadRequestId }).lean();

  let nextStatus = 'open';
  if (dispatches.some((dispatch) => dispatch.status === 'accepted')) {
    nextStatus = 'matched';
  } else if (dispatches.some((dispatch) => ['queued', 'sent', 'delivered'].includes(dispatch.status))) {
    nextStatus = 'routing';
  } else if (dispatches.some((dispatch) => ['declined', 'failed', 'expired'].includes(dispatch.status))) {
    nextStatus = 'open';
  }

  await LeadRequestModel.findByIdAndUpdate(leadRequestId, {
    $set: {
      status: nextStatus,
      updatedAt: new Date(),
    },
  });
}

async function logProviderSms({
  providerId = null,
  leadRequestId = null,
  leadDispatchId = null,
  direction,
  messageType,
  fromPhone = '',
  toPhone = '',
  body = '',
  twilioMessageSid = '',
  deliveryStatus = '',
  parseStatus = '',
  metadata = {},
}) {
  await ProviderSmsLogModel.create({
    providerId,
    leadRequestId,
    leadDispatchId,
    direction,
    messageType,
    fromPhone,
    toPhone,
    body,
    twilioMessageSid,
    deliveryStatus,
    parseStatus,
    metadata,
  });
}

async function sendProviderReplyMessage(provider, type, context = {}) {
  const phone = normalizePhoneNumber(provider?.leadRouting?.notifyPhone || provider?.phone);
  const body = buildReplySmsBody(type);
  if (!phone || !body || !isTwilioConfigured() || provider?.leadRouting?.smsOptOut) {
    return null;
  }

  const response = await sendTwilioMessage({ to: phone, body });
  await logProviderSms({
    providerId: provider._id,
    leadRequestId: context.leadRequestId || null,
    leadDispatchId: context.leadDispatchId || null,
    direction: 'outbound',
    messageType: type,
    toPhone: phone,
    body,
    twilioMessageSid: response.sid || '',
    deliveryStatus: response.status || '',
  });

  return response;
}

async function sendLeadEmail({ provider, leadRequest }) {
  const to = String(provider?.leadRouting?.notifyEmail || provider?.email || '').trim();
  if (!to) {
    return null;
  }

  await sendProviderLeadEmail({
    to,
    providerName: provider.businessName || 'there',
    categoryLabel: String(leadRequest?.categoryKey || 'service').replace(/_/g, ' '),
    propertyAddress:
      leadRequest?.propertySnapshot?.address ||
      [
        leadRequest?.propertySnapshot?.city,
        leadRequest?.propertySnapshot?.state,
        leadRequest?.propertySnapshot?.zip,
      ]
        .filter(Boolean)
        .join(', '),
    message: leadRequest?.message || '',
    portalUrl: `${env.PUBLIC_WEB_URL}/providers/portal`,
  });

  return { ok: true };
}

function shouldAttemptEmail(provider, requestedDeliveryMode = 'email') {
  return ['email', 'sms_and_email'].includes(requestedDeliveryMode) && isEmailEnabledForProvider(provider);
}

function shouldAttemptSms(provider, requestedDeliveryMode = 'email') {
  return ['sms', 'sms_and_email'].includes(requestedDeliveryMode) && isSmsEnabledForProvider(provider) && isTwilioConfigured();
}

export async function notifyQueuedLeadDispatches(
  leadRequestId,
  logger = console,
  { deliveryMode = 'email' } = {},
) {
  const leadRequest = await LeadRequestModel.findById(leadRequestId).lean();
  if (!leadRequest) {
    throw new Error('Lead request not found.');
  }

  const dispatches = await LeadDispatchModel.find({ leadRequestId, status: 'queued' });
  if (!dispatches.length) {
    return { sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  const providers = await ProviderModel.find({
    _id: { $in: dispatches.map((dispatch) => dispatch.providerId) },
  });
  const providerById = new Map(providers.map((provider) => [String(provider._id), provider]));

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const dispatch of dispatches) {
    const provider = providerById.get(String(dispatch.providerId));
    if (!provider) {
      skippedCount += 1;
      continue;
    }

    try {
      const deliveryChannels = [];
      const sentAt = new Date();

      if (shouldAttemptEmail(provider, deliveryMode)) {
        await sendLeadEmail({ provider, leadRequest });
        deliveryChannels.push('email');
        dispatch.emailSentAt = sentAt;
        dispatch.emailError = '';
      }

      if (shouldAttemptSms(provider, deliveryMode)) {
        const toPhone = normalizePhoneNumber(provider.leadRouting.notifyPhone || provider.phone);
        const body = buildLeadSmsBody({ leadRequest });
        const response = await sendTwilioMessage({ to: toPhone, body });
        deliveryChannels.push('sms');
        dispatch.smsSentAt = sentAt;
        dispatch.smsMessageSid = response.sid || '';
        dispatch.smsError = '';

        await logProviderSms({
          providerId: provider._id,
          leadRequestId: leadRequest._id,
          leadDispatchId: dispatch._id,
          direction: 'outbound',
          messageType: 'lead',
          toPhone,
          body,
          twilioMessageSid: response.sid || '',
          deliveryStatus: response.status || '',
        });
      }

      if (!deliveryChannels.length) {
        skippedCount += 1;
        continue;
      }

      dispatch.status = 'sent';
      dispatch.deliveryChannels = deliveryChannels;
      dispatch.sentAt = sentAt;
      await dispatch.save();

      if (!provider.firstLeadSentAt) {
        provider.firstLeadSentAt = new Date();
        await provider.save();
      }

      await upsertProviderAnalytics(provider._id, (record) => {
        record.leadCount += 1;
      });

      sentCount += 1;
    } catch (error) {
      dispatch.status = 'failed';
      dispatch.emailError = error.message;
      dispatch.smsError = error.message;
      await dispatch.save();
      logger?.error?.({ err: error, providerId: String(provider._id), leadRequestId: String(leadRequest._id) }, 'provider lead delivery failed');
      failedCount += 1;
    }
  }

  await refreshLeadRequestStatus(leadRequestId);
  return { sentCount, failedCount, skippedCount };
}

export async function processIncomingProviderSms({ from, body, logger = console }) {
  const normalizedFrom = normalizePhoneNumber(from);
  const parsed = parseProviderReply(body);

  const provider = await ProviderModel.findOne({
    $or: [
      { 'leadRouting.notifyPhoneNormalized': normalizedFrom },
      { phone: from },
      { 'leadRouting.notifyPhone': from },
    ],
  });

  if (!provider) {
    await logProviderSms({
      direction: 'inbound',
      messageType: 'unknown_provider',
      fromPhone: from,
      body,
      parseStatus: parsed.status,
    });
    return { ok: true, matched: false, parsedStatus: parsed.status };
  }

  const dispatch = await LeadDispatchModel.findOne({
    providerId: provider._id,
    status: { $in: ['queued', 'sent', 'delivered'] },
  }).sort({ createdAt: -1 });

  if (!dispatch) {
    await logProviderSms({
      providerId: provider._id,
      direction: 'inbound',
      messageType: 'no_pending_dispatch',
      fromPhone: from,
      body,
      parseStatus: parsed.status,
    });
    return { ok: true, matched: false, parsedStatus: parsed.status };
  }

  const now = new Date();
  const responseRecord = {
    leadRequestId: dispatch.leadRequestId,
    providerId: provider._id,
    responseStatus: parsed.status,
    note:
      parsed.status === 'accepted'
        ? 'Accepted by SMS'
        : parsed.status === 'declined'
          ? 'Declined by SMS'
          : parsed.status === 'help'
            ? 'Requested help by SMS'
            : parsed.status === 'opted_out'
              ? 'Opted out by SMS'
              : 'Custom SMS reply',
    rawBody: String(body || '').trim(),
  };

  await ProviderResponseModel.create(responseRecord);

  await logProviderSms({
    providerId: provider._id,
    leadRequestId: dispatch.leadRequestId,
    leadDispatchId: dispatch._id,
    direction: 'inbound',
    messageType: 'reply',
    fromPhone: from,
    body,
    parseStatus: parsed.status,
    metadata: { normalized: parsed.normalized || '' },
  });

  if (parsed.status === 'accepted') {
    dispatch.status = 'accepted';
    dispatch.responseStatus = 'accepted';
    dispatch.respondedAt = now;
    await dispatch.save();

    await upsertProviderAnalytics(provider._id, (record) => {
      record.acceptedCount += 1;
      if (dispatch.smsSentAt) {
        const responseMinutes = Math.max(1, Math.round((now.getTime() - new Date(dispatch.smsSentAt).getTime()) / 60000));
        const priorAccepted = Math.max(0, record.acceptedCount - 1);
        record.avgResponseMinutes = priorAccepted
          ? Math.round(((record.avgResponseMinutes * priorAccepted) + responseMinutes) / record.acceptedCount)
          : responseMinutes;
      }
    });

    await sendProviderReplyMessage(provider, 'accepted', {
      leadRequestId: dispatch.leadRequestId,
      leadDispatchId: dispatch._id,
    });
  } else if (parsed.status === 'declined') {
    dispatch.status = 'declined';
    dispatch.responseStatus = 'declined';
    dispatch.respondedAt = now;
    await dispatch.save();

    await upsertProviderAnalytics(provider._id, (record) => {
      record.declinedCount += 1;
    });

    await sendProviderReplyMessage(provider, 'declined', {
      leadRequestId: dispatch.leadRequestId,
      leadDispatchId: dispatch._id,
    });
  } else if (parsed.status === 'help') {
    dispatch.responseStatus = 'help';
    await dispatch.save();
    await sendProviderReplyMessage(provider, 'help', {
      leadRequestId: dispatch.leadRequestId,
      leadDispatchId: dispatch._id,
    });
  } else if (parsed.status === 'opted_out') {
    provider.leadRouting.smsOptOut = true;
    await provider.save();
    dispatch.status = 'declined';
    dispatch.responseStatus = 'opted_out';
    dispatch.respondedAt = now;
    await dispatch.save();
    await sendProviderReplyMessage(provider, 'opted_out', {
      leadRequestId: dispatch.leadRequestId,
      leadDispatchId: dispatch._id,
    });
  } else {
    dispatch.responseStatus = 'custom_reply';
    await dispatch.save();
    logger?.info?.({ providerId: String(provider._id), leadDispatchId: String(dispatch._id), body }, 'provider custom sms reply received');
  }

  await refreshLeadRequestStatus(dispatch.leadRequestId);
  return {
    ok: true,
    matched: true,
    parsedStatus: parsed.status,
    providerId: String(provider._id),
    leadDispatchId: String(dispatch._id),
  };
}
