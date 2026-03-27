import { z } from 'zod';

import {
  createCheckoutSession,
  getBillingSummary,
  handleStripeWebhook,
  listBillingPlans,
} from './billing.service.js';

const checkoutSchema = z.object({
  userId: z.string().optional(),
  planKey: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function parseJsonBody(body) {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

export async function billingRoutes(fastify) {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request, body, done) => done(null, body),
  );

  fastify.get('/plans', async () => ({
    plans: listBillingPlans(),
  }));

  fastify.get('/summary/:userId', async (request, reply) => {
    try {
      const result = await getBillingSummary(request.params.userId);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/checkout-session', async (request, reply) => {
    try {
      const parsedBody = parseJsonBody(request.body);
      const payload = checkoutSchema.parse(parsedBody);
      const userId = payload.userId || request.headers['x-user-id'];
      const result = await createCheckoutSession({
        ...payload,
        userId,
      });

      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/webhook', async (request, reply) => {
    try {
      const result = await handleStripeWebhook(
        request.body,
        request.headers['stripe-signature'],
      );

      return reply.send(result);
    } catch (error) {
      request.log.error({ err: error }, 'Stripe webhook failed');
      return reply.code(400).send({ message: error.message });
    }
  });
}
