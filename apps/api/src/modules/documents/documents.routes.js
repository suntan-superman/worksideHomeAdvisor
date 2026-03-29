import { z } from 'zod';

import { getPropertyById } from '../properties/property.service.js';
import {
  enforceAnalysisRequest,
  finalizeCachedAnalysisReturn,
  finalizeFreshAnalysisRun,
  releaseAnalysisLock,
} from '../usage/usage-enforcement.service.js';
import {
  exportPropertyFlyerPdf,
  generatePropertyFlyer,
  getLatestPropertyFlyer,
} from './flyer.service.js';
import {
  exportPropertyReportPdf,
  generatePropertyReport,
  getPropertyReportInputSignature,
  getLatestPropertyReport,
} from './report.service.js';

const flyerRequestSchema = z.object({
  flyerType: z.enum(['sale', 'rental']).default('sale'),
  customizations: z
    .object({
      headline: z.string().trim().max(140).optional(),
      subheadline: z.string().trim().max(220).optional(),
      summary: z.string().trim().max(600).optional(),
      callToAction: z.string().trim().max(180).optional(),
      selectedPhotoAssetIds: z.array(z.string().trim().min(1)).max(6).optional(),
    })
    .default({}),
});

const reportRequestSchema = z.object({
  customizations: z
    .object({
      title: z.string().trim().max(180).optional(),
      executiveSummary: z.string().trim().max(1200).optional(),
      listingDescription: z.string().trim().max(1200).optional(),
      selectedPhotoAssetIds: z.array(z.string().trim().min(1)).max(8).optional(),
      includedSections: z.array(z.string().trim().min(1)).max(12).optional(),
    })
    .default({}),
});

export async function documentsRoutes(fastify) {
  fastify.post('/:propertyId/flyer/generate', async (request, reply) => {
    try {
      const payload = flyerRequestSchema.parse(request.body || {});
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const latestFlyer = await getLatestPropertyFlyer(request.params.propertyId);
      const decision = await enforceAnalysisRequest({
        userId: property.ownerUserId,
        propertyId: request.params.propertyId,
        analysisType: 'flyer',
        featureKey: 'flyer.generate',
        latestResult: latestFlyer,
        resultTimestamp: latestFlyer?.createdAt,
        cooldownHours: 1,
        inputSignature: {
          propertyId: request.params.propertyId,
          flyerType: payload.flyerType,
          updatedAt: property.updatedAt,
          customizations: payload.customizations,
        },
      });

      if (decision.action === 'RETURN_CACHED_RESULT') {
        await finalizeCachedAnalysisReturn({
          userId: property.ownerUserId,
          propertyId: request.params.propertyId,
          analysisType: 'flyer',
          usageContext: decision.context,
        });
        return reply.send({
          flyer: decision.cachedResult,
          metadata: {
            servedFromCache: true,
            cacheReason: decision.cacheReason,
            cachedAt: decision.cachedAt,
          },
        });
      }

      if (decision.action === 'DENY_UPGRADE_REQUIRED') {
        return reply.code(402).send({
          message: 'Plan limit reached or feature not included.',
          ...decision,
        });
      }

      if (decision.action === 'DENY_RATE_LIMIT') {
        return reply
          .code(429)
          .header('Retry-After', String(decision.retryAfterSeconds))
          .send({
            message: 'Too many flyer requests in a short time.',
            ...decision,
          });
      }

      let flyer;
      try {
        flyer = await generatePropertyFlyer({
          propertyId: request.params.propertyId,
          flyerType: payload.flyerType,
          customizations: payload.customizations,
        });
        await finalizeFreshAnalysisRun({
          userId: property.ownerUserId,
          propertyId: request.params.propertyId,
          analysisType: 'flyer',
          usageContext: decision.context,
          inputHash: decision.inputHash,
        });
      } catch (error) {
        await releaseAnalysisLock({
          userId: property.ownerUserId,
          propertyId: request.params.propertyId,
          analysisType: 'flyer',
          inputHash: decision.inputHash,
        });
        throw error;
      }

      return reply.code(201).send({
        flyer,
        metadata: {
          servedFromCache: false,
        },
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/flyer/latest', async (request, reply) => {
    try {
      const flyer = await getLatestPropertyFlyer(request.params.propertyId);
      return reply.send({ flyer });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/flyer/export.pdf', async (request, reply) => {
    try {
      const payload = flyerRequestSchema.parse(request.query || {});
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const { bytes, filename } = await exportPropertyFlyerPdf({
        propertyId: request.params.propertyId,
        flyerType: payload.flyerType,
      });

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(Buffer.from(bytes));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.post('/:propertyId/report/generate', async (request, reply) => {
    try {
      const payload = reportRequestSchema.parse(request.body || {});
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const latestReport = await getLatestPropertyReport(request.params.propertyId);
      const reportInputSignature = await getPropertyReportInputSignature(
        request.params.propertyId,
        payload.customizations,
      );
      const decision = await enforceAnalysisRequest({
        userId: property.ownerUserId,
        propertyId: request.params.propertyId,
        analysisType: 'report',
        featureKey: 'reports.client_ready',
        latestResult: latestReport,
        resultTimestamp: latestReport?.createdAt,
        cooldownHours: 6,
        inputSignature: reportInputSignature,
      });

      if (decision.action === 'RETURN_CACHED_RESULT') {
        await finalizeCachedAnalysisReturn({
          userId: property.ownerUserId,
          propertyId: request.params.propertyId,
          analysisType: 'report',
          usageContext: decision.context,
        });
        return reply.send({
          report: decision.cachedResult,
          metadata: {
            servedFromCache: true,
            cacheReason: decision.cacheReason,
            cachedAt: decision.cachedAt,
          },
        });
      }

      if (decision.action === 'DENY_UPGRADE_REQUIRED') {
        return reply.code(402).send({
          message: 'Plan limit reached or feature not included.',
          ...decision,
        });
      }

      if (decision.action === 'DENY_RATE_LIMIT') {
        return reply
          .code(429)
          .header('Retry-After', String(decision.retryAfterSeconds))
          .send({
            message: 'Too many report requests in a short time.',
            ...decision,
          });
      }

      let report;
      try {
        report = await generatePropertyReport({
          propertyId: request.params.propertyId,
          customizations: payload.customizations,
        });
        await finalizeFreshAnalysisRun({
          userId: property.ownerUserId,
          propertyId: request.params.propertyId,
          analysisType: 'report',
          usageContext: decision.context,
          inputHash: decision.inputHash,
        });
      } catch (error) {
        await releaseAnalysisLock({
          userId: property.ownerUserId,
          propertyId: request.params.propertyId,
          analysisType: 'report',
          inputHash: decision.inputHash,
        });
        throw error;
      }

      return reply.code(201).send({
        report,
        metadata: {
          servedFromCache: false,
        },
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/report/latest', async (request, reply) => {
    try {
      const report = await getLatestPropertyReport(request.params.propertyId);
      return reply.send({ report });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/:propertyId/report/export.pdf', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const { bytes, filename } = await exportPropertyReportPdf({
        propertyId: request.params.propertyId,
      });

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(Buffer.from(bytes));
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
