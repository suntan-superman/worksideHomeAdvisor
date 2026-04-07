import { BRANDING } from '@workside/branding';

import { env } from '../../config/env.js';
import {
  sendProviderLeadEmail,
  sendSellerProviderMatchEmail,
} from '../../services/emailService.js';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderAnalyticsModel,
  ProviderResponseModel,
  ProviderSmsLogModel,
} from '../providers/provider-leads.model.js';
import { ProviderModel } from '../providers/provider.model.js';
import { parseProviderReply } from './provider-reply-parser.service.js';
import { buildNormalizedPublicUrl } from './twilio-signature.service.js';
import { UserModel } from '../auth/auth.model.js';

const TEMPLATE_BY_CATEGORY = {
  inspector:
    'Workside Home Advisor: New inspection request near {{zip}}. Reply YES {{jobCode}} to accept or NO {{jobCode}} to decline.',
  title_company:
    'Workside Home Advisor: New title request near {{zip}}. Reply YES {{jobCode}} to accept or NO {{jobCode}} to decline.',
  photographer:
    'Workside Home Advisor: New real estate photo request near {{zip}}. Reply YES {{jobCode}} to accept or NO {{jobCode}} to decline.',
  cleaning_service:
    'Workside Home Advisor: New cleaning request near {{zip}}. Reply YES {{jobCode}} to accept or NO {{jobCode}} to decline.',
};

const PENDING_DISPATCH_STATUSES = ['queued', 'sent', 'delivered'];

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
  return String(value || '').startsWith('+') ? String(value) : `+${digits}`;
}

