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
    'application/pdf': 'pdf',
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
  imageBuffer,
}) {
  const storageDir = getStorageDir();
  const assetId = randomUUID();
  const relativePath = getObjectKey({ propertyId, assetId, mimeType });
  const absolutePath = path.join(storageDir, relativePath);
  const buffer = imageBuffer;

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    storageProvider: 'local',
    storageKey: relativePath.replace(/\\/g, '/'),
    absolutePath,
    byteSize: buffer.byteLength,
  };
}

function getProviderDocumentKey({ providerId, documentType, mimeType }) {
  const extension = extensionFromMimeType(mimeType);

  return [
    'provider-documents',
    sanitizePathSegment(providerId),
    `${sanitizePathSegment(documentType)}-${randomUUID()}.${extension}`,
  ]
    .filter(Boolean)
    .join('/');
}

async function saveProviderDocumentBufferToLocal({
  providerId,
  documentType,
  mimeType,
  buffer,
}) {
  const storageDir = getStorageDir();
  const relativePath = getProviderDocumentKey({ providerId, documentType, mimeType });
  const absolutePath = path.join(storageDir, relativePath);

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
  imageBuffer,
}) {
  const assetId = randomUUID();
  const objectKey = getObjectKey({ propertyId, assetId, mimeType });
  const buffer = imageBuffer;
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

async function saveProviderDocumentBufferToGcs({
  providerId,
  documentType,
  mimeType,
  buffer,
}) {
  const objectKey = getProviderDocumentKey({ providerId, documentType, mimeType });
  const file = getBucket().file(objectKey);

  await file.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      cacheControl: 'private, max-age=0, no-store',
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
  const imageBuffer = Buffer.from(imageBase64, 'base64');

  if (env.STORAGE_PROVIDER === 'gcs') {
    return saveImageBufferToGcs({
      propertyId,
      mimeType,
      imageBuffer,
    });
  }

  return saveImageBufferToLocal({
    propertyId,
    mimeType,
    imageBuffer,
  });
}

export async function saveBinaryBuffer({
  propertyId,
  mimeType,
  buffer,
}) {
  if (env.STORAGE_PROVIDER === 'gcs') {
    return saveImageBufferToGcs({
      propertyId,
      mimeType,
      imageBuffer: buffer,
    });
  }

  return saveImageBufferToLocal({
    propertyId,
    mimeType,
    imageBuffer: buffer,
  });
}

export async function saveProviderDocumentBuffer({
  providerId,
  documentType,
  mimeType,
  buffer,
}) {
  if (env.STORAGE_PROVIDER === 'gcs') {
    return saveProviderDocumentBufferToGcs({
      providerId,
      documentType,
      mimeType,
      buffer,
    });
  }

  return saveProviderDocumentBufferToLocal({
    providerId,
    documentType,
    mimeType,
    buffer,
  });
}

export function buildMediaAssetUrl(assetId) {
  return `${env.PUBLIC_API_URL}/api/v1/media/assets/${assetId}/file`;
}

export function buildMediaVariantUrl(variantId) {
  return `${env.PUBLIC_API_URL}/api/v1/media/variants/${variantId}/file`;
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

async function deleteStoredAssetFromLocal(storageKey) {
  const absolutePath = path.join(getStorageDir(), storageKey);
  await fs.rm(absolutePath, { force: true });
}

async function deleteStoredAssetFromGcs(storageKey) {
  await getBucket().file(storageKey).delete({ ignoreNotFound: true });
}

export async function deleteStoredAsset({ storageProvider = 'local', storageKey }) {
  if (!storageKey) {
    return;
  }

  if (storageProvider === 'gcs') {
    await deleteStoredAssetFromGcs(storageKey);
    return;
  }

  await deleteStoredAssetFromLocal(storageKey);
}
