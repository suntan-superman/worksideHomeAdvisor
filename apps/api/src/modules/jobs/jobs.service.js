import mongoose from 'mongoose';

import {
  cancelImageJob,
  createImageEnhancementJob,
  getImageJobById,
  listImageJobsForAsset as listLegacyImageJobsForAsset,
} from '../media/media-ai.service.js';
import { generatePropertyFlyer } from '../documents/flyer.service.js';
import { generatePropertyReport } from '../documents/report.service.js';
import {
  finalizeFreshAnalysisRun,
  releaseAnalysisLock,
} from '../usage/usage-enforcement.service.js';
import { JOB_KIND_VALUES, JobModel } from './job.model.js';

const activeJobRuns = new Map();

function toIdString(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function cloneObject(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeJobResult(result = null) {
  return result && typeof result === 'object' ? cloneObject(result) : result;
}

export function serializeJob(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: toIdString(document._id),
    kind: document.kind,
    status: document.status,
    propertyId: toIdString(document.propertyId),
    mediaAssetId: toIdString(document.mediaAssetId),
    requestedByUserId: toIdString(document.requestedByUserId),
    workerKey: document.workerKey || 'api_inline_background',
    currentStage: document.currentStage || 'queued',
    progressPercent: Number(document.progressPercent || 0),
    message: document.message || '',
    warning: document.warning || '',
    failureReason: document.failureReason || '',
    payload: cloneObject(document.payload || {}),
    result: normalizeJobResult(document.result),
    startedAt: document.startedAt || null,
    completedAt: document.completedAt || null,
    cancelledAt: document.cancelledAt || null,
    lastHeartbeatAt: document.lastHeartbeatAt || null,
    retryCount: Number(document.retryCount || 0),
    maxAttempts: Number(document.maxAttempts || 1),
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}

function mapGenericStatusToVisionStatus(status = '') {
  if (status === 'running') {
    return 'processing';
  }

  return status || 'queued';
}

async function buildVisionProxyJob(serializedJob) {
  if (!serializedJob || serializedJob.kind !== 'vision_enhancement') {
    return null;
  }

  const imageJobId =
    serializedJob.result?.imageJobId ||
    serializedJob.result?.job?.id ||
    serializedJob.payload?.imageJobId ||
    null;

  if (imageJobId) {
    const imageJob = await getImageJobById(imageJobId);
    if (imageJob) {
      return {
        ...imageJob,
        id: serializedJob.id,
        proxyJobId: serializedJob.id,
        imageJobId: imageJob.id,
        status: mapGenericStatusToVisionStatus(serializedJob.status || imageJob.status),
        currentStage: serializedJob.currentStage || imageJob.currentStage,
        message: serializedJob.message || imageJob.message || '',
        warning: serializedJob.warning || imageJob.warning || '',
        failureReason: serializedJob.failureReason || imageJob.failureReason || '',
        createdAt: serializedJob.createdAt || imageJob.createdAt,
        updatedAt: serializedJob.updatedAt || imageJob.updatedAt,
      };
    }
  }

  const payload = serializedJob.payload || {};
  return {
    id: serializedJob.id,
    mediaId: serializedJob.mediaAssetId,
    propertyId: serializedJob.propertyId,
    jobType: payload.jobType || payload.presetKey || 'enhance_listing_quality',
    jobCategory: 'enhancement',
    status: mapGenericStatusToVisionStatus(serializedJob.status),
    provider: 'vision_orchestrator',
    providerJobId: null,
    presetKey: payload.presetKey || payload.jobType || 'enhance_listing_quality',
    requestedPresetKey: payload.presetKey || payload.jobType || 'enhance_listing_quality',
    executionPresetKey: payload.presetKey || payload.jobType || 'enhance_listing_quality',
    mode: payload.mode || 'preset',
    instructions: payload.instructions || '',
    normalizedPlan: null,
    originalUrl: '',
    roomType: payload.roomType || 'unknown',
    promptVersion: 1,
    inputHash: null,
    input: cloneObject(payload),
    outputVariantIds: [],
    selectedVariantId: null,
    message: serializedJob.message || 'Vision generation queued.',
    warning: serializedJob.warning || '',
    attemptCount: 0,
    maxAttempts: 1,
    currentStage: serializedJob.currentStage || 'queued',
    fallbackMode: null,
    failureReason: serializedJob.failureReason || '',
    cancelledAt: serializedJob.cancelledAt || null,
    outputUrls: [],
    variants: [],
    createdAt: serializedJob.createdAt,
    updatedAt: serializedJob.updatedAt,
  };
}

async function executeVisionEnhancementJob(job, helpers) {
  const payload = job.payload || {};
  let linkedImageJobId = payload.imageJobId || null;

  if (await helpers.isCancelled()) {
    return {
      status: 'cancelled',
      currentStage: 'cancelled',
      message: 'Vision generation cancelled.',
      failureReason: 'cancelled_by_user',
      result: {
        imageJobId: linkedImageJobId,
      },
    };
  }

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
    onJobCreated: async (imageJob) => {
      linkedImageJobId = imageJob?.id || linkedImageJobId;
      await helpers.mergeResult({
        imageJobId: linkedImageJobId,
      });
      if (linkedImageJobId && (await helpers.isCancelled())) {
        await cancelImageJob(linkedImageJobId).catch(() => {});
      }
      await helpers.markStage('running_provider', 'Vision generation is running.');
    },
  });

  const outcomeStatus =
    result?.job?.status === 'cancelled'
      ? 'cancelled'
      : result?.job?.status === 'failed'
        ? 'failed'
        : 'completed';

  return {
    status: outcomeStatus,
    currentStage: result?.job?.currentStage || 'completed',
    message:
      result?.job?.message ||
      (outcomeStatus === 'completed'
        ? 'Vision generation completed.'
        : outcomeStatus === 'cancelled'
          ? 'Vision generation cancelled.'
          : 'Vision generation failed.'),
    warning: result?.job?.warning || '',
    failureReason: result?.job?.failureReason || '',
    result: {
      imageJobId: result?.job?.id || linkedImageJobId || null,
      selectedVariantId: result?.variant?.id || result?.job?.selectedVariantId || null,
      variantCount: Array.isArray(result?.variants) ? result.variants.length : 0,
      job: result?.job || null,
      variant: result?.variant || null,
    },
  };
}

