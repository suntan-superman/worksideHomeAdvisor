import mongoose from 'mongoose';

import { connectToDatabase } from '../src/lib/db.js';

const INDEX_PLAN = [
  {
    collectionName: 'mediaAssets',
    description: 'Storage-key lookup for safe asset/variant delete checks',
    index: { storageProvider: 1, storageKey: 1 },
    options: { name: 'storage_provider_storage_key' },
  },
  {
    collectionName: 'mediaVariants',
    description: 'Recent variants per source photo',
    index: { mediaId: 1, createdAt: -1 },
    options: { name: 'media_id_created_at_desc' },
  },
  {
    collectionName: 'mediaVariants',
    description: 'Recent variants per vision job',
    index: { visionJobId: 1, createdAt: -1 },
    options: { name: 'vision_job_id_created_at_desc' },
  },
  {
    collectionName: 'mediaVariants',
    description: 'Storage-key lookup for safe variant delete checks',
    index: { storageProvider: 1, storageKey: 1 },
    options: { name: 'storage_provider_storage_key' },
  },
  {
    collectionName: 'imageJobs',
    description: 'Fast selected-variant reassignment after delete',
    index: { selectedVariantId: 1 },
    options: { name: 'selected_variant_id' },
  },
  {
    collectionName: 'imageJobs',
    description: 'Fast outputVariantIds pull/update after delete',
    index: { outputVariantIds: 1 },
    options: { name: 'output_variant_ids' },
  },
];

function printUsage() {
  console.log('');
  console.log('Ensure one-time media-related MongoDB indexes.');
  console.log('');
  console.log('Usage:');
  console.log('  npm run db:ensure-media-indexes');
  console.log('  npm run db:ensure-media-indexes -- --apply');
  console.log('');
  console.log('Options:');
  console.log('  --apply   Actually create the indexes. Without this flag the script only previews the plan.');
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

function normalizeIndexKey(index) {
  return JSON.stringify(
    Object.keys(index)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = index[key];
        return accumulator;
      }, {}),
  );
}

async function findExistingIndex(collection, targetIndex) {
  const existingIndexes = await collection.indexes();
  const targetKey = normalizeIndexKey(targetIndex);

  return (
    existingIndexes.find((entry) => normalizeIndexKey(entry.key || {}) === targetKey) || null
  );
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

  const dbName = mongoose.connection.db?.databaseName || 'unknown';

  console.log('');
  console.log('Media Index Plan');
  console.log('----------------');
  console.log(`Database: ${dbName}`);
  console.log(`Mode: ${options.apply ? 'APPLY' : 'PREVIEW'}`);

  let createdCount = 0;
  let alreadyPresentCount = 0;

  for (const item of INDEX_PLAN) {
    const collection = mongoose.connection.collection(item.collectionName);
    const existing = await findExistingIndex(collection, item.index);

    if (!options.apply) {
      console.log('');
      console.log(`[${item.collectionName}] ${item.description}`);
      console.log(`  Key: ${JSON.stringify(item.index)}`);
      console.log(
        `  Status: ${existing ? `already present as "${existing.name}"` : 'missing and ready to create'}`,
      );
      continue;
    }

    if (existing) {
      alreadyPresentCount += 1;
      console.log(
        `[skip] ${item.collectionName} ${JSON.stringify(item.index)} already exists as "${existing.name}"`,
      );
      continue;
    }

    const createdName = await collection.createIndex(item.index, item.options);
    createdCount += 1;
    console.log(
      `[create] ${item.collectionName} ${JSON.stringify(item.index)} -> "${createdName}"`,
    );
  }

  if (!options.apply) {
    console.log('');
    console.log('Preview only. No indexes were created.');
    console.log('Run again with --apply to create any missing indexes.');
    return;
  }

  console.log('');
  console.log('Index ensure complete.');
  console.log(`Created: ${createdCount}`);
  console.log(`Already present: ${alreadyPresentCount}`);
}

run()
  .catch((error) => {
    console.error('');
    console.error('Failed to ensure media indexes.');
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
