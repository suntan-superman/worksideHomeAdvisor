import { deleteStoredAsset } from '../../services/storageService.js';
import { MediaAssetModel } from './media.model.js';
import { MediaVariantModel } from './media-variant.model.js';

function normalizeId(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

export async function deleteStoredAssetIfUnreferenced({
  storageProvider = 'local',
  storageKey,
  excludeAssetId = null,
  excludeVariantId = null,
}) {
  if (!storageKey || storageProvider === 'external') {
    return { deleted: false, skipped: true, reason: 'no_managed_storage' };
  }

  const assetQuery = {
    storageProvider,
    storageKey,
  };
  const variantQuery = {
    storageProvider,
    storageKey,
  };

  const normalizedAssetId = normalizeId(excludeAssetId);
  const normalizedVariantId = normalizeId(excludeVariantId);

  if (normalizedAssetId) {
    assetQuery._id = { $ne: normalizedAssetId };
  }

  if (normalizedVariantId) {
    variantQuery._id = { $ne: normalizedVariantId };
  }

  const [assetRefCount, variantRefCount] = await Promise.all([
    MediaAssetModel.countDocuments(assetQuery),
    MediaVariantModel.countDocuments(variantQuery),
  ]);

  if (assetRefCount || variantRefCount) {
    return {
      deleted: false,
      skipped: true,
      reason: 'shared_reference',
      assetRefCount,
      variantRefCount,
    };
  }

  await deleteStoredAsset({ storageProvider, storageKey });
  return { deleted: true, skipped: false };
}
