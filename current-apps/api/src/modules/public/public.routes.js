import { z } from 'zod';
import { normalizeLandingAttribution } from '@workside/utils';

import {
  buildSellerPreviewResponse,
  recordPublicFunnelEvent,
} from './public.service.js';

const sellerPreviewSchema = z.object({
  address: z.string().trim().min(4),
  city: z.string().trim().min(2),
  state: z.string().trim().length(2),
  postalCode: z.string().trim().min(5).max(10),
  propertyType: z
    .enum(['single_family', 'condo', 'townhome', 'multi_family'])
    .default('single_family'),
  bedrooms: z.coerce.number().min(0).max(12).default(3),
  bathrooms: z.coerce.number().min(0).max(12).default(2),
  squareFeet: z.coerce.number().min(400).max(20000),
  source: z.string().trim().optional(),
  campaign: z.string().trim().optional(),
  medium: z.string().trim().optional(),
  adset: z.string().trim().optional(),
  ad: z.string().trim().optional(),
  anonymousId: z.string().trim().optional(),
  route: z.string().trim().optional(),
  landingPath: z.string().trim().optional(),
  referrer: z.string().trim().optional(),
});

const funnelCaptureSchema = z.object({
  email: z.string().email(),
  anonymousId: z.string().trim().optional(),
  roleIntent: z.enum(['seller', 'agent', 'provider']),
  source: z.string().trim().optional(),
  campaign: z.string().trim().optional(),
  medium: z.string().trim().optional(),
  adset: z.string().trim().optional(),
  ad: z.string().trim().optional(),
  route: z.string().trim().optional(),
  landingPath: z.string().trim().optional(),
  referrer: z.string().trim().optional(),
  previewContext: z.record(z.string(), z.unknown()).optional(),
});

const eventSchema = z.object({
  name: z.string().trim().min(1),
  anonymousId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  roleIntent: z.enum(['seller', 'agent', 'provider']).optional(),
  propertyId: z.string().trim().optional(),
  source: z.string().trim().optional(),
  campaign: z.string().trim().optional(),
  medium: z.string().trim().optional(),
  adset: z.string().trim().optional(),
  ad: z.string().trim().optional(),
  route: z.string().trim().optional(),
  landingPath: z.string().trim().optional(),
  referrer: z.string().trim().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  previewContext: z.record(z.string(), z.unknown()).optional(),
});

const continueSignupSchema = z.object({
  email: z.string().email(),
  anonymousId: z.string().trim().optional(),
  roleIntent: z.enum(['seller', 'agent', 'provider']),
  source: z.string().trim().optional(),
  campaign: z.string().trim().optional(),
  medium: z.string().trim().optional(),
  adset: z.string().trim().optional(),
  ad: z.string().trim().optional(),
  route: z.string().trim().optional(),
  landingPath: z.string().trim().optional(),
  referrer: z.string().trim().optional(),
  previewContext: z.record(z.string(), z.unknown()).optional(),
});

export async function publicRoutes(fastify) {
  fastify.post('/seller-preview', async (request, reply) => {
    try {
      const payload = sellerPreviewSchema.parse(request.body);
      const preview = buildSellerPreviewResponse(payload);
      const attribution = normalizeLandingAttribution({
        ...payload,
        roleIntent: 'seller',
      });

      await recordPublicFunnelEvent({
        eventName: 'seller_preview_generated',
        anonymousId: payload.anonymousId,
        attribution,
        previewContext: {
          address: payload.address,
          city: payload.city,
          state: payload.state,
          postalCode: payload.postalCode,
          propertyType: payload.propertyType,
        },
        payload: {
          estimatedMid: preview.estimatedRange.mid,
          marketReadyScore: preview.marketReadyScore,
        },
        sessionStage: 'preview',
      });

      return reply.send({
        ...preview,
        attribution,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/funnel-capture', async (request, reply) => {
    try {
      const payload = funnelCaptureSchema.parse(request.body);
      const result = await recordPublicFunnelEvent({
        eventName: `${payload.roleIntent}_email_captured`,
        anonymousId: payload.anonymousId,
        email: payload.email,
        attribution: payload,
        previewContext: payload.previewContext,
        sessionStage: 'email_gate',
      });

      return reply.code(201).send({
        ok: true,
        capturedAt: new Date().toISOString(),
        attribution: result.attribution,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/events', async (request, reply) => {
    try {
      const payload = eventSchema.parse(request.body);
      const result = await recordPublicFunnelEvent({
        eventName: payload.name,
        anonymousId: payload.anonymousId,
        userId: payload.userId,
        propertyId: payload.propertyId,
        attribution: payload,
        previewContext: payload.previewContext,
        payload: payload.payload,
        sessionStage: payload.name,
      });

      return reply.code(202).send({
        ok: true,
        acceptedAt: new Date().toISOString(),
        attribution: result.attribution,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/continue-signup', async (request, reply) => {
    try {
      const payload = continueSignupSchema.parse(request.body);
      const result = await recordPublicFunnelEvent({
        eventName: 'continue_signup',
        anonymousId: payload.anonymousId,
        email: payload.email,
        attribution: payload,
        previewContext: payload.previewContext,
        sessionStage: 'continue_signup',
      });

      const search = new URLSearchParams({
        mode: 'signup',
        email: payload.email,
        role: payload.roleIntent,
        src: result.attribution.source,
        medium: result.attribution.medium,
        campaign: result.attribution.campaign,
      });

      if (result.attribution.adset) {
        search.set('adset', result.attribution.adset);
      }
      if (result.attribution.ad) {
        search.set('ad', result.attribution.ad);
      }
      if (payload.anonymousId) {
        search.set('anonymousId', payload.anonymousId);
      }

      return reply.send({
        ok: true,
        attribution: result.attribution,
        nextPath: `/auth?${search.toString()}`,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
