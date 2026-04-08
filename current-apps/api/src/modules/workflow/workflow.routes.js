import { getGuidedWorkflowState } from './workflow.service.js';

export async function workflowRoutes(fastify) {
  fastify.get('/:propertyId/workflow', async (request, reply) => {
    try {
      const role = request.query?.role || 'seller';
      const workflow = await getGuidedWorkflowState(request.params.propertyId, role);
      return reply.send({ workflow });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/:propertyId/workflow/recalculate', async (request, reply) => {
    try {
      const role = request.query?.role || request.body?.role || 'seller';
      const workflow = await getGuidedWorkflowState(request.params.propertyId, role);
      return reply.send({ workflow, recalculated: true });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