async function executePropertyFlyerJob(job, helpers) {
  const payload = job.payload || {};
  try {
    await helpers.markStage('generating_flyer', 'Generating flyer content.');
    const flyer = await generatePropertyFlyer({
      propertyId: payload.propertyId,
      flyerType: payload.flyerType,
      customizations: payload.customizations || {},
    });

    await finalizeFreshAnalysisRun({
      userId: payload.userId,
      propertyId: payload.propertyId,
      analysisType: 'flyer',
      usageContext: payload.usageContext,
      inputHash: payload.inputHash,
    });

    return {
      status: 'completed',
      currentStage: 'completed',
      message: 'Flyer generated.',
      result: {
        flyerId: flyer?.id || null,
        flyer,
      },
    };
  } catch (error) {
    await releaseAnalysisLock({
      userId: payload.userId,
      propertyId: payload.propertyId,
      analysisType: 'flyer',
      inputHash: payload.inputHash,
    });
    throw error;
  }
}

async function executePropertyReportJob(job, helpers) {
  const payload = job.payload || {};
  try {
    await helpers.markStage('generating_report', 'Generating seller intelligence report.');
    const report = await generatePropertyReport({
      propertyId: payload.propertyId,
      customizations: payload.customizations || {},
    });

    await finalizeFreshAnalysisRun({
      userId: payload.userId,
      propertyId: payload.propertyId,
      analysisType: 'report',
      usageContext: payload.usageContext,
      inputHash: payload.inputHash,
    });

    return {
      status: 'completed',
      currentStage: 'completed',
      message: 'Report generated.',
      result: {
        reportId: report?.id || null,
        report,
      },
    };
  } catch (error) {
    await releaseAnalysisLock({
      userId: payload.userId,
      propertyId: payload.propertyId,
      analysisType: 'report',
      inputHash: payload.inputHash,
    });
    throw error;
  }
}

const JOB_EXECUTORS = {
  vision_enhancement: executeVisionEnhancementJob,
  property_flyer: executePropertyFlyerJob,
  property_report: executePropertyReportJob,
};

