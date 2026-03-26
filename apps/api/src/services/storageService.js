import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from '@google-cloud/storage';

import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStorageDir = path.resolve(__dirname, '../../uploads/media-assets');
let storageClient;

function getStorageDir() {
  return env.STORAGE_LOCAL_DIR
    ? path.resolve(env.STORAGE_LOCAL_DIR)
    : defaultStorageDir;
}

function extensionFromMimeType(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };

  return map[mimeType] || 'bin';
}

function sanitizePathSegment(input) {
  return String(input || 'asset').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getObjectKey({ propertyId, assetId, mimeType }) {
  const extension = extensionFromMimeType(mimeType);
  const prefix = String(env.GCS_UPLOAD_PREFIX || 'media-assets').replace(/^\/+|\/+$/g, '');

  return [
    prefix,
    sanitizePathSegment(propertyId),
    `${assetId}.${extension}`,
  ]
    .filter(Boolean)
    .join('/');
}

function getStorageClient() {
  if (!storageClient) {
    storageClient = env.GCS_PROJECT_ID
      ? new Storage({ projectId: env.GCS_PROJECT_ID })
      : new Storage();
  }

  return storageClient;
}

function getBucket() {
  if (!env.GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME must be configured when STORAGE_PROVIDER=gcs.');
  }

  return getStorageClient().bucket(env.GCS_BUCKET_NAME);
}

async function saveImageBufferToLocal({
  propertyId,
  mimeType,
  imageBase64,
}) {
  const storageDir = getStorageDir();
  const assetId = randomUUID();
  const relativePath = getObjectKey({ propertyId, assetId, mimeType });
  const absolutePath = path.join(storageDir, relativePath);
  const buffer = Buffer.from(imageBase64, 'base64');

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    storageProvider: 'local',
    storageKey: relativePath.replace(/\\/g, '/'),
    absolutePath,
    byteSize: buffer.byteLength,
  };
}

async function saveImageBufferToGcs({
  propertyId,
  mimeType,
  imageBase64,
}) {
  const assetId = randomUUID();
  const objectKey = getObjectKey({ propertyId, assetId, mimeType });
  const buffer = Buffer.from(imageBase64, 'base64');
  const file = getBucket().file(objectKey);

  await file.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return {
    storageProvider: 'gcs',
    storageKey: objectKey,
    byteSize: buffer.byteLength,
  };
}

export async function saveImageBuffer({
  propertyId,
  mimeType,
  imageBase64,
}) {
  if (env.STORAGE_PROVIDER === 'gcs') {
    return saveImageBufferToGcs({
      propertyId,
      mimeType,
      imageBase64,
    });
  }

  return saveImageBufferToLocal({
    propertyId,
    mimeType,
    imageBase64,
  });
}

export function buildMediaAssetUrl(assetId) {
  return `${env.PUBLIC_API_URL}/api/v1/media/assets/${assetId}/file`;
}

async function readStoredAssetFromLocal(storageKey) {
  const absolutePath = path.join(getStorageDir(), storageKey);
  const buffer = await fs.readFile(absolutePath);
  return { buffer, absolutePath };
}

async function readStoredAssetFromGcs(storageKey) {
  const [buffer] = await getBucket().file(storageKey).download();
  return { buffer };
}

export async function readStoredAsset({ storageProvider = 'local', storageKey }) {
  if (!storageKey) {
    throw new Error('A storage key is required to read a media asset.');
  }

  if (storageProvider === 'gcs') {
    return readStoredAssetFromGcs(storageKey);
  }

  return readStoredAssetFromLocal(storageKey);
}
