import { photoAnalysisSchema } from '@workside/validation';
import { z } from 'zod';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import { readStoredAsset } from '../../services/storageService.js';
import { getPropertyById } from '../properties/property.service.js';
import {
  createMediaAssetAndAnalysis,
  getMediaAssetById,
  listMediaAssets,
} from './media.service.js';

const paramsSchema = z.object({
  propertyId: z.string().min(1),
});

const assetParamsSchema = z.object({
  assetId: z.string().min(1),
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
}
