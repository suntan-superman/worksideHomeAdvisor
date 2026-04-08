import { z } from 'zod';

import {
  createChecklistItem,
  getOrCreatePropertyChecklist,
  updateChecklistItem,
} from './tasks.service.js';

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const itemParamsSchema = z.object({
  itemId: z.string().min(1),
});

const createChecklistItemSchema = z.object({
  title: z.string().min(1).max(140),
  detail: z.string().max(280).optional(),
  category: z
    .enum(['pricing', 'photos', 'preparation', 'marketing', 'documents', 'custom'])
    .optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  note: z.string().max(280).optional(),
  readinessImpact: z.number().int().min(1).max(40).optional(),
});

const updateChecklistItemSchema = z
  .object({
    title: z.string().min(1).max(140).optional(),
    detail: z.string().max(280).optional(),
    category: z
      .enum(['pricing', 'photos', 'preparation', 'marketing', 'documents', 'custom'])
      .optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    note: z.string().max(280).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one checklist field must be provided.',
  });

export async function tasksRoutes(fastify) {
  fastify.get('/properties/:propertyId/checklist', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const checklist = await getOrCreatePropertyChecklist(propertyId);
      return reply.send({ checklist });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/checklist/items', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const payload = createChecklistItemSchema.parse(request.body ?? {});
      const checklist = await createChecklistItem(propertyId, payload);
      return reply.code(201).send({ checklist });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/checklist-items/:itemId', async (request, reply) => {
    try {
      const { itemId } = itemParamsSchema.parse(request.params);
      const payload = updateChecklistItemSchema.parse(request.body ?? {});
      const response = await updateChecklistItem(itemId, payload);
      return reply.send(response);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
