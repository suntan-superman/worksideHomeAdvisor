import { propertySchema } from '@workside/validation';
import mongoose from 'mongoose';
import { z } from 'zod';

import {
  archiveProperty,
  createProperty,
  deleteProperty,
  getPropertyById,
  listProperties,
  restoreProperty,
  updatePropertyPricingDecision,
} from './property.service.js';
import { getPropertyWorkspaceSnapshot } from './property-workspace.service.js';
import { recordPublicFunnelEvent } from '../public/public.service.js';

const querySchema = z.object({
  ownerUserId: z.string().optional(),
});

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

const pricingDecisionSchema = z.object({
  selectedListPrice: z.number().int().positive().nullable(),
  selectedListPriceSource: z
    .enum(['recommended_low', 'recommended_mid', 'recommended_high', 'custom'])
    .optional(),
});

export async function propertyRoutes(fastify) {
  fastify.get('/', async (request, reply) => {
    try {
      const query = querySchema.parse(request.query ?? {});
      const properties = await listProperties(query.ownerUserId);
      return reply.send({ properties });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const payload = propertySchema.parse(request.body);
      const ownerUserId =
        request.headers['x-user-id'] || new mongoose.Types.ObjectId().toString();
      const property = await createProperty(ownerUserId, payload);

      if (property.attribution) {
        await recordPublicFunnelEvent({
          eventName: 'property_created',
          anonymousId: property.attribution.anonymousId,
          userId: ownerUserId,
          propertyId: property.id,
          attribution: property.attribution,
          payload: {
            propertyType: property.propertyType,
            city: property.city,
            state: property.state,
            selectedListPrice: property.selectedListPrice,
          },
          sessionStage: 'property_created',
        });
      }

      return reply.code(201).send({ property });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const property = await getPropertyById(propertyId);

      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      return reply.send({ property });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/full', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const snapshot = await getPropertyWorkspaceSnapshot(propertyId);

      if (!snapshot?.property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      return reply.send(snapshot);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/:propertyId/pricing-decision', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const payload = pricingDecisionSchema.parse(request.body ?? {});
      const actorUserId = String(request.headers['x-user-id'] || '');
      const property = await updatePropertyPricingDecision(propertyId, payload, actorUserId);
      return reply.send({ property });
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.'
          ? 404
          : error.message.includes('permission')
            ? 403
            : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/:propertyId/archive', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const actorUserId = String(request.headers['x-user-id'] || '');
      const property = await archiveProperty(propertyId, actorUserId);
      return reply.send({ property });
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.'
          ? 404
          : error.message.includes('permission')
            ? 403
            : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/:propertyId/restore', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const actorUserId = String(request.headers['x-user-id'] || '');
      const property = await restoreProperty(propertyId, actorUserId);
      return reply.send({ property });
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.'
          ? 404
          : error.message.includes('permission')
            ? 403
            : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.delete('/:propertyId', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const actorUserId = String(request.headers['x-user-id'] || '');
      const result = await deleteProperty(propertyId, actorUserId);
      return reply.send(result);
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.'
          ? 404
          : error.message.includes('permission')
            ? 403
            : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });
}
