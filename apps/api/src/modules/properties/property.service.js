import mongoose from 'mongoose';

import { demoDashboard } from '../../data/demoData.js';
import { PropertyModel } from './property.model.js';

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
  return properties.map(serializeProperty);
}

export async function createProperty(ownerUserId, payload) {
  const property = await PropertyModel.create({
    ownerUserId,
    ...payload,
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
