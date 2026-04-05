import { z } from 'zod';

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
});

const funnelCaptureSchema = z.object({
  email: z.string().email(),
  roleIntent: z.enum(['seller', 'agent', 'provider']),
  source: z.string().trim().optional(),
  campaign: z.string().trim().optional(),
  medium: z.string().trim().optional(),
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
  route: z.string().trim().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const continueSignupSchema = z.object({
  email: z.string().email(),
  roleIntent: z.enum(['seller', 'agent', 'provider']),
  source: z.string().trim().optional(),
  campaign: z.string().trim().optional(),
  medium: z.string().trim().optional(),
  previewContext: z.record(z.string(), z.unknown()).optional(),
});

function roundToNearestThousand(value) {
  return Math.round(value / 1000) * 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPropertyTypePricePerSqft(propertyType) {
  switch (propertyType) {
    case 'condo':
      return 252;
    case 'townhome':
      return 266;
    case 'multi_family':
      return 238;
    case 'single_family':
    default:
      return 289;
  }
}

function buildPreviewChecklistItems(payload) {
  const items = [];

  if (payload.squareFeet >= 2200) {
    items.push('Prioritize decluttering and staging the largest living spaces first.');
  } else {
    items.push('Tighten the main living spaces and reduce visual clutter before photos.');
  }

  if (payload.bathrooms >= 3) {
    items.push('Refresh bathroom finishes and lighting so the home feels consistently move-in ready.');
  } else {
    items.push('Improve first-impression rooms with light paint touchups and bright neutral finishes.');
  }

  if (payload.propertyType === 'single_family') {
    items.push('Improve curb appeal before launch so the exterior matches the listing price ambition.');
  }

  return items.slice(0, 3);
}

function buildPreviewProviderCategories(payload) {
  const categories = ['photographers'];

  if (payload.propertyType === 'single_family') {
    categories.push('cleaners');
  }

  if (payload.squareFeet >= 2000 || payload.bedrooms >= 4) {
    categories.push('stagers');
  }

  return categories;
}

function buildPreviewResponse(payload) {
  const basePricePerSqft = getPropertyTypePricePerSqft(payload.propertyType);
  const bedroomLift = payload.bedrooms * 5;
  const bathroomLift = payload.bathrooms * 7;
  const sourceLift = payload.source?.includes('agent') ? 8 : 0;
  const estimatedMidpoint = roundToNearestThousand(
    payload.squareFeet * (basePricePerSqft + bedroomLift + bathroomLift + sourceLift),
  );
  const low = roundToNearestThousand(estimatedMidpoint * 0.95);
  const high = roundToNearestThousand(estimatedMidpoint * 1.05);
  const readinessSeed =
    28 +
    Math.round(payload.bathrooms * 5) +
    Math.round(payload.bedrooms * 3) +
    Math.round(Math.min(payload.squareFeet, 2600) / 180);
  const marketReadyScore = clamp(readinessSeed, 32, 71);

  return {
    estimatedRange: {
      low,
      mid: estimatedMidpoint,
      high,
    },
    marketReadyScore,
    previewChecklistItems: buildPreviewChecklistItems(payload),
    previewProviderCategories: buildPreviewProviderCategories(payload),
    requiresSignupForFullPlan: true,
  };
}

export async function publicRoutes(fastify) {
  fastify.post('/seller-preview', async (request, reply) => {
    try {
      const payload = sellerPreviewSchema.parse(request.body);
      return reply.send(buildPreviewResponse(payload));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/funnel-capture', async (request, reply) => {
    try {
      const payload = funnelCaptureSchema.parse(request.body);
      fastify.log.info(
        {
          type: 'funnel_capture',
          roleIntent: payload.roleIntent,
          email: payload.email,
          source: payload.source,
          campaign: payload.campaign,
          medium: payload.medium,
          previewContext: payload.previewContext,
        },
        'Landing funnel capture received.',
      );

      return reply.code(201).send({
        ok: true,
        capturedAt: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/events', async (request, reply) => {
    try {
      const payload = eventSchema.parse(request.body);
      fastify.log.info(
        {
          type: 'landing_event',
          ...payload,
        },
        `Landing event: ${payload.name}`,
      );

      return reply.code(202).send({
        ok: true,
        acceptedAt: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/continue-signup', async (request, reply) => {
    try {
      const payload = continueSignupSchema.parse(request.body);
      fastify.log.info(
        {
          type: 'continue_signup',
          roleIntent: payload.roleIntent,
          email: payload.email,
          source: payload.source,
          campaign: payload.campaign,
          medium: payload.medium,
          previewContext: payload.previewContext,
        },
        'Landing signup continuation requested.',
      );

      const search = new URLSearchParams({
        mode: 'signup',
        email: payload.email,
        role: payload.roleIntent,
      });

      return reply.send({
        ok: true,
        nextPath: `/auth?${search.toString()}`,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
