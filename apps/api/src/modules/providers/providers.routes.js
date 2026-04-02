import { z } from 'zod';
import { assertPropertyEditableById } from '../properties/property.service.js';
import {
  createProviderCheckoutSession,
  syncStripeCheckoutSessionById,
} from '../billing/billing.service.js';
import { verifySessionToken } from '../../services/sessionService.js';
import { signup as signupAccount } from '../auth/auth.service.js';
import { UserModel } from '../auth/auth.model.js';
import { ProviderModel } from './provider.model.js';

import {
  createProviderLeadRequest,
  createProviderReferenceForProperty,
  createProviderPortalSessionForUser,
  createProviderPortalSession,
  deleteProviderReference,
  createProviderProfile,
  getProviderVerificationDocumentFile,
  listProviderCategories,
  listProviderLeadsForProperty,
  listProviderReferencesForProperty,
  listProvidersForProperty,
  respondToProviderPortalLead,
  saveProviderForProperty,
  submitProviderVerification,
  uploadProviderVerificationDocument,
  updateProviderPortalProfile,
} from './providers.service.js';

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const stateCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.enum(US_STATE_CODES));

const optionalStateCodeSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.toUpperCase();
}, z.enum(US_STATE_CODES).optional());

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const providerParamsSchema = z.object({
  providerId: z.string().min(1),
});

const providerReferenceParamsSchema = z.object({
  referenceId: z.string().min(1),
});

const providerDiscoveryQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(10).optional(),
  taskKey: z.string().trim().min(1).optional(),
  includeExternal: z.coerce.boolean().optional(),
});

const createLeadSchema = z.object({
  categoryKey: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  sourceRefId: z.string().trim().min(1).optional(),
  message: z.string().trim().max(280).optional(),
  maxProviders: z.number().int().min(1).max(5).optional(),
  deliveryMode: z.enum(['email', 'sms', 'sms_and_email']).optional(),
});

