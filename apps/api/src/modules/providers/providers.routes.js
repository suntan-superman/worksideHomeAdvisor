import { z } from 'zod';

import {
  createProviderLeadRequest,
  createProviderProfile,
  listProviderCategories,
  listProviderLeadsForProperty,
  listProvidersForProperty,
  saveProviderForProperty,
} from './providers.service.js';

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const providerParamsSchema = z.object({
  providerId: z.string().min(1),
});

const providerDiscoveryQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(10).optional(),
  taskKey: z.string().trim().min(1).optional(),
});

const createLeadSchema = z.object({
  categoryKey: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  sourceRefId: z.string().trim().min(1).optional(),
  message: z.string().trim().max(280).optional(),
  maxProviders: z.number().int().min(1).max(5).optional(),
});

const providerSignupSchema = z.object({
  businessName: z.string().trim().min(1).max(140),
  categoryKey: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(7).max(40),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(40),
  zipCodes: z.array(z.string().trim().min(3).max(12)).max(25).optional(),
  radiusMiles: z.number().int().min(5).max(150).optional(),
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  yearsInBusiness: z.number().int().min(0).max(80).optional(),
  deliveryMode: z.enum(['sms', 'email', 'sms_and_email']).optional(),
  notifyPhone: z.string().trim().max(40).optional(),
  notifyEmail: z.string().trim().email().max(120).optional(),
  preferredContactMethod: z.enum(['sms', 'email', 'phone']).optional(),
  planCode: z.string().trim().max(60).optional(),
});

export async function providersRoutes(fastify) {
  fastify.get('/provider-categories', async (_request, reply) => {
    try {
      const categories = await listProviderCategories();
      return reply.send({ categories });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/properties/:propertyId/providers', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const query = providerDiscoveryQuerySchema.parse(request.query || {});
      const providers = await listProvidersForProperty(propertyId, {
        categoryKey: query.category,
        limit: query.limit,
        taskKey: query.taskKey,
      });
      return reply.send({ providers });
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/provider-leads', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const payload = createLeadSchema.parse(request.body || {});
      const lead = await createProviderLeadRequest(propertyId, payload);
      return reply.code(201).send({ lead });
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.get('/properties/:propertyId/provider-leads', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const leads = await listProviderLeadsForProperty(propertyId);
      return reply.send({ leads });
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/providers/:providerId/save', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const { providerId } = providerParamsSchema.parse(request.params);
      const result = await saveProviderForProperty(propertyId, providerId);
      return reply.code(201).send(result);
    } catch (error) {
      const statusCode =
        error.message === 'Property not found.' || error.message === 'Provider not found.'
          ? 404
          : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/provider-portal/signup', async (request, reply) => {
    try {
      const payload = providerSignupSchema.parse(request.body || {});
      const provider = await createProviderProfile(payload, {
        createdFrom: 'provider_portal',
        status: 'pending_billing',
      });
      return reply.code(201).send({ provider });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
