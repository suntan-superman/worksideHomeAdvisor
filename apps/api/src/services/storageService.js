import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStorageDir = path.resolve(__dirname, '../../uploads/media-assets');

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

export async function saveImageBuffer({
  propertyId,
  mimeType,
  imageBase64,
}) {
  const storageDir = getStorageDir();
  const assetId = randomUUID();
  const extension = extensionFromMimeType(mimeType);
  const relativePath = path.join(
    sanitizePathSegment(propertyId),
    `${assetId}.${extension}`,
  );
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

export function buildMediaAssetUrl(assetId) {
  return `${env.PUBLIC_API_URL}/api/v1/media/assets/${assetId}/file`;
}

export async function readStoredAsset(storageKey) {
  const absolutePath = path.join(getStorageDir(), storageKey);
  const buffer = await fs.readFile(absolutePath);
  return {
    buffer,
    absolutePath,
  };
}
