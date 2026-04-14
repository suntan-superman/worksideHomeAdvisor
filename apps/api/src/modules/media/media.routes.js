import { photoAnalysisSchema } from '@workside/validation';
import { z } from 'zod';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import { readStoredAsset, verifyTemporaryStoredAssetToken } from '../../services/storageService.js';
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
  deleteMediaVariantDraft,
  deleteMediaAsset,
  getMediaAssetById,
  listMediaAssets,
  pruneMediaVariantDrafts,
  saveMediaVariantToPhotos,
  updateMediaAsset,
} from './media.service.js';
import { getVisionPresetKeys } from './vision-presets.js';

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

const assetParamsSchema = z.object({
  assetId: z.string().min(1),
});

const mediaVariantListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeTotalCount: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return false;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      return value === 'true' || value === '1';
    }),
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

const nonEmptyTrimmedString = z.string().trim().min(1);

const imageJobRequestSchema = z.object({
  jobType: nonEmptyTrimmedString.optional(),
  presetKey: nonEmptyTrimmedString.optional(),
  sourceVariantId: nonEmptyTrimmedString.optional(),
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
  presetKey: nonEmptyTrimmedString.optional(),
  jobType: nonEmptyTrimmedString.optional(),
  sourceVariantId: nonEmptyTrimmedString.optional(),
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

const saveVariantToPhotosSchema = z.object({
  propertyId: z.string().min(1).optional(),
  roomLabel: z.string().min(1).max(120).optional(),
  generationStage: z.enum(['clean_room', 'finishes', 'style']).optional(),
  generationLabel: z.string().max(160).optional(),
  listingCandidate: z.boolean().optional(),
});

const temporaryMediaTokenQuerySchema = z.object({
  token: z.string().min(1),
});

export async function mediaRoutes(fastify) {
  const serveTemporaryMedia = async (token, reply) => {
    const temporaryAsset = verifyTemporaryStoredAssetToken(token);
    const stored = await readStoredAsset({
      storageProvider: temporaryAsset.storageProvider,
      storageKey: temporaryAsset.storageKey,
    });
    reply.header('Content-Type', temporaryAsset.mimeType || 'image/png');
    reply.header('Cache-Control', 'public, max-age=900');
    return reply.send(stored.buffer);
  };

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
      const isValidationError = error instanceof z.ZodError;
      if (statusCode === 400) {
        console.error('vision_enhance_error', {
          message: error.message,
          issues: isValidationError ? error.issues : undefined,
          presetKey: request?.body?.presetKey,
          jobType: request?.body?.jobType,
          mode: request?.body?.mode,
          workflowStageKey: request?.body?.workflowStageKey,
          sourceVariantId: request?.body?.sourceVariantId,
          assetId: request?.params?.assetId,
          stack: isValidationError ? undefined : error?.stack,
        });
      }
      return reply.code(statusCode).send({
        message: isValidationError ? 'Invalid vision request.' : error.message,
        issues: isValidationError ? error.issues : undefined,
      });
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
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      const isValidationError = error instanceof z.ZodError;
      if (statusCode === 400) {
        console.error('photo_enhance_error', {
          message: error.message,
          issues: isValidationError ? error.issues : undefined,
          presetKey: request?.body?.presetKey,
          jobType: request?.body?.jobType,
          mode: request?.body?.mode,
          workflowStageKey: request?.body?.workflowStageKey,
          sourceVariantId: request?.body?.sourceVariantId,
          assetId: request?.body?.assetId,
          stack: isValidationError ? undefined : error?.stack,
        });
      }
      return reply.code(statusCode).send({
        message: isValidationError ? 'Invalid photo enhancement request.' : error.message,
        issues: isValidationError ? error.issues : undefined,
      });
    }
  });

  fastify.get('/media/assets/:assetId/variants', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const query = mediaVariantListQuerySchema.parse(request.query ?? {});
      const result = await listMediaVariants(assetId, query);
      return Array.isArray(result) ? reply.send({ variants: result }) : reply.send(result);
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/media/assets/:assetId/vision/variants', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const query = mediaVariantListQuerySchema.parse(request.query ?? {});
      const result = await listMediaVariants(assetId, query);
      return Array.isArray(result) ? reply.send({ variants: result }) : reply.send(result);
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

  fastify.post('/media/variants/:variantId/save-to-photos', async (request, reply) => {
    try {
      const { variantId } = variantParamsSchema.parse(request.params);
      const payload = saveVariantToPhotosSchema.parse(request.body ?? {});
      const result = await saveMediaVariantToPhotos(variantId, payload);
      return reply.code(result.created ? 201 : 200).send(result);
    } catch (error) {
      const statusCode =
        error.message === 'Media variant not found.' || error.message === 'Source photo for this variant was not found.'
          ? 404
          : 400;
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

  fastify.delete('/media/assets/:assetId/variants/:variantId', async (request, reply) => {
    const startedAt = Date.now();
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const { variantId } = variantParamsSchema.parse(request.params);
      const result = await deleteMediaVariantDraft(assetId, variantId);
      request.log.info(
        {
          assetId,
          variantId,
          durationMs: Date.now() - startedAt,
          timing: result.timing || null,
        },
        'media variant delete completed',
      );
      return reply.send(result);
    } catch (error) {
      request.log.error(
        {
          err: error,
          assetId: request.params?.assetId,
          variantId: request.params?.variantId,
          durationMs: Date.now() - startedAt,
        },
        'media variant delete failed',
      );
      const statusCode =
        error.message === 'Media asset not found.' || error.message === 'Media variant not found.'
          ? 404
          : 400;
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

  fastify.get('/media/tmp/file', async (request, reply) => {
    try {
      const { token } = temporaryMediaTokenQuerySchema.parse(request.query ?? {});
      return await serveTemporaryMedia(token, reply);
    } catch (error) {
      const statusCode = /expired|signature|invalid/i.test(String(error.message || '')) ? 403 : 400;
      return reply.code(statusCode).send({ message: error.message });
    }
  });

  fastify.get('/media/tmp/:token/file', async (request, reply) => {
    try {
      const token = String(request.params?.token || '');
      return await serveTemporaryMedia(token, reply);
    } catch (error) {
      const statusCode = /expired|signature|invalid/i.test(String(error.message || '')) ? 403 : 400;
      return reply.code(statusCode).send({ message: error.message });
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