function buildLeadRequestCode(leadRequestId) {
  return String(leadRequestId || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toUpperCase();
}

export function buildTwilioWebhookUrl(type = 'inbound') {
  if (type === 'status') {
    return buildNormalizedPublicUrl('/api/v1/twilio/sms/status');
  }
  return buildNormalizedPublicUrl('/api/v1/twilio/sms/inbound');
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
  const jobCode = buildLeadRequestCode(leadRequest?._id || leadRequest?.id);
  const template =
    TEMPLATE_BY_CATEGORY[categoryKey] ||
    'Workside Home Advisor: New provider lead near {{zip}}. Reply YES {{jobCode}} to accept or NO {{jobCode}} to decline.';

  return template
    .replace('{{zip}}', zip)
    .replace('{{jobCode}}', jobCode || 'JOB');
}

function buildReplySmsBody(type) {
  if (type === 'accepted') {
    return 'Thanks. You have accepted this Workside lead and the seller has been notified.';
  }
  if (type === 'declined') {
    return 'No problem. We marked this Workside lead as declined. You will continue receiving future eligible requests unless you opt out.';
  }
  if (type === 'already_taken') {
    return 'Thanks for the quick reply. This request has already been accepted by another provider, so no further action is needed.';
  }
  if (type === 'help') {
    return `Workside provider SMS: Reply YES <job code> to accept, NO <job code> to decline, STOP to opt out. Support: ${BRANDING.supportEmail}.`;
  }
  if (type === 'opted_out') {
    return 'You have been opted out of Workside provider SMS notifications. Reply START later when re-enable support is added.';
  }
  return '';
}

async function sendTwilioMessage({ to, body, statusCallbackUrl = buildTwilioWebhookUrl('status') }) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const payload = new URLSearchParams();
  payload.set('To', to);
  payload.set('Body', body);

  if (statusCallbackUrl) {
    payload.set('StatusCallback', statusCallbackUrl);
  }

  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    payload.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    payload.set('From', env.TWILIO_FROM_NUMBER);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
      ).toString('base64')}`,
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

export async function refreshLeadRequestStatus(leadRequestId) {
  const [leadRequest, dispatches] = await Promise.all([
    LeadRequestModel.findById(leadRequestId).lean(),
    LeadDispatchModel.find({ leadRequestId }).lean(),
  ]);

  if (!leadRequest) {
    return;
  }

  let nextStatus = leadRequest.status || 'open';

  if (leadRequest.selectedProviderId || dispatches.some((dispatch) => dispatch.status === 'accepted')) {
    nextStatus = 'matched';
  } else if (dispatches.some((dispatch) => PENDING_DISPATCH_STATUSES.includes(dispatch.status))) {
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

async function notifySellerOfProviderMatch({ leadRequest, provider, logger = console }) {
  const seller = await UserModel.findById(leadRequest.userId).lean();
  if (!seller?.email) {
    return [];
  }

  try {
    await sendSellerProviderMatchEmail({
      to: seller.email,
      propertyAddress:
        leadRequest?.propertySnapshot?.address ||
        [
          leadRequest?.propertySnapshot?.city,
          leadRequest?.propertySnapshot?.state,
          leadRequest?.propertySnapshot?.zip,
        ]
          .filter(Boolean)
          .join(', '),
      categoryLabel: String(leadRequest?.categoryKey || 'service').replace(/_/g, ' '),
      providerName: provider?.businessName || 'Provider',
      providerPhone: provider?.leadRouting?.notifyPhone || provider?.phone || '',
      providerEmail: provider?.leadRouting?.notifyEmail || provider?.email || '',
      workspaceUrl: `${env.PUBLIC_WEB_URL}/properties/${leadRequest.propertyId}`,
    });

    return ['dashboard', 'email'];
  } catch (error) {
    logger?.error?.(
      { err: error, leadRequestId: String(leadRequest._id), providerId: String(provider?._id || '') },
      'seller provider match notification failed',
    );
    return ['dashboard'];
  }
}

function shouldAttemptEmail(provider, requestedDeliveryMode = 'sms_and_email') {
  return ['email', 'sms_and_email'].includes(requestedDeliveryMode) && isEmailEnabledForProvider(provider);
}

function shouldAttemptSms(provider, requestedDeliveryMode = 'sms_and_email') {
  return ['sms', 'sms_and_email'].includes(requestedDeliveryMode) && isSmsEnabledForProvider(provider) && isTwilioConfigured();
}

async function findPendingDispatchForProvider(providerId, requestReference = '') {
  const dispatches = await LeadDispatchModel.find({
    providerId,
    status: { $in: PENDING_DISPATCH_STATUSES },
  }).sort({ createdAt: -1 });

  if (!dispatches.length) {
    return null;
  }

  const normalizedReference = String(requestReference || '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();

  if (!normalizedReference) {
    return dispatches[0];
  }

  return (
    dispatches.find((dispatch) => {
      const leadRequestId = String(dispatch.leadRequestId || '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase();
      return leadRequestId === normalizedReference || leadRequestId.endsWith(normalizedReference);
    }) || dispatches[0]
  );
}

async function updateAnalyticsForLeadResponse(providerId, responseStatus, dispatch, respondedAt) {
  await upsertProviderAnalytics(providerId, (record) => {
    if (responseStatus === 'accepted') {
      record.acceptedCount += 1;
      if (dispatch.smsSentAt || dispatch.sentAt) {
        const startAt = dispatch.smsSentAt || dispatch.sentAt;
        const responseMinutes = Math.max(
          1,
          Math.round((respondedAt.getTime() - new Date(startAt).getTime()) / 60000),
        );
        const priorAccepted = Math.max(0, record.acceptedCount - 1);
        record.avgResponseMinutes = priorAccepted
          ? Math.round(
              ((record.avgResponseMinutes * priorAccepted) + responseMinutes) / record.acceptedCount,
            )
          : responseMinutes;
      }
      return;
    }

    if (responseStatus === 'declined' || responseStatus === 'opted_out' || responseStatus === 'already_matched') {
      record.declinedCount += 1;
    }
  });
}

async function expireCompetingDispatches({ leadRequestId, acceptedDispatchId, logger = console }) {
  const competingDispatches = await LeadDispatchModel.find({
    leadRequestId,
    _id: { $ne: acceptedDispatchId },
    status: { $in: PENDING_DISPATCH_STATUSES },
  });

  if (!competingDispatches.length) {
    return 0;
  }

  const providerIds = competingDispatches.map((dispatch) => dispatch.providerId);
  const providers = await ProviderModel.find({ _id: { $in: providerIds } });
  const providerById = new Map(providers.map((provider) => [String(provider._id), provider]));
  const now = new Date();

  for (const dispatch of competingDispatches) {
    dispatch.status = 'expired';
    dispatch.responseStatus = 'already_matched';
    dispatch.respondedAt = now;
    await dispatch.save();

    const provider = providerById.get(String(dispatch.providerId));
    if (provider) {
      try {
        await sendProviderReplyMessage(provider, 'already_taken', {
          leadRequestId: dispatch.leadRequestId,
          leadDispatchId: dispatch._id,
        });
        await updateAnalyticsForLeadResponse(provider._id, 'already_matched', dispatch, now);
      } catch (error) {
        logger?.warn?.(
          { err: error, providerId: String(provider._id), leadDispatchId: String(dispatch._id) },
          'failed to send already matched SMS',
        );
      }
    }
  }

  return competingDispatches.length;
}

function buildResponseNote(responseStatus, source = 'sms') {
  const sourceLabel = source === 'portal' ? 'provider portal' : 'SMS';
  if (responseStatus === 'accepted') return `Accepted by ${sourceLabel}`;
  if (responseStatus === 'declined') return `Declined by ${sourceLabel}`;
  if (responseStatus === 'help') return `Requested help by ${sourceLabel}`;
  if (responseStatus === 'opted_out') return `Opted out by ${sourceLabel}`;
  if (responseStatus === 'already_matched') return `Attempted to accept after another provider was selected (${sourceLabel})`;
  return `Custom reply received by ${sourceLabel}`;
}

export async function recordProviderLeadResponse({
  dispatch,
  provider,
  responseStatus,
  note = '',
  rawBody = '',
  logger = console,
  source = 'sms',
  sendConfirmation = true,
}) {
  const now = new Date();
  const leadRequest = await LeadRequestModel.findById(dispatch.leadRequestId);
  if (!leadRequest) {
    throw new Error('Lead request not found.');
  }

  if (responseStatus === 'accepted') {
    const existingSelectedProviderId = leadRequest.selectedProviderId
      ? String(leadRequest.selectedProviderId)
      : '';

    if (existingSelectedProviderId && existingSelectedProviderId !== String(provider._id)) {
      dispatch.status = 'expired';
      dispatch.responseStatus = 'already_matched';
      dispatch.respondedAt = now;
      await dispatch.save();

      await ProviderResponseModel.create({
        leadRequestId: dispatch.leadRequestId,
        providerId: provider._id,
        responseStatus: 'already_matched',
        note: normalizeResponseNote(note || buildResponseNote('already_matched', source)),
        rawBody: String(rawBody || '').trim(),
      });

      await updateAnalyticsForLeadResponse(provider._id, 'already_matched', dispatch, now);

      if (sendConfirmation) {
        await sendProviderReplyMessage(provider, 'already_taken', {
          leadRequestId: dispatch.leadRequestId,
          leadDispatchId: dispatch._id,
        });
      }

      await refreshLeadRequestStatus(dispatch.leadRequestId);

      return {
        matched: false,
        alreadyMatched: true,
        leadRequestId: String(dispatch.leadRequestId),
        leadDispatchId: String(dispatch._id),
        selectedProviderId: existingSelectedProviderId,
      };
    }

    dispatch.status = 'accepted';
    dispatch.responseStatus = 'accepted';
    dispatch.respondedAt = now;
    await dispatch.save();

    await ProviderResponseModel.create({
      leadRequestId: dispatch.leadRequestId,
      providerId: provider._id,
      responseStatus: 'accepted',
      note: normalizeResponseNote(note || buildResponseNote('accepted', source)),
      rawBody: String(rawBody || '').trim(),
    });

    await updateAnalyticsForLeadResponse(provider._id, 'accepted', dispatch, now);

    const sellerNotificationChannels = await notifySellerOfProviderMatch({
      leadRequest,
      provider,
      logger,
    });

    leadRequest.selectedProviderId = provider._id;
    leadRequest.selectedDispatchId = dispatch._id;
    leadRequest.matchedAt = now;
    leadRequest.status = 'matched';
    leadRequest.sellerNotifiedAt = sellerNotificationChannels.length ? now : null;
    leadRequest.sellerNotificationChannels = sellerNotificationChannels;
    await leadRequest.save();

    await expireCompetingDispatches({
      leadRequestId: leadRequest._id,
      acceptedDispatchId: dispatch._id,
      logger,
    });

    if (sendConfirmation) {
      await sendProviderReplyMessage(provider, 'accepted', {
        leadRequestId: dispatch.leadRequestId,
        leadDispatchId: dispatch._id,
      });
    }

    return {
      matched: true,
      alreadyMatched: false,
      leadRequestId: String(dispatch.leadRequestId),
      leadDispatchId: String(dispatch._id),
      selectedProviderId: String(provider._id),
    };
  }

  if (responseStatus === 'declined') {
    dispatch.status = 'declined';
    dispatch.responseStatus = 'declined';
    dispatch.respondedAt = now;
    await dispatch.save();

    await ProviderResponseModel.create({
      leadRequestId: dispatch.leadRequestId,
      providerId: provider._id,
      responseStatus: 'declined',
      note: normalizeResponseNote(note || buildResponseNote('declined', source)),
      rawBody: String(rawBody || '').trim(),
    });

    await updateAnalyticsForLeadResponse(provider._id, 'declined', dispatch, now);

    if (sendConfirmation) {
      await sendProviderReplyMessage(provider, 'declined', {
        leadRequestId: dispatch.leadRequestId,
        leadDispatchId: dispatch._id,
      });
    }

    await refreshLeadRequestStatus(dispatch.leadRequestId);
    return {
      matched: false,
      alreadyMatched: false,
      leadRequestId: String(dispatch.leadRequestId),
      leadDispatchId: String(dispatch._id),
    };
  }

  if (responseStatus === 'help') {
    dispatch.responseStatus = 'help';
    await dispatch.save();
    await ProviderResponseModel.create({
      leadRequestId: dispatch.leadRequestId,
      providerId: provider._id,
      responseStatus: 'help',
      note: normalizeResponseNote(note || buildResponseNote('help', source)),
      rawBody: String(rawBody || '').trim(),
    });
    if (sendConfirmation) {
      await sendProviderReplyMessage(provider, 'help', {
        leadRequestId: dispatch.leadRequestId,
        leadDispatchId: dispatch._id,
      });
    }
    return {
      matched: false,
      alreadyMatched: false,
      leadRequestId: String(dispatch.leadRequestId),
      leadDispatchId: String(dispatch._id),
    };
  }

  if (responseStatus === 'opted_out') {
    provider.leadRouting.smsOptOut = true;
    await provider.save();

    dispatch.status = 'declined';
    dispatch.responseStatus = 'opted_out';
    dispatch.respondedAt = now;
    await dispatch.save();

    await ProviderResponseModel.create({
      leadRequestId: dispatch.leadRequestId,
      providerId: provider._id,
      responseStatus: 'opted_out',
      note: normalizeResponseNote(note || buildResponseNote('opted_out', source)),
      rawBody: String(rawBody || '').trim(),
    });

    await updateAnalyticsForLeadResponse(provider._id, 'opted_out', dispatch, now);

    if (sendConfirmation) {
      await sendProviderReplyMessage(provider, 'opted_out', {
        leadRequestId: dispatch.leadRequestId,
        leadDispatchId: dispatch._id,
      });
    }

    await refreshLeadRequestStatus(dispatch.leadRequestId);
    return {
      matched: false,
      alreadyMatched: false,
      leadRequestId: String(dispatch.leadRequestId),
      leadDispatchId: String(dispatch._id),
    };
  }

  dispatch.responseStatus = 'custom_reply';
  await dispatch.save();

  await ProviderResponseModel.create({
    leadRequestId: dispatch.leadRequestId,
    providerId: provider._id,
    responseStatus: 'custom_reply',
    note: normalizeResponseNote(note || buildResponseNote('custom_reply', source)),
    rawBody: String(rawBody || '').trim(),
  });

  logger?.info?.(
    { providerId: String(provider._id), leadDispatchId: String(dispatch._id), body: rawBody },
    'provider custom reply received',
  );

  return {
    matched: false,
    alreadyMatched: false,
    leadRequestId: String(dispatch.leadRequestId),
    leadDispatchId: String(dispatch._id),
  };
}

function normalizeResponseNote(value) {
  return String(value || '').trim().slice(0, 280);
}

export async function notifyQueuedLeadDispatches(
  leadRequestId,
  logger = console,
  { deliveryMode = 'sms_and_email' } = {},
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
        const response = await sendTwilioMessage({
          to: toPhone,
          body,
          statusCallbackUrl: buildTwilioWebhookUrl('status'),
        });
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
          metadata: {
            jobCode: buildLeadRequestCode(leadRequest._id),
            statusCallbackUrl: buildTwilioWebhookUrl('status'),
          },
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
      logger?.error?.(
        { err: error, providerId: String(provider._id), leadRequestId: String(leadRequest._id) },
        'provider lead delivery failed',
      );
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
      metadata: { requestReference: parsed.requestReference || '' },
    });
    return { ok: true, matched: false, parsedStatus: parsed.status };
  }

  const dispatch = await findPendingDispatchForProvider(provider._id, parsed.requestReference);

  if (!dispatch) {
    await logProviderSms({
      providerId: provider._id,
      direction: 'inbound',
      messageType: 'no_pending_dispatch',
      fromPhone: from,
      body,
      parseStatus: parsed.status,
      metadata: { requestReference: parsed.requestReference || '' },
    });
    return { ok: true, matched: false, parsedStatus: parsed.status };
  }

  await logProviderSms({
    providerId: provider._id,
    leadRequestId: dispatch.leadRequestId,
    leadDispatchId: dispatch._id,
    direction: 'inbound',
    messageType: 'reply',
    fromPhone: from,
    body,
    parseStatus: parsed.status,
    metadata: {
      normalized: parsed.normalized || '',
      requestReference: parsed.requestReference || '',
    },
  });

  const result = await recordProviderLeadResponse({
    dispatch,
    provider,
    responseStatus: parsed.status,
    rawBody: String(body || '').trim(),
    logger,
    source: 'sms',
    sendConfirmation: true,
  });

  return {
    ok: true,
    matched: true,
    parsedStatus: parsed.status,
    providerId: String(provider._id),
    leadDispatchId: String(dispatch._id),
    leadRequestId: result.leadRequestId,
    alreadyMatched: Boolean(result.alreadyMatched),
  };
}

export async function processTwilioSmsStatusCallback({
  messageSid,
  messageStatus,
  to = '',
  from = '',
  errorCode = '',
  errorMessage = '',
  logger = console,
}) {
  const normalizedStatus = String(messageStatus || '').trim().toLowerCase();
  const metadata = {
    errorCode: String(errorCode || ''),
    errorMessage: String(errorMessage || ''),
    statusReceivedAt: new Date().toISOString(),
  };

  await ProviderSmsLogModel.updateMany(
    { twilioMessageSid: String(messageSid || '') },
    {
      $set: {
        deliveryStatus: normalizedStatus,
        metadata,
      },
    },
  );

  const dispatch = await LeadDispatchModel.findOne({
    smsMessageSid: String(messageSid || ''),
  });

  if (!dispatch) {
    await logProviderSms({
      direction: 'outbound',
      messageType: 'status_callback_unmatched',
      fromPhone: from,
      toPhone: to,
      twilioMessageSid: String(messageSid || ''),
      deliveryStatus: normalizedStatus,
      metadata,
    });
    return { ok: true, matched: false, status: normalizedStatus };
  }

  if (
    ['queued', 'sent'].includes(dispatch.status) &&
    ['queued', 'sending', 'sent', 'delivered'].includes(normalizedStatus)
  ) {
    dispatch.status = normalizedStatus === 'delivered' ? 'delivered' : 'sent';
  }

  if (
    PENDING_DISPATCH_STATUSES.includes(dispatch.status) &&
    ['failed', 'undelivered'].includes(normalizedStatus)
  ) {
    dispatch.status = 'failed';
    dispatch.smsError = errorMessage || errorCode || normalizedStatus;
  }

  await dispatch.save();
  await refreshLeadRequestStatus(dispatch.leadRequestId);

  logger?.info?.(
    {
      leadDispatchId: String(dispatch._id),
      leadRequestId: String(dispatch.leadRequestId),
      twilioMessageSid: messageSid,
      messageStatus: normalizedStatus,
    },
    'twilio sms status callback processed',
  );

  return {
    ok: true,
    matched: true,
    status: normalizedStatus,
    leadDispatchId: String(dispatch._id),
    leadRequestId: String(dispatch.leadRequestId),
  };
}
