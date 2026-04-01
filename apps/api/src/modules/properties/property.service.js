import mongoose from 'mongoose';

import { demoDashboard } from '../../data/demoData.js';
import { getPropertyCapacitySummary } from '../billing/billing.service.js';
import { PropertyModel } from './property.model.js';

export const PROPERTY_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
};

const ARCHIVED_PROPERTY_MESSAGE =
  'This property is archived and read-only. Restore it before making changes.';

export function isPropertyArchived(property) {
  return property?.status === PROPERTY_STATUS.ARCHIVED;
}

export function serializeProperty(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    ownerUserId: document.ownerUserId?.toString?.() || String(document.ownerUserId),
    title: document.title,
    addressLine1: document.addressLine1,
    city: document.city,
    state: document.state,
    zip: document.zip,
    propertyType: document.propertyType,
    bedrooms: document.bedrooms,
    bathrooms: document.bathrooms,
    squareFeet: document.squareFeet,
    lotSizeSqFt: document.lotSizeSqFt,
    yearBuilt: document.yearBuilt,
    selectedListPrice: document.selectedListPrice ?? null,
    selectedListPriceSource: document.selectedListPriceSource || '',
    selectedListPriceUpdatedAt: document.selectedListPriceUpdatedAt || null,
    status: document.status || PROPERTY_STATUS.ACTIVE,
    isArchived: Boolean(isPropertyArchived(document)),
    archivedAt: document.archivedAt || null,
    archivedReason: document.archivedReason || '',
    readinessScore: document.readinessScore,
    sellerProfile: document.sellerProfile || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function listProperties(ownerUserId) {
  if (mongoose.connection.readyState !== 1) {
    return [demoDashboard.property];
  }

  const query = ownerUserId ? { ownerUserId } : {};
  const properties = await PropertyModel.find(query).sort({ createdAt: -1 }).lean();
  return properties
    .map(serializeProperty)
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === PROPERTY_STATUS.ACTIVE ? -1 : 1;
      }
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
}

export async function assertCanCreateActiveProperty(ownerUserId) {
  const propertyCapacity = await getPropertyCapacitySummary(ownerUserId);
  if (!propertyCapacity.canCreateActiveProperty) {
    const limitText =
      propertyCapacity.activeLimit === null ? 'your plan limit' : `${propertyCapacity.activeLimit} active propert${propertyCapacity.activeLimit === 1 ? 'y' : 'ies'}`;
    throw new Error(
      `You have reached ${limitText}. Archive an existing property or upgrade the plan before creating another active property.`,
    );
  }

  return propertyCapacity;
}

export async function createProperty(ownerUserId, payload) {
  await assertCanCreateActiveProperty(ownerUserId);

  const property = await PropertyModel.create({
    ownerUserId,
    ...payload,
    status: PROPERTY_STATUS.ACTIVE,
    readinessScore: 32,
  });

  return serializeProperty(property.toObject());
}

export async function getPropertyById(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return demoDashboard.property;
  }

  const property = await PropertyModel.findById(propertyId).lean();
  return serializeProperty(property);
}

export async function assertPropertyEditableById(propertyId) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  if (isPropertyArchived(property)) {
    throw new Error(ARCHIVED_PROPERTY_MESSAGE);
  }

  return property;
}

export async function archiveProperty(propertyId, actorUserId = '') {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to archive properties.');
  }

  const property = await PropertyModel.findById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  if (actorUserId && String(property.ownerUserId) !== String(actorUserId)) {
    throw new Error('You do not have permission to archive this property.');
  }

  property.status = PROPERTY_STATUS.ARCHIVED;
  property.archivedAt = new Date();
  property.archivedReason = 'Archived by user';
  await property.save();

  return serializeProperty(property.toObject());
}

export async function restoreProperty(propertyId, actorUserId = '') {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to restore properties.');
  }

  const property = await PropertyModel.findById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  if (actorUserId && String(property.ownerUserId) !== String(actorUserId)) {
    throw new Error('You do not have permission to restore this property.');
  }

  await assertCanCreateActiveProperty(String(property.ownerUserId));

  property.status = PROPERTY_STATUS.ACTIVE;
  property.archivedAt = null;
  property.archivedReason = '';
  await property.save();

  return serializeProperty(property.toObject());
}

export async function setPropertyReadinessScore(propertyId, readinessScore) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const property = await PropertyModel.findByIdAndUpdate(
    propertyId,
    {
      $set: {
        readinessScore: Math.max(0, Math.min(100, Math.round(Number(readinessScore || 0)))),
      },
    },
    { new: true },
  ).lean();

  return serializeProperty(property);
}

export async function updatePropertyPricingDecision(
  propertyId,
  { selectedListPrice = null, selectedListPriceSource = '' },
  actorUserId = '',
) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update property pricing decisions.');
  }

  const property = await PropertyModel.findById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  if (actorUserId && String(property.ownerUserId) !== String(actorUserId)) {
    throw new Error('You do not have permission to update this property.');
  }

  if (isPropertyArchived(property)) {
    throw new Error(ARCHIVED_PROPERTY_MESSAGE);
  }

  property.selectedListPrice =
    selectedListPrice === null || selectedListPrice === undefined
      ? null
      : Math.round(Number(selectedListPrice));
  property.selectedListPriceSource = selectedListPrice ? String(selectedListPriceSource || 'custom') : '';
  property.selectedListPriceUpdatedAt = selectedListPrice ? new Date() : null;
  await property.save();

  return serializeProperty(property.toObject());
}
