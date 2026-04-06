import mongoose from 'mongoose';

import { env } from '../../config/env.js';
import { ImageJobModel } from './image-job.model.js';
import { MediaVariantModel } from './media-variant.model.js';
import { deleteStoredAssetIfUnreferenced } from './storage-reference.service.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function getTemporaryVariantTtlMs() {
  return Math.max(1, Number(env.MEDIA_VARIANT_TTL_HOURS || 72)) * ONE_HOUR_MS;
}

export function buildVariantLifecycleFields({ isSelected = false, baseDate = new Date() } = {}) {
  const referenceDate = baseDate instanceof Date ? baseDate : new Date(baseDate);

  if (isSelected) {
    return {
      lifecycleState: 'selected',
      expiresAt: null,
      selectedAt: referenceDate,
    };
  }

  return {
    lifecycleState: 'temporary',
    expiresAt: new Date(referenceDate.getTime() + getTemporaryVariantTtlMs()),
    selectedAt: null,
  };
}

export function buildActiveVariantQuery(now = new Date()) {
  const referenceDate = now instanceof Date ? now : new Date(now);
  const legacyCutoff = new Date(referenceDate.getTime() - getTemporaryVariantTtlMs());

  return {
    $or: [
      { isSelected: true },
      { expiresAt: { $gt: referenceDate } },
      {
        isSelected: false,
        expiresAt: null,
        createdAt: { $gt: legacyCutoff },
      },
    ],
  };
}

export function buildExpiredVariantQuery(now = new Date()) {
  const referenceDate = now instanceof Date ? now : new Date(now);
  const legacyCutoff = new Date(referenceDate.getTime() - getTemporaryVariantTtlMs());

  return {
    isSelected: false,
    $or: [
      { expiresAt: { $ne: null, $lte: referenceDate } },
      {
        expiresAt: null,
        createdAt: { $lte: legacyCutoff },
      },
    ],
  };
}

export async function cleanupExpiredMediaVariants({
  limit = Number(env.MEDIA_VARIANT_CLEANUP_BATCH_SIZE || 50),
  logger = console,
  now = new Date(),
} = {}) {
  if (mongoose.connection.readyState !== 1) {
    return {
      ok: false,
      reason: 'database_unavailable',
      scanned: 0,
      deleted: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const expiredVariants = await MediaVariantModel.find(buildExpiredVariantQuery(now))
    .sort({ expiresAt: 1, createdAt: 1 })
    .limit(Math.max(1, limit))
    .lean();

  if (!expiredVariants.length) {
    return {
      ok: true,
      scanned: 0,
      deleted: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const deletedVariantIds = [];
  let failed = 0;

  for (const variant of expiredVariants) {
    try {
      await deleteStoredAssetIfUnreferenced({
        storageProvider: variant.storageProvider,
        storageKey: variant.storageKey,
        excludeVariantId: variant._id,
      });
      deletedVariantIds.push(variant._id);
    } catch (error) {
      failed += 1;
      logger?.error?.(
        {
          err: error,
          variantId: variant._id?.toString?.() || String(variant._id),
          storageKey: variant.storageKey,
        },
        'media variant cleanup failed',
      );
    }
  }

  if (deletedVariantIds.length) {
    await MediaVariantModel.deleteMany({ _id: { $in: deletedVariantIds } });
    await ImageJobModel.updateMany(
      { outputVariantIds: { $in: deletedVariantIds } },
      { $pull: { outputVariantIds: { $in: deletedVariantIds } } },
    );
    await ImageJobModel.updateMany(
      { selectedVariantId: { $in: deletedVariantIds } },
      { $set: { selectedVariantId: null } },
    );
  }

  return {
    ok: failed === 0,
    scanned: expiredVariants.length,
    deleted: deletedVariantIds.length,
    failed,
    timestamp: new Date().toISOString(),
  };
}

export function startMediaVariantCleanupScheduler({ logger = console } = {}) {
  const intervalMinutes = Number(env.MEDIA_VARIANT_CLEANUP_INTERVAL_MINUTES || 60);
  if (intervalMinutes <= 0) {
    logger?.info?.('media variant cleanup scheduler disabled');
    return () => {};
  }

  let running = false;

  const runCleanup = async (reason) => {
    if (running) {
      return;
    }

    running = true;
    try {
      const summary = await cleanupExpiredMediaVariants({ logger });
      if (summary.deleted || summary.failed) {
        logger?.info?.({ ...summary, reason }, 'media variant cleanup run completed');
      }
    } catch (error) {
      logger?.error?.({ err: error, reason }, 'media variant cleanup run crashed');
    } finally {
      running = false;
    }
  };

  void runCleanup('startup');
  const interval = setInterval(() => {
    void runCleanup('interval');
  }, intervalMinutes * 60 * 1000);
  interval.unref?.();

  return () => clearInterval(interval);
}
