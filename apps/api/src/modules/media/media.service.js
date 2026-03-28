import mongoose from 'mongoose';

import { analyzePropertyPhoto } from '../../services/photoAnalysisService.js';
import { buildMediaAssetUrl, saveImageBuffer } from '../../services/storageService.js';
import { getPropertyById } from '../properties/property.service.js';
import { MediaAssetModel } from './media.model.js';

function serializeMediaAsset(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    roomLabel: document.roomLabel,
    mimeType: document.mimeType,
    width: document.width,
    height: document.height,
    storageProvider: document.storageProvider || 'local',
    storageKey: document.storageKey || null,
    byteSize: document.byteSize || null,
    imageUrl:
      document.imageUrl ||
      (document._id ? buildMediaAssetUrl(document._id.toString()) : null),
    imageDataUrl: document.imageDataUrl || null,
    listingCandidate: Boolean(document.listingCandidate),
    listingNote: document.listingNote || '',
    analysis: document.analysis || null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function listMediaAssets(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const assets = await MediaAssetModel.find({ propertyId }).sort({ createdAt: -1 }).lean();
  return assets.map(serializeMediaAsset);
}

export async function createMediaAssetAndAnalysis({
  propertyId,
  roomLabel,
  mimeType,
  imageBase64,
  width,
  height,
}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to save media assets.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const analysis = await analyzePropertyPhoto({
    property,
    roomLabel,
    mimeType,
    imageBase64,
    width,
    height,
  });

  const storedImage = await saveImageBuffer({
    propertyId,
    mimeType,
    imageBase64,
  });

  const asset = await MediaAssetModel.create({
    propertyId,
    roomLabel,
    mimeType,
    width,
    height,
    storageProvider: storedImage.storageProvider,
    storageKey: storedImage.storageKey,
    byteSize: storedImage.byteSize,
    analysis,
  });

  asset.imageUrl = buildMediaAssetUrl(asset._id.toString());
  await asset.save();

  return {
    asset: serializeMediaAsset(asset.toObject()),
    analysis,
  };
}

export async function updateMediaAsset(assetId, updates) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update media assets.');
  }

  const asset = await MediaAssetModel.findById(assetId);
  if (!asset) {
    throw new Error('Media asset not found.');
  }

  if (typeof updates.roomLabel === 'string') {
    asset.roomLabel = updates.roomLabel.trim() || asset.roomLabel;
  }

  if (typeof updates.listingCandidate === 'boolean') {
    asset.listingCandidate = updates.listingCandidate;
  }

  if (typeof updates.listingNote === 'string') {
    asset.listingNote = updates.listingNote.trim().slice(0, 280);
  }

  await asset.save();
  return serializeMediaAsset(asset.toObject());
}

export async function getMediaAssetById(assetId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const asset = await MediaAssetModel.findById(assetId).lean();
  return serializeMediaAsset(asset);
}
