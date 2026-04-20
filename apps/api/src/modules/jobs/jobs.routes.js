import { z } from 'zod';

import {
  cancelJob,
  getJobById,
  listJobsForProperty,
} from './jobs.service.js';
import { JOB_KIND_VALUES } from './job.model.js';

const jobParamsSchema = z.object({
  jobId: z.string().min(1),
});

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const jobListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).optional(),
  kind: z.enum(JOB_KIND_VALUES).optional(),
});

export async function jobsRoutes(fastify) {
  fastify.get('/jobs/:jobId', async (request, reply) => {
    try {
      const { jobId } = jobParamsSchema.parse(request.params);
      const job = await getJobById(jobId);
      if (!job) {
        return reply.code(404).send({ message: 'Job not found.' });
      }

      return reply.send({ job });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.patch('/jobs/:jobId/cancel', async (request, reply) => {
    try {
      const { jobId } = jobParamsSchema.parse(request.params);
      const job = await cancelJob(jobId);
      if (!job) {
        return reply.code(404).send({ message: 'Job not found.' });
      }

      return reply.send({ job });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });

  fastify.get('/properties/:propertyId/jobs', async (request, reply) => {
    try {
      const { propertyId } = propertyParamsSchema.parse(request.params);
      const query = jobListQuerySchema.parse(request.query ?? {});
      const jobs = await listJobsForProperty(propertyId, query);
      return reply.send({ jobs });
    } catch (error) {
      return reply.code(400).send({ message: error.message });
    }
  });
}
