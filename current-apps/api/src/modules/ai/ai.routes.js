import { aiRequestSchema } from '@workside/validation';

import { generateWorkflowResult } from './ai.service.js';

export async function aiRoutes(fastify) {
  fastify.post('/workflows', async (request, reply) => {
    try {
      const payload = aiRequestSchema.parse(request.body);
      const result = await generateWorkflowResult(payload);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