const providerReferenceCreateSchema = z.object({
  source: z.enum(['internal', 'google_maps']).default('internal'),
  sourceRefId: z.string().trim().min(1).max(120).optional(),
  providerId: z.string().trim().min(1).optional(),
  categoryKey: z.string().trim().max(80).optional(),
  categoryLabel: z.string().trim().max(120).optional(),
  businessName: z.string().trim().max(140).optional(),
  description: z.string().trim().max(400).optional(),
  coverageLabel: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().url().max(220).optional().or(z.literal('')),
  mapsUrl: z.string().trim().url().max(220).optional().or(z.literal('')),
  rating: z.coerce.number().min(0).max(5).optional(),
  reviewCount: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().max(240).optional(),
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
  state: stateCodeSchema,
  zipCodes: z.array(z.string().trim().min(3).max(12)).max(25).optional(),
  radiusMiles: z.number().int().min(5).max(1000).optional(),
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  yearsInBusiness: z.number().int().min(0).max(80).optional(),
  turnaroundLabel: z.string().trim().max(80).optional(),
  pricingSummary: z.string().trim().max(140).optional(),
  serviceHighlights: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
  hasInsurance: z.boolean().optional(),
  insuranceCarrier: z.string().trim().max(120).optional(),
  insurancePolicyNumber: z.string().trim().max(80).optional(),
  insuranceExpirationDate: z.string().trim().max(40).optional(),
  hasLicense: z.boolean().optional(),
  licenseNumber: z.string().trim().max(80).optional(),
  licenseState: optionalStateCodeSchema,
  hasBond: z.boolean().optional(),
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

const providerBillingSyncSchema = z.object({
  sessionId: z.string().trim().min(1),
});

const providerPortalSessionSchema = z.object({
  providerId: z.string().min(1),
  token: z.string().min(1),
});

const providerPortalProfileSchema = z.object({
  categoryKey: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(600).optional(),
  websiteUrl: z.string().trim().url().max(180).optional().or(z.literal('')),
  turnaroundLabel: z.string().trim().max(80).optional(),
  pricingSummary: z.string().trim().max(140).optional(),
  serviceHighlights: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
  city: z.string().trim().max(80).optional(),
  state: optionalStateCodeSchema,
  zipCodes: z.array(z.string().trim().min(3).max(12)).max(25).optional(),
  radiusMiles: z.number().int().min(5).max(1000).optional(),
  hasInsurance: z.boolean().optional(),
  insuranceCarrier: z.string().trim().max(120).optional(),
  insurancePolicyNumber: z.string().trim().max(80).optional(),
  insuranceExpirationDate: z.string().trim().max(40).optional(),
  hasLicense: z.boolean().optional(),
  licenseNumber: z.string().trim().max(80).optional(),
  licenseState: optionalStateCodeSchema,
  hasBond: z.boolean().optional(),
  deliveryMode: z.enum(['sms', 'email', 'sms_and_email']).optional(),
  notifyPhone: z.string().trim().max(40).optional(),
  notifyEmail: z.string().trim().email().max(120).optional(),
  preferredContactMethod: z.enum(['sms', 'email', 'phone']).optional(),
});

const providerVerificationDocumentUploadSchema = z.object({
  documentType: z.enum(['insurance_certificate', 'license_document']),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  fileBase64: z.string().min(20),
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
        includeExternal: query.includeExternal,
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
      await assertPropertyEditableById(propertyId);
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

  fastify.get('/properties/:propertyId/provider-references', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const references = await listProviderReferencesForProperty(propertyId);
      return reply.send({ references });
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/provider-references', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      await assertPropertyEditableById(propertyId);
      const payload = providerReferenceCreateSchema.parse(request.body || {});
      const result = await createProviderReferenceForProperty(propertyId, payload);
      return reply.code(201).send(result);
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.delete('/provider-references/:referenceId', async (request, reply) => {
    try {
      const { referenceId } = providerReferenceParamsSchema.parse(request.params);
      const result = await deleteProviderReference(referenceId);
      return reply.send(result);
    } catch (error) {
      const statusCode = error.message === 'Provider reference not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/providers/:providerId/save', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      await assertPropertyEditableById(propertyId);
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

  fastify.post('/provider-portal/billing/sync-session', async (request, reply) => {
    try {
      const payload = providerBillingSyncSchema.parse(request.body || {});
      const result = await syncStripeCheckoutSessionById(payload.sessionId);
      return reply.send({ ok: true, result });
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

  fastify.post('/provider-portal/providers/:providerId/verification-documents', async (request, reply) => {
    try {
      const { providerId } = providerParamsSchema.parse(request.params);
      const payload = providerVerificationDocumentUploadSchema.parse(request.body || {});
      const token = getProviderPortalToken(request);
      const result = await uploadProviderVerificationDocument(providerId, token, payload);
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/provider-portal/providers/:providerId/verification/submit', async (request, reply) => {
    try {
      const { providerId } = providerParamsSchema.parse(request.params);
      const token = getProviderPortalToken(request);
      const result = await submitProviderVerification(providerId, token);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get(
    '/provider-portal/providers/:providerId/verification-documents/:documentType/file',
    async (request, reply) => {
      try {
        const params = z
          .object({
            providerId: z.string().min(1),
            documentType: z.enum(['insurance_certificate', 'license_document']),
          })
          .parse(request.params);
        const token = getProviderPortalToken(request);
        const session = getAuthenticatedSession(request);
        const file = await getProviderVerificationDocumentFile(params.providerId, {
          token,
          session,
          documentType: params.documentType,
        });
        reply.header('Content-Type', file.mimeType);
        reply.header('Content-Disposition', `inline; filename="${file.fileName}"`);
        return reply.send(file.buffer);
      } catch (error) {
        const statusCode =
          error.message === 'Provider not found.' || error.message === 'Verification document not found.'
            ? 404
            : 400;
        return reply.code(statusCode).send({ message: error.message });
      }
    },
  );

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
