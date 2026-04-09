import { photoAnalysisSchema } from '@workside/validation';
import { z } from 'zod';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import { readStoredAsset } from '../../services/storageService.js';
import { assertPropertyEditableById, getPropertyById } from '../properties/property.service.js';
import {
  createImageEnhancementJob,
  getVisionPresetCatalog,
  getImageJobById,
  listImageJobsForAsset,
  getMediaVariantById,
  listMediaVariants,
  selectMediaVariant,
  updateMediaVariantUsage,
} from './media-ai.service.js';
import { VISION_PLAN_VALUES } from './vision-orchestrator.helpers.js';
import {
  createMediaAssetAndAnalysis,
  deleteMediaAsset,
  getMediaAssetById,
  listMediaAssets,
  pruneMediaVariantDrafts,
  updateMediaAsset,
} from './media.service.js';
import { getVisionPresetKeys } from './vision-presets.js';

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

const assetParamsSchema = z.object({
  assetId: z.string().min(1),
});

const jobParamsSchema = z.object({
  jobId: z.string().min(1),
});

const variantParamsSchema = z.object({
  variantId: z.string().min(1),
});

const variantUsageSchema = z.object({
  value: z.boolean(),
});

const updateMediaAssetSchema = z.object({
  roomLabel: z.string().min(1).max(120).optional(),
  notes: z.string().max(500).optional(),
  listingCandidate: z.boolean().optional(),
  listingNote: z.string().max(280).optional(),
});

