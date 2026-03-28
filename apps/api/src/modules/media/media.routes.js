import { photoAnalysisSchema } from '@workside/validation';
import { z } from 'zod';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import { readStoredAsset } from '../../services/storageService.js';
import { getPropertyById } from '../properties/property.service.js';
import {
  createImageEnhancementJob,
  getImageJobById,
  getMediaVariantById,
  listMediaVariants,
  selectMediaVariant,
} from './media-ai.service.js';
import {
  createMediaAssetAndAnalysis,
  getMediaAssetById,
  listMediaAssets,
  updateMediaAsset,
} from './media.service.js';

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

const updateMediaAssetSchema = z.object({
  roomLabel: z.string().min(1).max(120).optional(),
  listingCandidate: z.boolean().optional(),
  listingNote: z.string().max(280).optional(),
});

const imageJobRequestSchema = z.object({
  jobType: z.enum(['enhance_listing_quality', 'declutter_preview']).default('enhance_listing_quality'),
});

export async function mediaRoutes(fastify) {
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
      const payload = photoAnalysisSchema.parse(request.body);
      const result = await createMediaAssetAndAnalysis({
        propertyId,
        roomLabel: payload.roomLabel,
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

  fastify.post('/media/assets/:assetId/enhance', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const payload = imageJobRequestSchema.parse(request.body ?? {});
      const result = await createImageEnhancementJob({
        assetId,
        jobType: payload.jobType,
      });
      return reply.code(201).send(result);
    } catch (error) {
      const statusCode = error.message === 'Media asset not found.' ? 404 : 400;
      return reply.code(statusCode).send({ message: error.message });
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

  fastify.patch('/media/assets/:assetId/variants/:variantId/select', async (request, reply) => {
    try {
      const { assetId } = assetParamsSchema.parse(request.params);
      const { variantId } = variantParamsSchema.parse(request.params);
      const variant = await selectMediaVariant(assetId, variantId);
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