async function markJobRunning(jobId) {
  const now = new Date();
  const job = await JobModel.findOneAndUpdate(
    {
      _id: jobId,
      status: { $in: ['queued', 'reconnecting'] },
    },
    {
      $set: {
        status: 'running',
        currentStage: 'running',
        startedAt: now,
        lastHeartbeatAt: now,
      },
    },
    {
      new: true,
    },
  );

  if (!job) {
    return null;
  }

  return job;
}

async function processJob(jobId, logger = console) {
  if (activeJobRuns.has(jobId)) {
    return activeJobRuns.get(jobId);
  }

  const runPromise = (async () => {
    const jobDocument = await markJobRunning(jobId);
    if (!jobDocument) {
      return;
    }

    const executor = JOB_EXECUTORS[jobDocument.kind];
    if (!executor) {
      await JobModel.findByIdAndUpdate(jobId, {
        $set: {
          status: 'failed',
          currentStage: 'failed',
          failureReason: 'missing_executor',
          message: 'No executor is registered for this job type.',
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      });
      return;
    }

    const helpers = {
      markStage: async (currentStage, message = '') => {
        await JobModel.findByIdAndUpdate(jobId, {
          $set: {
            currentStage,
            message,
            lastHeartbeatAt: new Date(),
          },
        });
      },
      mergeResult: async (partialResult = {}) => {
        const latest = await JobModel.findById(jobId).lean();
        const nextResult = {
          ...(latest?.result || {}),
          ...(partialResult || {}),
        };
        await JobModel.findByIdAndUpdate(jobId, {
          $set: {
            result: nextResult,
            lastHeartbeatAt: new Date(),
          },
        });
      },
      isCancelled: async () => {
        const latest = await JobModel.findById(jobId).select('status').lean();
        return latest?.status === 'cancelled';
      },
    };

    try {
      const execution = await executor(jobDocument.toObject(), helpers);
      const latest = await JobModel.findById(jobId).lean();
      if (latest?.status === 'cancelled') {
        return;
      }

      await JobModel.findByIdAndUpdate(jobId, {
        $set: {
          status: execution?.status || 'completed',
          currentStage: execution?.currentStage || 'completed',
          message: execution?.message || 'Job completed.',
          warning: execution?.warning || '',
          failureReason: execution?.failureReason || '',
          result: execution?.result || latest?.result || null,
          progressPercent: execution?.status === 'completed' ? 100 : latest?.progressPercent || 0,
          completedAt:
            execution?.status === 'completed' ||
            execution?.status === 'failed' ||
            execution?.status === 'cancelled'
              ? new Date()
              : null,
          lastHeartbeatAt: new Date(),
        },
      });
    } catch (error) {
      logger?.error?.({ err: error, jobId, kind: jobDocument.kind }, 'background job failed');
      await JobModel.findByIdAndUpdate(jobId, {
        $set: {
          status: 'failed',
          currentStage: 'failed',
          failureReason: 'execution_failed',
          message: 'Background job failed.',
          warning: error?.message || 'Unknown error.',
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      });
    }
  })()
    .finally(() => {
      activeJobRuns.delete(jobId);
    });

  activeJobRuns.set(jobId, runPromise);
  return runPromise;
}

function scheduleJob(jobId, logger = console) {
  setTimeout(() => {
    void processJob(jobId, logger);
  }, 0);
}

function buildUsageContextSnapshot(context = {}) {
  return {
    billingCycleKey: context.billingCycleKey,
    planCode: context.planCode,
  };
}

export async function createQueuedJob(
  {
    kind,
    propertyId = null,
    mediaAssetId = null,
    requestedByUserId = null,
    payload = {},
    maxAttempts = 1,
  },
  { logger = console } = {},
) {
  if (!JOB_KIND_VALUES.includes(kind)) {
    throw new Error(`Unsupported job kind: ${kind}`);
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to create jobs.');
  }

  const job = await JobModel.create({
    kind,
    propertyId,
    mediaAssetId,
    requestedByUserId,
    payload,
    maxAttempts: Math.max(1, Number(maxAttempts || 1)),
    currentStage: 'queued',
    message: 'Job queued.',
  });

  scheduleJob(job._id.toString(), logger);
  return serializeJob(job.toObject());
}

export async function queueVisionEnhancementJob(payload, { logger = console } = {}) {
  return createQueuedJob(
    {
      kind: 'vision_enhancement',
      propertyId: payload.propertyId,
      mediaAssetId: payload.assetId,
      requestedByUserId: payload.userId || null,
      payload,
    },
    { logger },
  );
}

export async function queuePropertyFlyerJob(payload, { logger = console } = {}) {
  return createQueuedJob(
    {
      kind: 'property_flyer',
      propertyId: payload.propertyId,
      requestedByUserId: payload.userId || null,
      payload,
    },
    { logger },
  );
}

export async function queuePropertyReportJob(payload, { logger = console } = {}) {
  return createQueuedJob(
    {
      kind: 'property_report',
      propertyId: payload.propertyId,
      requestedByUserId: payload.userId || null,
      payload,
    },
    { logger },
  );
}

export async function getJobById(jobId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const job = await JobModel.findById(jobId).lean();
  return serializeJob(job);
}

export async function getVisionProxyJobById(jobId) {
  const genericJob = await getJobById(jobId);
  if (genericJob?.kind === 'vision_enhancement') {
    return buildVisionProxyJob(genericJob);
  }

  return getImageJobById(jobId);
}

export async function cancelJob(jobId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to cancel jobs.');
  }

  const job = await JobModel.findById(jobId);
  if (!job) {
    return null;
  }

  if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
    job.status = 'cancelled';
    job.currentStage = 'cancelled';
    job.failureReason = 'cancelled_by_user';
    job.message = 'Job cancelled.';
    job.warning = '';
    job.cancelledAt = new Date();
    job.completedAt = new Date();
    await job.save();
  }

  const imageJobId = job.result?.imageJobId || job.payload?.imageJobId || null;
  if (job.kind === 'vision_enhancement' && imageJobId) {
    await cancelImageJob(imageJobId).catch(() => {});
  }

  return serializeJob(job.toObject());
}

