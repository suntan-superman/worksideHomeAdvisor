import { z } from 'zod';
import { createProviderCheckoutSession } from '../billing/billing.service.js';
import { verifySessionToken } from '../../services/sessionService.js';
import { signup as signupAccount } from '../auth/auth.service.js';
import { UserModel } from '../auth/auth.model.js';
import { ProviderModel } from './provider.model.js';

import {
  createProviderLeadRequest,
  createProviderPortalSessionForUser,
  createProviderPortalSession,
  createProviderProfile,
  listProviderCategories,
  listProviderLeadsForProperty,
  listProvidersForProperty,
  respondToProviderPortalLead,
  saveProviderForProperty,
  updateProviderPortalProfile,
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
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  businessName: z.string().trim().min(1).max(140),
  categoryKey: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(7).max(40),
  password: z.string().min(8).max(120).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(40),
  zipCodes: z.array(z.string().trim().min(3).max(12)).max(25).optional(),
  radiusMiles: z.number().int().min(5).max(150).optional(),
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  yearsInBusiness: z.number().int().min(0).max(80).optional(),
  turnaroundLabel: z.string().trim().max(80).optional(),
  pricingSummary: z.string().trim().max(140).optional(),
  serviceHighlights: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
  deliveryMode: z.enum(['sms', 'email', 'sms_and_email']).optional(),
  notifyPhone: z.string().trim().max(40).optional(),
  notifyEmail: z.string().trim().email().max(120).optional(),
  preferredContactMethod: z.enum(['sms', 'email', 'phone']).optional(),
  planCode: z.string().trim().max(60).optional(),
  smsOptIn: z.boolean().optional(),
});

const providerBillingCheckoutSchema = z.object({
  providerId: z.string().min(1),
  planCode: z.string().trim().min(1).max(60),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const providerPortalSessionSchema = z.object({
  providerId: z.string().min(1),
  token: z.string().min(1),
});

const providerPortalProfileSchema = z.object({
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  turnaroundLabel: z.string().trim().max(80).optional(),
  pricingSummary: z.string().trim().max(140).optional(),
  serviceHighlights: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
  zipCodes: z.array(z.string().trim().min(3).max(12)).max(25).optional(),
  radiusMiles: z.number().int().min(5).max(150).optional(),
  deliveryMode: z.enum(['sms', 'email', 'sms_and_email']).optional(),
  notifyPhone: z.string().trim().max(40).optional(),
  notifyEmail: z.string().trim().email().max(120).optional(),
  preferredContactMethod: z.enum(['sms', 'email', 'phone']).optional(),
});

const providerPortalRespondSchema = z.object({
  providerId: z.string().min(1),
  responseStatus: z.enum(['accepted', 'declined']),
  note: z.string().trim().max(280).optional(),
});

function getProviderPortalToken(request) {
  return String(request.headers['x-provider-portal-token'] || '').trim();
}

function getAuthenticatedSession(request) {
  const authorization = request.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

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
      const session = getAuthenticatedSession(request);
      const normalizedEmail = payload.email.toLowerCase();
      let userId = session?.sub || '';
      let userEmail = session?.email || normalizedEmail;
      let userRole = session?.role || '';
      let requiresOtpVerification = false;

      if (!session?.sub) {
        if (!payload.password || !payload.firstName || !payload.lastName) {
          throw new Error('First name, last name, password, and email verification are required for provider signup.');
        }

        const [existingUser, existingProvider] = await Promise.all([
          UserModel.findOne({ email: normalizedEmail }).lean(),
          ProviderModel.findOne({ email: normalizedEmail }).lean(),
        ]);

        if (existingUser) {
          throw new Error('An account with that email already exists. Log in as a provider to continue.');
        }

        if (existingProvider) {
          throw new Error('A provider profile already exists for that email address. Log in as that provider to continue.');
        }

        const authSignup = await signupAccount({
          email: normalizedEmail,
          password: payload.password,
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: 'provider',
        });

        userId = authSignup.userId;
        userEmail = authSignup.email;
        userRole = 'provider';
        requiresOtpVerification = Boolean(authSignup.requiresOtpVerification);
      }

      const provider = await createProviderProfile(payload, {
        createdFrom: 'provider_portal',
        status: 'pending_billing',
        userId,
        userEmail,
        userRole,
      });
      const { portalAccessToken = '', ...providerRecord } = provider || {};
      return reply.code(201).send({
        provider: providerRecord,
        portalAccessToken,
        requiresOtpVerification,
        email: userEmail,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/provider-portal/billing/checkout', async (request, reply) => {
    try {
      const payload = providerBillingCheckoutSchema.parse(request.body || {});
      const result = await createProviderCheckoutSession(payload);
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/provider-portal/session', async (request, reply) => {
    try {
      const authSession = getAuthenticatedSession(request);
      if (authSession?.sub) {
        const providerSession = await createProviderPortalSessionForUser(authSession.sub);
        return reply.send({ session: providerSession });
      }
      const payload = providerPortalSessionSchema.parse(request.body || {});
      const providerSession = await createProviderPortalSession(payload);
      return reply.send({ session: providerSession });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/provider-portal/providers/:providerId/profile', async (request, reply) => {
    try {
      const { providerId } = providerParamsSchema.parse(request.params);
      const payload = providerPortalProfileSchema.parse(request.body || {});
      const token = getProviderPortalToken(request);
      const result = await updateProviderPortalProfile(providerId, token, payload);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/provider-portal/dispatches/:providerId/:dispatchId/respond', async (request, reply) => {
    try {
      const params = z.object({
        providerId: z.string().min(1),
        dispatchId: z.string().min(1),
      }).parse(request.params);
      const payload = providerPortalRespondSchema.parse(request.body || {});
      const token = getProviderPortalToken(request);
      const result = await respondToProviderPortalLead(params.dispatchId, {
        providerId: payload.providerId || params.providerId,
        token,
        responseStatus: payload.responseStatus,
        note: payload.note,
      });
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
