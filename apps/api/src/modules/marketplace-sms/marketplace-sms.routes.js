import { buildNormalizedPublicUrl, verifyTwilioSignature } from './twilio-signature.service.js';
import { processIncomingProviderSms } from './marketplace-sms.service.js';

export async function marketplaceSmsRoutes(fastify) {
  fastify.post('/marketplace/twilio/inbound', async (request, reply) => {
    try {
      const payload = request.body || {};
      const providedSignature = request.headers['x-twilio-signature'] || '';
      const requestUrl = buildNormalizedPublicUrl('/api/v1/marketplace/twilio/inbound');

      const valid = verifyTwilioSignature({
        url: requestUrl,
        params: payload,
        providedSignature,
      });

      if (!valid) {
        request.log.warn({ payload }, 'invalid twilio signature');
        return reply.code(403).type('text/xml').send('<Response></Response>');
      }

      await processIncomingProviderSms({
        from: payload.From,
        body: payload.Body,
        logger: request.log,
      });

      return reply.type('text/xml').send('<Response></Response>');
    } catch (error) {
      request.log.error({ err: error }, 'marketplace twilio inbound failed');
      return reply.code(500).type('text/xml').send('<Response></Response>');
    }
  });
}
