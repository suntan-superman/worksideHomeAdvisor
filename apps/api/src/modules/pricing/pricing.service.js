import mongoose from 'mongoose';

import { demoDashboard } from '../../data/demoData.js';
import { generatePricingInsights } from '../../services/aiWorkflowService.js';
import { buildCompCacheKey } from '../../services/pricingEngine.js';
import { getComparableSalesForProperty } from '../../services/compsProvider.js';
import { PropertyModel } from '../properties/property.model.js';
import { serializeProperty } from '../properties/property.service.js';
import { PricingAnalysisModel } from './pricing.model.js';

function buildDemoStoredAnalysis() {
  return {
    id: 'demo-pricing-analysis-001',
    propertyId: demoDashboard.property.id,
    source: 'demo',
    usedLiveData: false,
    cacheKey: buildCompCacheKey(demoDashboard.property),
    subjectSnapshot: demoDashboard.property,
    selectedComps: demoDashboard.comps,
    medianPricePerSqft: 263,
    recommendedListLow: demoDashboard.pricing.low,
    recommendedListMid: demoDashboard.pricing.mid,
    recommendedListHigh: demoDashboard.pricing.high,
    variance: 0.038,
    confidenceScore: demoDashboard.pricing.confidence,
    strengths: [
      'Strong nearby demo comp set for the walkthrough experience.',
      'Comparable bedroom and bathroom counts align well with the subject property.',
    ],
    risks: ['Demo-only pricing analysis. Replace with live RentCast results for production use.'],
    summary: 'This is a demo pricing snapshot used when the API is not connected to MongoDB.',
    pricingStrategy: 'Use the midpoint for preview purposes and replace it with a live RentCast-backed analysis.',
    warning: 'Demo pricing analysis only.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function serializePricingAnalysis(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    source: document.source,
    usedLiveData: document.usedLiveData,
    cacheKey: document.cacheKey,
    avm: document.avm,
    subjectSnapshot: document.subjectSnapshot,
    selectedComps: document.selectedComps || [],
    medianPricePerSqft: document.medianPricePerSqft,
    recommendedListLow: document.recommendedListLow,
    recommendedListMid: document.recommendedListMid,
    recommendedListHigh: document.recommendedListHigh,
    variance: document.variance,
    confidenceScore: document.confidenceScore,
    strengths: document.strengths || [],
    risks: document.risks || [],
    summary: document.summary,
    pricingStrategy: document.pricingStrategy,
    warning: document.warning || null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function analyzePropertyPricing(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return buildDemoStoredAnalysis();
  }

  const propertyDocument = await PropertyModel.findById(propertyId);
  if (!propertyDocument) {
    throw new Error('Property not found.');
  }

  const property = serializeProperty(propertyDocument.toObject());
  const pricingAnalysis = await getComparableSalesForProperty(property);
  const narrative = await generatePricingInsights({
    property,
    pricingAnalysis,
    sellerGoals: property.sellerProfile?.goals || ['maximize-profit'],
  });

  const record = await PricingAnalysisModel.create({
    propertyId: propertyDocument._id,
    source: pricingAnalysis.source,
    usedLiveData: pricingAnalysis.usedLiveData,
    cacheKey: buildCompCacheKey(property),
    avm: pricingAnalysis.avm,
    subjectSnapshot: property,
    selectedComps: pricingAnalysis.selectedComps.map((comp) => ({
      externalId: comp._id,
      address: comp.address,
      price: comp.price,
      sqft: comp.sqft,
      beds: comp.beds,
      baths: comp.baths,
      pricePerSqft: comp.pricePerSqft,
      distanceMiles: comp.distanceMiles,
      saleDate: comp.saleDate,
      daysOnMarket: comp.daysOnMarket,
      propertyType: comp.propertyType,
      listingType: comp.listingType,
      latitude: comp.latitude,
      longitude: comp.longitude,
      score: comp.score,
      raw: comp.raw,
    })),
    medianPricePerSqft: pricingAnalysis.pricing.medianPricePerSqft,
    recommendedListLow: pricingAnalysis.pricing.range.low,
    recommendedListMid: pricingAnalysis.pricing.range.mid,
    recommendedListHigh: pricingAnalysis.pricing.range.high,
    variance: pricingAnalysis.pricing.variance,
    confidenceScore: pricingAnalysis.pricing.confidence,
    strengths: narrative.strengths,
    risks: narrative.risks,
    summary: narrative.summary,
    pricingStrategy: narrative.pricingStrategy,
    warning: narrative.warning || pricingAnalysis.warning,
    rawAnalysis: pricingAnalysis,
  });

  return serializePricingAnalysis(record.toObject());
}

export async function getLatestPricingAnalysis(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return buildDemoStoredAnalysis();
  }

  const record = await PricingAnalysisModel.findOne({ propertyId })
    .sort({ createdAt: -1 })
    .lean();

  return serializePricingAnalysis(record);
}
