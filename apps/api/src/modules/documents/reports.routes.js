import { getPropertyById } from '../properties/property.service.js';
import {
  exportPropertyFlyerPdf,
  getLatestPropertyFlyer,
} from './flyer.service.js';
import {
  exportPropertyReportPdf,
  getLatestPropertyReport,
} from './report.service.js';

export async function reportsRoutes(fastify) {
  fastify.get('/property-summary/:propertyId', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const report = await getLatestPropertyReport(request.params.propertyId);

      return reply.send({
        reportType: 'property_summary',
        propertyId: request.params.propertyId,
        report,
        generationRequired: !report,
        exportUrl: `/api/v1/reports/property-summary/${request.params.propertyId}/export.pdf`,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/property-summary/:propertyId/export.pdf', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const latestReport = await getLatestPropertyReport(request.params.propertyId);
      if (!latestReport) {
        return reply.code(404).send({ message: 'Report not found. Generate a report first.' });
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

  fastify.get('/marketing/:propertyId', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const flyer = await getLatestPropertyFlyer(request.params.propertyId, 'sale');

      return reply.send({
        reportType: 'marketing_report',
        propertyId: request.params.propertyId,
        flyer,
        generationRequired: !flyer,
        exportUrl: `/api/v1/reports/marketing/${request.params.propertyId}/export.pdf`,
      });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/marketing/:propertyId/export.pdf', async (request, reply) => {
    try {
      const property = await getPropertyById(request.params.propertyId);
      if (!property) {
        return reply.code(404).send({ message: 'Property not found.' });
      }

      const latestFlyer = await getLatestPropertyFlyer(request.params.propertyId, 'sale');
      if (!latestFlyer) {
        return reply.code(404).send({ message: 'Flyer not found. Generate a flyer first.' });
      }

      const { bytes, filename } = await exportPropertyFlyerPdf({
        propertyId: request.params.propertyId,
        flyerType: 'sale',
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
