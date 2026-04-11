import mongoose from 'mongoose';

import { connectToDatabase } from '../src/lib/db.js';
import { PricingAnalysisModel } from '../src/modules/pricing/pricing.model.js';

function printUsage() {
  console.log('');
  console.log('Collapse duplicate pricing analyses so each property keeps only the latest record.');
  console.log('');
  console.log('Usage:');
  console.log('  npm run cleanup:pricing-analyses');
  console.log('  npm run cleanup:pricing-analyses -- --apply');
  console.log('');
  console.log('Options:');
  console.log('  --apply   Actually delete older pricing analyses. Without this flag the script previews only.');
  console.log('  --help    Show this help message.');
  console.log('');
}

function parseArgs(argv) {
  const options = {
    apply: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function toIdString(value) {
  return value?._id?.toString?.() || value?.toString?.() || '';
}

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString();
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const connected = await connectToDatabase();
  if (!connected) {
    throw new Error('Could not connect to MongoDB.');
  }

  const analyses = await PricingAnalysisModel.find({})
    .sort({ propertyId: 1, createdAt: -1, _id: -1 })
    .lean();

  const keepIds = new Set();
  const duplicateIds = [];
  const summaryByProperty = [];
  const seenPropertyIds = new Set();

  for (const analysis of analyses) {
    const propertyId = toIdString(analysis.propertyId);
    if (!propertyId) {
      continue;
    }

    if (!seenPropertyIds.has(propertyId)) {
      seenPropertyIds.add(propertyId);
      keepIds.add(toIdString(analysis._id));
      summaryByProperty.push({
        propertyId,
        keepId: toIdString(analysis._id),
        keepCreatedAt: analysis.createdAt,
        duplicateCount: 0,
      });
      continue;
    }

    duplicateIds.push(analysis._id);
    const propertySummary = summaryByProperty.find((entry) => entry.propertyId === propertyId);
    if (propertySummary) {
      propertySummary.duplicateCount += 1;
    }
  }

  const affectedProperties = summaryByProperty.filter((entry) => entry.duplicateCount > 0);

  console.log('');
  console.log('Pricing Analysis Cleanup');
  console.log('------------------------');
  console.log(`Mode: ${options.apply ? 'APPLY' : 'PREVIEW'}`);
  console.log(`Total pricing analyses: ${analyses.length}`);
  console.log(`Properties with at least one analysis: ${summaryByProperty.length}`);
  console.log(`Properties with duplicates: ${affectedProperties.length}`);
  console.log(`Older analyses to delete: ${duplicateIds.length}`);

  if (affectedProperties.length) {
    console.log('');
    console.log('Sample properties with duplicates:');
    for (const entry of affectedProperties.slice(0, 10)) {
      console.log(
        `- Property ${entry.propertyId} | keep ${entry.keepId} from ${formatDateTime(entry.keepCreatedAt)} | delete ${entry.duplicateCount} older analys${entry.duplicateCount === 1 ? 'is' : 'es'}`,
      );
    }
  }

  if (!duplicateIds.length) {
    console.log('');
    console.log('No duplicate pricing analyses were found.');
    return;
  }

  if (!options.apply) {
    console.log('');
    console.log('Preview only. No pricing analyses were deleted.');
    console.log('Run again with --apply to remove the older duplicates.');
    return;
  }

  const deleteResult = await PricingAnalysisModel.deleteMany({
    _id: { $in: duplicateIds },
  });

  console.log('');
  console.log('Cleanup complete.');
  console.log(`Deleted older pricing analyses: ${deleteResult.deletedCount || 0}`);
}

run()
  .catch((error) => {
    console.error('');
    console.error('Failed to clean up pricing analyses.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