export async function cancelVisionProxyJob(jobId) {
  const genericJob = await getJobById(jobId);
  if (genericJob?.kind === 'vision_enhancement') {
    const cancelled = await cancelJob(jobId);
    return buildVisionProxyJob(cancelled);
  }

  return cancelImageJob(jobId);
}

export async function listJobsForProperty(propertyId, options = {}) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const limit = Math.max(1, Math.min(25, Number(options.limit || 10)));
  const filter = { propertyId };
  if (options.kind) {
    filter.kind = options.kind;
  }

  const jobs = await JobModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return jobs.map((job) => serializeJob(job));
}

export async function listVisionJobsForAsset(assetId, options = {}) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const limit = Math.max(1, Math.min(20, Number(options.limit || 10)));
  const jobs = await JobModel.find({
    kind: 'vision_enhancement',
    mediaAssetId: assetId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (!jobs.length) {
    return listLegacyImageJobsForAsset(assetId, options);
  }

  const proxies = [];
  for (const job of jobs) {
    const proxy = await buildVisionProxyJob(serializeJob(job));
    if (proxy) {
      proxies.push(proxy);
    }
  }
  return proxies;
}

export async function startQueuedJobRecovery({ logger = console } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return () => {};
  }

  await JobModel.updateMany(
    { status: 'running' },
    {
      $set: {
        status: 'reconnecting',
        currentStage: 'reconnecting',
        warning:
          'The server restarted while this job was running. Workside is retrying the queued work where possible.',
        lastHeartbeatAt: new Date(),
      },
    },
  );

  const recoverableJobs = await JobModel.find({
    status: { $in: ['queued', 'reconnecting'] },
  })
    .sort({ createdAt: 1 })
    .lean();

  recoverableJobs.forEach((job) => {
    scheduleJob(toIdString(job._id), logger);
  });

  return () => {};
}

export function buildQueuedAnalysisPayload({
  propertyId,
  userId,
  inputHash,
  usageContext,
  extra = {},
}) {
  return {
    propertyId,
    userId,
    inputHash,
    usageContext: buildUsageContextSnapshot(usageContext),
    ...extra,
  };
}
