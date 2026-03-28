import mongoose from 'mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatCurrency } from '@workside/utils';

import { demoDashboard } from '../../data/demoData.js';
import { listMediaAssets } from '../media/media.service.js';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { getLatestPropertyFlyer } from './flyer.service.js';
import { ReportModel } from './report.model.js';

function serializeReport(document) {
  if (!document) {
    return null;
  }

  if (document.id && !document._id) {
    return document;
  }

  return {
    id: document._id?.toString(),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    reportType: document.reportType,
    title: document.title,
    executiveSummary: document.executiveSummary,
    pricingSummary: document.pricingSummary || {},
    selectedComps: document.selectedComps || [],
    selectedPhotos: document.selectedPhotos || [],
    checklistItems: document.checklistItems || [],
    improvementItems: document.improvementItems || [],
    marketingHighlights: document.marketingHighlights || [],
    disclaimer: document.disclaimer,
    source: document.source || 'system',
    payload: document.payload || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function sortPhotosForReport(assets) {
  return [...(assets || [])].sort((left, right) => {
    if (Boolean(left.listingCandidate) !== Boolean(right.listingCandidate)) {
      return left.listingCandidate ? -1 : 1;
    }

    return (
      Number(right.analysis?.overallQualityScore || 0) -
      Number(left.analysis?.overallQualityScore || 0)
    );
  });
}

function selectReportPhotos(assets) {
  return sortPhotosForReport(assets)
    .slice(0, 4)
    .map((asset) => ({
      assetId: asset.id,
      roomLabel: asset.roomLabel,
      imageUrl: asset.imageUrl || null,
      listingCandidate: Boolean(asset.listingCandidate),
      listingNote: asset.listingNote || '',
    }));
}

function buildExecutiveSummary({ property, pricing, selectedPhotos, checklistItems, improvementItems }) {
  const priceSummary =
    pricing?.recommendedListMid
      ? `Current pricing centers around ${formatCurrency(pricing.recommendedListMid)} with ${Math.round(
          (pricing.confidenceScore || 0) * 100,
        )}% confidence.`
      : 'Pricing still needs a fresh analysis before the launch plan is fully ready.';

  const photoSummary = selectedPhotos.length
    ? `${selectedPhotos.filter((photo) => photo.listingCandidate).length || selectedPhotos.length} strong listing photo candidates are available for materials.`
    : 'Photo coverage is still thin and needs more listing-ready images.';

  return [
    `${property.title} is now moving into a more presentation-ready state.`,
    priceSummary,
    photoSummary,
    `${checklistItems.length} checklist items and ${improvementItems.length} improvement priorities are included in this report.`,
  ].join(' ');
}

function buildReportPayload({ property, pricing, mediaAssets, flyer }) {
  const selectedPhotos = selectReportPhotos(mediaAssets);
  const checklistItems = (demoDashboard.tasks || []).map((item) => item.title || String(item));
  const improvementItems = (demoDashboard.improvements || []).map(
    (item) => item.title || String(item),
  );
  const marketingHighlights =
    flyer?.highlights?.length
      ? flyer.highlights
      : demoDashboard.marketing?.heroHighlights || [];

  const selectedComps = (pricing?.selectedComps || []).slice(0, 5).map((comp) => ({
    address: comp.address,
    price: comp.price,
    beds: comp.beds,
    baths: comp.baths,
    sqft: comp.sqft,
    distanceMiles: comp.distanceMiles,
    score: comp.score,
  }));

  const pricingSummary = {
    low: pricing?.recommendedListLow || null,
    mid: pricing?.recommendedListMid || null,
    high: pricing?.recommendedListHigh || null,
    confidence: pricing?.confidenceScore || null,
    narrative: pricing?.summary || '',
  };

  return {
    reportType: 'seller_intelligence_report',
    title: `${property.title} Seller Intelligence Report`,
    executiveSummary: buildExecutiveSummary({
      property,
      pricing,
      selectedPhotos,
      checklistItems,
      improvementItems,
    }),
    pricingSummary,
    selectedComps,
    selectedPhotos,
    checklistItems,
    improvementItems,
    marketingHighlights,
    disclaimer:
      'This report is informational only. Pricing is not an appraisal, provider guidance is not a guarantee, and AI-generated outputs should be independently reviewed before use.',
    payload: {
      property: {
        title: property.title,
        addressLine1: property.addressLine1,
        city: property.city,
        state: property.state,
        zip: property.zip,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFeet: property.squareFeet,
        propertyType: property.propertyType,
      },
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function generatePropertyReport({ propertyId }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to generate reports.');
  }

  const [property, pricing, mediaAssets, flyer] = await Promise.all([
    getPropertyById(propertyId),
    getLatestPricingAnalysis(propertyId),
    listMediaAssets(propertyId),
    getLatestPropertyFlyer(propertyId),
  ]);

  if (!property) {
    throw new Error('Property not found.');
  }

  const reportPayload = buildReportPayload({
    property,
    pricing,
    mediaAssets,
    flyer,
  });

  const document = await ReportModel.create({
    propertyId,
    ...reportPayload,
    source: flyer?.source || pricing?.source || 'system',
  });

  return serializeReport(document.toObject());
}

export async function getLatestPropertyReport(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const report = await ReportModel.findOne({ propertyId }).sort({ createdAt: -1 }).lean();
  return serializeReport(report);
}

function wrapText(text, maxChars = 84) {
  if (!text) {
    return [];
  }

  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function drawWrappedText(page, font, text, options) {
  const {
    x,
    y,
    size = 12,
    color = rgb(0, 0, 0),
    lineHeight = size * 1.5,
    maxChars = 84,
  } = options;

  let cursorY = y;
  for (const line of wrapText(text, maxChars)) {
    page.drawText(line, {
      x,
      y: cursorY,
      size,
      font,
      color,
    });
    cursorY -= lineHeight;
  }

  return cursorY;
}

async function fetchPdfImage(pdfDoc, imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('png') || imageUrl.toLowerCase().includes('.png')) {
      return pdfDoc.embedPng(bytes);
    }

    return pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function exportPropertyReportPdf({ propertyId }) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const report = (await getLatestPropertyReport(propertyId)) || (await generatePropertyReport({ propertyId }));

  const pdfDoc = await PDFDocument.create();
  const coverPage = pdfDoc.addPage([612, 792]);
  const detailPage = pdfDoc.addPage([612, 792]);
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const colors = {
    ink: rgb(0.1, 0.13, 0.17),
    muted: rgb(0.36, 0.41, 0.38),
    clay: rgb(0.78, 0.45, 0.28),
    moss: rgb(0.27, 0.39, 0.31),
    panel: rgb(0.98, 0.95, 0.91),
    line: rgb(0.87, 0.82, 0.75),
  };

  const heroPhoto = report.selectedPhotos?.[0] || null;
  const embeddedHero = heroPhoto?.imageUrl ? await fetchPdfImage(pdfDoc, heroPhoto.imageUrl) : null;

  coverPage.drawRectangle({
    x: 30,
    y: 30,
    width: 552,
    height: 732,
    color: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  });

  coverPage.drawText('WORKSIDE SELLER INTELLIGENCE REPORT', {
    x: 54,
    y: 732,
    size: 11,
    font: headingFont,
    color: colors.moss,
  });

  coverPage.drawText(report.title, {
    x: 54,
    y: 690,
    size: 24,
    font: headingFont,
    color: colors.ink,
    maxWidth: 340,
  });

  let coverCursor = drawWrappedText(coverPage, bodyFont, report.executiveSummary, {
    x: 54,
    y: 636,
    size: 12,
    color: colors.muted,
    maxChars: 52,
    lineHeight: 18,
  });

  coverPage.drawText(
    `${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`,
    {
      x: 54,
      y: coverCursor - 18,
      size: 12,
      font: bodyFont,
      color: colors.ink,
      maxWidth: 300,
    },
  );

  coverPage.drawText(
    report.pricingSummary?.mid
      ? `Recommended midpoint: ${formatCurrency(report.pricingSummary.mid)}`
      : 'Pricing midpoint pending analysis',
    {
      x: 54,
      y: coverCursor - 56,
      size: 16,
      font: headingFont,
      color: colors.clay,
    },
  );

  if (embeddedHero) {
    const frame = { x: 370, y: 436, width: 160, height: 220 };
    const dims = embeddedHero.scale(1);
    const ratio = Math.min(frame.width / dims.width, frame.height / dims.height);
    const width = dims.width * ratio;
    const height = dims.height * ratio;

    coverPage.drawRectangle({
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      color: rgb(1, 1, 1),
      borderColor: colors.line,
      borderWidth: 1,
    });

    coverPage.drawImage(embeddedHero, {
      x: frame.x + (frame.width - width) / 2,
      y: frame.y + (frame.height - height) / 2,
      width,
      height,
    });
  }

  detailPage.drawRectangle({
    x: 30,
    y: 30,
    width: 552,
    height: 732,
    color: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  });

  detailPage.drawText('PRICING AND PREP SNAPSHOT', {
    x: 54,
    y: 732,
    size: 12,
    font: headingFont,
    color: colors.moss,
  });

  let detailCursor = 700;
  detailPage.drawText('Pricing Narrative', {
    x: 54,
    y: detailCursor,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  detailCursor = drawWrappedText(
    detailPage,
    bodyFont,
    report.pricingSummary?.narrative || 'No pricing narrative is currently stored.',
    {
      x: 54,
      y: detailCursor - 22,
      size: 11,
      color: colors.muted,
      maxChars: 80,
      lineHeight: 16,
    },
  );

  detailPage.drawText('Top Checklist Items', {
    x: 54,
    y: detailCursor - 12,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  detailCursor -= 34;
  for (const item of report.checklistItems.slice(0, 4)) {
    detailPage.drawText(`• ${item}`, {
      x: 60,
      y: detailCursor,
      size: 11,
      font: bodyFont,
      color: colors.ink,
    });
    detailCursor -= 18;
  }

  detailPage.drawText('Top Improvements', {
    x: 54,
    y: detailCursor - 8,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  detailCursor -= 30;
  for (const item of report.improvementItems.slice(0, 4)) {
    detailPage.drawText(`• ${item}`, {
      x: 60,
      y: detailCursor,
      size: 11,
      font: bodyFont,
      color: colors.ink,
    });
    detailCursor -= 18;
  }

  detailPage.drawText('Selected Comps', {
    x: 320,
    y: 700,
    size: 14,
    font: headingFont,
    color: colors.ink,
  });
  let compCursor = 676;
  for (const comp of report.selectedComps.slice(0, 4)) {
    detailPage.drawText(comp.address || 'Comparable property', {
      x: 320,
      y: compCursor,
      size: 11,
      font: headingFont,
      color: colors.ink,
      maxWidth: 220,
    });
    compCursor = drawWrappedText(
      detailPage,
      bodyFont,
      `${formatCurrency(comp.price || 0)} · ${comp.beds || '--'} bd · ${comp.baths || '--'} ba · ${comp.sqft || '--'} sqft · ${(comp.distanceMiles || 0).toFixed(2)} mi`,
      {
        x: 320,
        y: compCursor - 16,
        size: 10,
        color: colors.muted,
        maxChars: 34,
        lineHeight: 14,
      },
    ) - 10;
  }

  drawWrappedText(detailPage, bodyFont, report.disclaimer, {
    x: 54,
    y: 86,
    size: 9,
    color: colors.muted,
    maxChars: 94,
    lineHeight: 12,
  });

  const bytes = await pdfDoc.save();
  const filename = `${String(property.title || 'property')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}-seller-report.pdf`;

  return {
    bytes,
    filename,
    report,
  };
}