const imageJobRequestSchema = z.object({
  jobType: z.string().optional(),
  presetKey: z.string().optional(),
  sourceVariantId: z.string().min(1).optional(),
  roomType: z.string().max(80).optional(),
  workflowStageKey: z.string().max(80).optional(),
  mode: z.enum(['preset', 'freeform']).optional(),
  instructions: z.string().trim().max(600).optional(),
  forceRegenerate: z.boolean().optional(),
  userPlan: z.enum(VISION_PLAN_VALUES).optional(),
}).superRefine((value, context) => {
  const requestedPresetKey = value.presetKey || value.jobType || 'enhance_listing_quality';
  if (value.mode !== 'freeform' && !getVisionPresetKeys().includes(requestedPresetKey)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unsupported vision preset: ${requestedPresetKey}`,
      path: ['presetKey'],
    });
  }

  if (value.mode === 'freeform' && !String(value.instructions || '').trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Freeform enhancement instructions are required.',
      path: ['instructions'],
    });
  }
});

const mediaCreateSchema = photoAnalysisSchema.extend({
  source: z
    .enum(['mobile_capture', 'mobile_library', 'web_upload', 'third_party_import'])
    .optional(),
  notes: z.string().max(500).optional(),
});

const photoEnhanceSchema = z.object({
  assetId: z.string().min(1),
  presetKey: z.string().optional(),
  jobType: z.string().optional(),
  sourceVariantId: z.string().min(1).optional(),
  roomType: z.string().max(80).optional(),
  workflowStageKey: z.string().max(80).optional(),
  mode: z.enum(['preset', 'freeform']).optional(),
  instructions: z.string().trim().max(600).optional(),
  forceRegenerate: z.boolean().optional(),
  userPlan: z.enum(VISION_PLAN_VALUES).optional(),
});

const pruneVisionDraftsSchema = z.object({
  keepVariantId: z.string().min(1),
});

export async function mediaRoutes(fastify) {
  fastify.get('/vision/presets', async (_request, reply) => {
    return reply.send({ presets: getVisionPresetCatalog() });
  });

  fastify.get('/properties/:propertyId/media', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const assets = await listMediaAssets(propertyId);
      return reply.send({ assets });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/media/analyze-photo', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const payload = photoAnalysisSchema.parse(request.body);
      const property = await getPropertyById(propertyId);

      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const analysis = await analyzePropertyPhoto({
        property,
        roomLabel: payload.roomLabel,
        mimeType: payload.mimeType,
        imageBase64: payload.imageBase64,
        width: payload.width,
        height: payload.height,
      });

      return reply.send({
        analysis,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/properties/:propertyId/media', async (request, reply) => {
    try {
      const { propertyId } = paramsSchema.parse(request.params);
      const payload = mediaCreateSchema.parse(request.body);
      const result = await createMediaAssetAndAnalysis({
        propertyId,
        roomLabel: payload.roomLabel,
        source: payload.source,
        notes: payload.notes,
        mimeType: payload.mimeType,
        imageBase64: payload.imageBase64,
        width: payload.width,
        height: payload.height,
      });

      return reply.code(201).send(result);
    } catch (error) {
      const statusCode = error.message === 'Property not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/media/assets/:assetId', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const payload = updateMediaAssetSchema.parse(request.body);
      const asset = await updateMediaAsset(assetId, payload);
      return reply.send({ asset });
    } catch (error) {
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.delete('/media/assets/:assetId', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const result = await deleteMediaAsset(assetId);
      return reply.send(result);
    } catch (error) {
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/media/assets/:assetId/enhance', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const asset = await getMediaAssetById(assetId);
      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }
      await assertPropertyEditableById(asset.propertyId);
      const payload = imageJobRequestSchema.parse(request.body ?? {});
      const result = await createImageEnhancementJob({
        assetId,
        jobType: payload.jobType,
        presetKey: payload.presetKey,
        sourceVariantId: payload.sourceVariantId,
        roomType: payload.roomType,
        workflowStageKey: payload.workflowStageKey,
        mode: payload.mode,
        instructions: payload.instructions,
        forceRegenerate: payload.forceRegenerate,
        userPlan: payload.userPlan,
      });
      return reply.code(201).send(result);
    } catch (error) {
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/media/assets/:assetId/vision/enhance', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const asset = await getMediaAssetById(assetId);
      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }
      await assertPropertyEditableById(asset.propertyId);
      const payload = imageJobRequestSchema.parse(request.body ?? {});
      const result = await createImageEnhancementJob({
        assetId,
        jobType: payload.jobType,
        presetKey: payload.presetKey,
        sourceVariantId: payload.sourceVariantId,
        roomType: payload.roomType,
        workflowStageKey: payload.workflowStageKey,
        mode: payload.mode,
        instructions: payload.instructions,
        forceRegenerate: payload.forceRegenerate,
        userPlan: payload.userPlan,
      });
      return reply.code(201).send(result);
    } catch (error) {
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.post('/photos/enhance', async (request, reply) => {
    try {
      const payload = photoEnhanceSchema.parse(request.body ?? {});
      const asset = await getMediaAssetById(payload.assetId);
      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }
      await assertPropertyEditableById(asset.propertyId);
      const result = await createImageEnhancementJob({
        assetId: payload.assetId,
        jobType: payload.jobType,
        presetKey: payload.presetKey,
        sourceVariantId: payload.sourceVariantId,
        roomType: payload.roomType,
        workflowStageKey: payload.workflowStageKey,
        mode: payload.mode,
        instructions: payload.instructions,
        forceRegenerate: payload.forceRegenerate,
        userPlan: payload.userPlan,
      });
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(error.message === 'Media asset not found.' ? 404 : 400).send({ message: error.message });
    }
  });

  fastify.get('/media/assets/:assetId/variants', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const variants = await listMediaVariants(assetId);
      return reply.send({ variants });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/media/assets/:assetId/vision/variants', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const variants = await listMediaVariants(assetId);
      return reply.send({ variants });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/media/assets/:assetId/vision/prune-drafts', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const payload = pruneVisionDraftsSchema.parse(request.body ?? {});
      const result = await pruneMediaVariantDrafts(assetId, payload.keepVariantId);
      return reply.send(result);
    } catch (error) {
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/media/assets/:assetId/variants/:variantId/select', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const { variantId } = variantParamsSchema.parse(request.params);
      const asset = await getMediaAssetById(assetId);
      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }
      await assertPropertyEditableById(asset.propertyId);
      const variant = await selectMediaVariant(assetId, variantId);
      return reply.send({ variant });
    } catch (error) {
      const statusCode = error.message === 'Media variant not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/media/assets/:assetId/variants/:variantId/use-in-brochure', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const { variantId } = variantParamsSchema.parse(request.params);
      const asset = await getMediaAssetById(assetId);
      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }
      await assertPropertyEditableById(asset.propertyId);
      const payload = variantUsageSchema.parse(request.body ?? {});
      const variant = await updateMediaVariantUsage(assetId, variantId, {
        useInBrochure: payload.value,
      });
      return reply.send({ variant });
    } catch (error) {
      const statusCode = error.message === 'Media variant not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.patch('/media/assets/:assetId/variants/:variantId/use-in-report', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const { variantId } = variantParamsSchema.parse(request.params);
      const asset = await getMediaAssetById(assetId);
      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }
      await assertPropertyEditableById(asset.propertyId);
      const payload = variantUsageSchema.parse(request.body ?? {});
      const variant = await updateMediaVariantUsage(assetId, variantId, {
        useInReport: payload.value,
      });
      return reply.send({ variant });
    } catch (error) {
      const statusCode = error.message === 'Media variant not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.get('/image-jobs/:jobId', async (request, reply) => {
    try {
      const { jobId } = jobParamsSchema.parse(request.params);
      const job = await getImageJobById(jobId);

      if (!job) {
        return reply.code(404).send({ message: 'Image job not found.' });
      }

      return reply.send({ job });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/vision/jobs/:jobId', async (request, reply) => {
    try {
      const { jobId } = jobParamsSchema.parse(request.params);
      const job = await getImageJobById(jobId);

      if (!job) {
        return reply.code(404).send({ message: 'Image job not found.' });
      }

      return reply.send({ job });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/media/assets/:assetId/vision/jobs', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const limit = Math.max(1, Math.min(20, Number(request.query?.limit || 10)));
      const jobs = await listImageJobsForAsset(assetId, { limit });
      return reply.send({ jobs });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/media/assets/:assetId/file', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const asset = await getMediaAssetById(assetId);

      if (!asset) {
        return reply.code(404).send({ message: 'Media asset not found.' });
      }

      if (asset.storageKey) {
        const stored = await readStoredAsset({
          storageProvider: asset.storageProvider,
          storageKey: asset.storageKey,
        });
        reply.header('Content-Type', asset.mimeType);
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        return reply.send(stored.buffer);
      }

      if (asset.imageDataUrl) {
        const [, base64Payload = ''] = asset.imageDataUrl.split(',');
        const buffer = Buffer.from(base64Payload, 'base64');
        reply.header('Content-Type', asset.mimeType);
        return reply.send(buffer);
      }

      return reply.code(404).send({ message: 'Media file not found.' });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/media/variants/:variantId/file', async (request, reply) => {
    try {
      const { variantId } = variantParamsSchema.parse(request.params);
      const variant = await getMediaVariantById(variantId);

      if (!variant) {
        return reply.code(404).send({ message: 'Media variant not found.' });
      }

      const stored = await readStoredAsset({
        storageProvider: variant.storageProvider,
        storageKey: variant.storageKey,
      });
      reply.header('Content-Type', variant.mimeType || 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(stored.buffer);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
