import { buildNormalizedPublicUrl, verifyTwilioSignature } from './twilio-signature.service.js';
import {
  processIncomingProviderSms,
  processTwilioSmsStatusCallback,
} from './marketplace-sms.service.js';

export async function marketplaceSmsRoutes(fastify) {
  const handleVerifiedTwilioRequest = (pathnames, handler) => async (request, reply) => {
    try {
      const payload = request.body || {};
      const providedSignature = request.headers['x-twilio-signature'] || '';
      const allowedPathnames = Array.isArray(pathnames) ? pathnames : [pathnames];

      const valid = allowedPathnames.some((pathname) =>
        verifyTwilioSignature({
          url: buildNormalizedPublicUrl(pathname),
          params: payload,
          providedSignature,
        }),
      );

      if (!valid) {
        request.log.warn({ payload }, 'invalid twilio signature');
        return reply.code(403).type('text/xml').send('<Response></Response>');
      }

      await handler(payload, request.log);

      return reply.type('text/xml').send('<Response></Response>');
    } catch (error) {
      request.log.error({ err: error, pathnames }, 'marketplace twilio webhook failed');
      return reply.code(500).type('text/xml').send('<Response></Response>');
    }
  };

  const inboundHandler = handleVerifiedTwilioRequest(
    ['/api/v1/twilio/sms/inbound', '/api/v1/marketplace/twilio/inbound'],
    (payload, logger) =>
      processIncomingProviderSms({
        from: payload.From,
        body: payload.Body,
        logger,
      }),
  );

  const statusHandler = handleVerifiedTwilioRequest(
    ['/api/v1/twilio/sms/status', '/api/v1/marketplace/twilio/status'],
    (payload, logger) =>
      processTwilioSmsStatusCallback({
        messageSid: payload.MessageSid,
        messageStatus: payload.MessageStatus,
        to: payload.To,
        from: payload.From,
        errorCode: payload.ErrorCode,
        errorMessage: payload.ErrorMessage,
        logger,
      }),
  );

  fastify.post('/marketplace/twilio/inbound', inboundHandler);
  fastify.post('/twilio/sms/inbound', inboundHandler);
  fastify.post('/marketplace/twilio/status', statusHandler);
  fastify.post('/twilio/sms/status', statusHandler);
}
