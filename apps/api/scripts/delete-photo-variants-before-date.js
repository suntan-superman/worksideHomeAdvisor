import mongoose from 'mongoose';

import { connectToDatabase } from '../src/lib/db.js';
import { ImageJobModel } from '../src/modules/media/image-job.model.js';
import { MediaAssetModel } from '../src/modules/media/media.model.js';
import { MediaVariantModel } from '../src/modules/media/media-variant.model.js';
import { deleteStoredAssetIfUnreferenced } from '../src/modules/media/storage-reference.service.js';

const DEFAULT_BEFORE_DATE = '2026-04-09';

function printUsage() {
  console.log('');
  console.log('Delete photo variants created before a cutoff date.');
  console.log('');
  console.log('Usage:');
  console.log('  npm run cleanup:variants-before-date -- --before=2026-04-09');
  console.log('  npm run cleanup:variants-before-date -- --before=2026-04-09 --confirm');
  console.log('');
  console.log('Options:');
  console.log(`  --before=DATE   Delete variants created before local midnight of DATE. Default: ${DEFAULT_BEFORE_DATE}`);
  console.log('  --confirm       Actually delete the matched variants. Without this flag the script is dry-run only.');
  console.log('  --help          Show this help message.');
  console.log('');
}

function parseArgs(argv) {
  const options = {
    before: DEFAULT_BEFORE_DATE,
    confirm: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--confirm') {
      options.confirm = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg.startsWith('--before=')) {
      options.before = arg.slice('--before='.length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseLocalCutoffDate(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('A cutoff date is required.');
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  throw new Error(`Unsupported date format: ${value}. Use YYYY-MM-DD or M/D/YYYY.`);
}

function toIdString(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function formatLocalDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid-date' : date.toLocaleString();
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => toIdString(value)).filter(Boolean))];
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const cutoffDate = parseLocalCutoffDate(options.before);
  const connected = await connectToDatabase();
  if (!connected) {
    throw new Error('Could not connect to MongoDB.');
  }

  const variants = await MediaVariantModel.find({
    createdAt: { $lt: cutoffDate },
  })
    .sort({ createdAt: 1 })
    .lean();

  const variantIds = variants.map((variant) => variant._id);
  const variantIdStrings = uniqueStrings(variantIds);
  const visionJobIds = uniqueStrings(variants.map((variant) => variant.visionJobId));
  const mediaIds = uniqueStrings(variants.map((variant) => variant.mediaId));
  const selectedCount = variants.filter((variant) => variant.isSelected).length;
  const temporaryCount = variants.filter((variant) => variant.lifecycleState === 'temporary').length;
  const selectedLifecycleCount = variants.filter(
    (variant) => variant.lifecycleState === 'selected',
  ).length;

  let generatedAssetsUsingVariant = 0;
  let assetsWithSourceVariant = 0;
  if (variantIds.length) {
    generatedAssetsUsingVariant = await MediaAssetModel.countDocuments({
      assetType: 'generated',
      sourceVariantId: { $in: variantIds },
    });
    assetsWithSourceVariant = await MediaAssetModel.countDocuments({
      sourceVariantId: { $in: variantIds },
    });
  }

  console.log('');
  console.log('Photo Variant Cleanup');
  console.log('---------------------');
  console.log(`Mode: ${options.confirm ? 'DELETE' : 'DRY RUN'}`);
  console.log(`Delete variants created before: ${formatLocalDate(cutoffDate)}`);
  console.log(`Matched variants: ${variants.length}`);
  console.log(`Affected source photos: ${mediaIds.length}`);
  console.log(`Affected vision jobs: ${visionJobIds.length}`);
  console.log(`Selected variants in match: ${selectedCount}`);
  console.log(`Temporary lifecycle variants: ${temporaryCount}`);
  console.log(`Selected lifecycle variants: ${selectedLifecycleCount}`);
  console.log(`Generated photo assets sourced from matched variants: ${generatedAssetsUsingVariant}`);
  console.log(`All assets with sourceVariantId pointing at matched variants: ${assetsWithSourceVariant}`);

  if (variants.length) {
    console.log(`Oldest match: ${formatLocalDate(variants[0].createdAt)}`);
    console.log(`Newest match: ${formatLocalDate(variants[variants.length - 1].createdAt)}`);
    console.log('');
    console.log('Sample matches:');
    for (const variant of variants.slice(0, 10)) {
      console.log(
        `- ${variant.label || variant.variantType || 'variant'} | ${formatLocalDate(variant.createdAt)} | media ${toIdString(variant.mediaId)}`,
      );
    }
  }

  if (!variants.length) {
    console.log('');
    console.log('No variants matched this cutoff.');
    return;
  }

  if (!options.confirm) {
    console.log('');
    console.log('Dry run only. Nothing was deleted.');
    console.log(
      `Run again with --confirm to permanently delete ${variants.length} matched variant(s).`,
    );
    return;
  }

  const deletedVariantIds = [];
  let storageDeletedCount = 0;
  let storageSkippedCount = 0;
  let storageFailureCount = 0;

  for (const variant of variants) {
    try {
      const storageResult = await deleteStoredAssetIfUnreferenced({
        storageProvider: variant.storageProvider,
        storageKey: variant.storageKey,
        excludeVariantId: variant._id,
      });

      if (storageResult?.deleted) {
        storageDeletedCount += 1;
      } else {
        storageSkippedCount += 1;
      }

      deletedVariantIds.push(variant._id);
    } catch (error) {
      storageFailureCount += 1;
      console.error(
        `Storage cleanup failed for variant ${toIdString(variant._id)} (${variant.label || variant.variantType || 'variant'}): ${error.message}`,
      );
    }
  }

  if (!deletedVariantIds.length) {
    console.log('');
    console.log('No variants were deleted because every matched item failed storage cleanup.');
    return;
  }

  const deletedVariantIdStrings = uniqueStrings(deletedVariantIds);
  const deletedVariantStringSet = new Set(deletedVariantIdStrings);

  await MediaVariantModel.deleteMany({ _id: { $in: deletedVariantIds } });

  const assetSourceUpdate = await MediaAssetModel.updateMany(
    { sourceVariantId: { $in: deletedVariantIds } },
    { $set: { sourceVariantId: null } },
  );

  await ImageJobModel.updateMany(
    { outputVariantIds: { $in: deletedVariantIds } },
    { $pull: { outputVariantIds: { $in: deletedVariantIds } } },
  );

  const affectedVisionJobIds = uniqueStrings(
    variants
      .filter((variant) => deletedVariantStringSet.has(toIdString(variant._id)))
      .map((variant) => variant.visionJobId),
  );

  let deletedJobsCount = 0;
  let reassignedJobsCount = 0;

  for (const visionJobId of affectedVisionJobIds) {
    const replacementVariant = await MediaVariantModel.findOne({ visionJobId })
      .sort({ createdAt: -1 })
      .lean();

    if (!replacementVariant) {
      const deleteResult = await ImageJobModel.deleteOne({ _id: visionJobId });
      deletedJobsCount += deleteResult.deletedCount || 0;
      continue;
    }

    const updateResult = await ImageJobModel.updateOne(
      { _id: visionJobId, selectedVariantId: { $in: deletedVariantIds } },
      { $set: { selectedVariantId: replacementVariant._id } },
    );

    if (updateResult.modifiedCount) {
      reassignedJobsCount += 1;
    }
  }

  console.log('');
  console.log('Delete complete.');
  console.log(`Deleted variants: ${deletedVariantIds.length}`);
  console.log(`Storage files deleted: ${storageDeletedCount}`);
  console.log(`Storage files retained due to shared refs: ${storageSkippedCount}`);
  console.log(`Storage cleanup failures: ${storageFailureCount}`);
  console.log(`Assets with cleared sourceVariantId: ${assetSourceUpdate.modifiedCount || 0}`);
  console.log(`Vision jobs deleted because no variants remained: ${deletedJobsCount}`);
  console.log(`Vision jobs reassigned to a remaining selected variant: ${reassignedJobsCount}`);
}

run()
  .catch((error) => {
    console.error('');
    console.error('Failed to delete photo variants before cutoff date.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
