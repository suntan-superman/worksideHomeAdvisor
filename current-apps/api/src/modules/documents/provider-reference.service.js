import mongoose from 'mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { formatCurrency } from '@workside/utils';
import { getLatestPricingAnalysis } from '../pricing/pricing.service.js';
import { getPropertyById } from '../properties/property.service.js';
import { ProviderReferenceModel } from '../providers/provider-leads.model.js';

function sanitizeFilePart(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function wrapText(text, maxChars = 68) {
  if (!text) return [];
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

  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(page, font, text, options) {
  const {
    x,
    y,
    size = 11,
    color = rgb(0, 0, 0),
    lineHeight = size * 1.45,
    maxChars = 68,
  } = options;

  let cursorY = y;
  for (const line of wrapText(text, maxChars)) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }
  return cursorY;
}

function formatLocation(reference) {
  return [reference.city, reference.state].filter(Boolean).join(', ') || reference.coverageLabel || 'Coverage not listed';
}

function buildReferenceSubtitle(reference) {
  const parts = [
    reference.categoryLabel || reference.categoryKey || 'Provider',
    formatLocation(reference),
  ].filter(Boolean);
  return parts.join(' • ');
}

function buildReferenceAccessLabel(reference) {
  if (reference.websiteUrl) {
    try {
      return new URL(reference.websiteUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'Website available';
    }
  }

  if (reference.mapsUrl) {
    return reference.source === 'google_maps' ? 'Google Maps reference saved' : 'Maps link available';
  }

  return 'Not listed';
}

export async function exportProviderReferenceSheetPdf({ propertyId }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to export provider reference sheets.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const [pricing, references] = await Promise.all([
    getLatestPricingAnalysis(propertyId).catch(() => null),
    ProviderReferenceModel.find({
      propertyId,
      userId: property.ownerUserId,
    })
      .sort({ createdAt: 1, businessName: 1 })
      .limit(5)
      .lean(),
  ]);

  if (!references.length) {
    throw new Error('No saved provider references are available for this property yet.');
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const colors = {
    ink: rgb(0.12, 0.15, 0.18),
    muted: rgb(0.38, 0.43, 0.4),
    clay: rgb(0.78, 0.45, 0.28),
    moss: rgb(0.27, 0.39, 0.31),
    panel: rgb(0.98, 0.95, 0.91),
    line: rgb(0.87, 0.82, 0.75),
    white: rgb(1, 1, 1),
  };

  page.drawRectangle({
    x: 28,
    y: 28,
    width: 556,
    height: 736,
    color: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
  });

  page.drawText('WORKSIDE HOME SELLER ASSISTANT', {
    x: 52,
    y: 730,
    size: 10,
    font: headingFont,
    color: colors.moss,
  });

  page.drawText('Provider reference sheet', {
    x: 52,
    y: 692,
    size: 24,
    font: headingFont,
    color: colors.ink,
  });

  drawWrappedText(page, bodyFont, `${property.title} · ${[property.addressLine1, property.city, property.state, property.zip].filter(Boolean).join(', ')}`, {
    x: 52,
    y: 666,
    size: 12,
    color: colors.muted,
    maxChars: 74,
  });

  page.drawRectangle({
    x: 52,
    y: 592,
    width: 160,
    height: 58,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  });
  page.drawText('SUGGESTED RANGE', {
    x: 68,
    y: 629,
    size: 9,
    font: headingFont,
    color: colors.moss,
  });
  page.drawText(
    pricing?.recommendedListLow && pricing?.recommendedListHigh
      ? `${formatCurrency(pricing.recommendedListLow)} to ${formatCurrency(pricing.recommendedListHigh)}`
      : 'Not available',
    {
      x: 68,
      y: 607,
      size: 12,
      font: bodyFont,
      color: colors.ink,
      maxWidth: 130,
    },
  );

  page.drawRectangle({
    x: 224,
    y: 592,
    width: 160,
    height: 58,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  });
  page.drawText('CHOSEN PRICE', {
    x: 240,
    y: 629,
    size: 9,
    font: headingFont,
    color: colors.moss,
  });
  page.drawText(
    property.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set',
    {
      x: 240,
      y: 607,
      size: 12,
      font: bodyFont,
      color: colors.ink,
    },
  );

  page.drawRectangle({
    x: 396,
    y: 592,
    width: 136,
    height: 58,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  });
  page.drawText('SAVED CONTACTS', {
    x: 412,
    y: 629,
    size: 9,
    font: headingFont,
    color: colors.moss,
  });
  page.drawText(String(references.length), {
    x: 412,
    y: 606,
    size: 18,
    font: headingFont,
    color: colors.ink,
  });

  let cursorY = 554;
  for (const reference of references) {
    const cardHeight = 108;
    page.drawRectangle({
      x: 52,
      y: cursorY - cardHeight,
      width: 480,
      height: cardHeight,
      color: colors.white,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 16,
    });

    page.drawText(reference.businessName || 'Provider reference', {
      x: 68,
      y: cursorY - 24,
      size: 16,
      font: headingFont,
      color: colors.ink,
      maxWidth: 280,
    });

    page.drawText(buildReferenceSubtitle(reference), {
      x: 68,
      y: cursorY - 44,
      size: 10,
      font: bodyFont,
      color: colors.muted,
      maxWidth: 280,
    });

    const description = reference.description || reference.coverageLabel || 'No additional notes saved for this provider.';
    drawWrappedText(page, bodyFont, description, {
      x: 68,
      y: cursorY - 64,
      size: 10,
      color: colors.ink,
      maxChars: 46,
      lineHeight: 13,
    });

    let detailY = cursorY - 24;
    const details = [
      ['Phone', reference.phone || 'Not listed'],
      ['Email', reference.email || 'Not listed'],
      ['Access', buildReferenceAccessLabel(reference)],
      [
        'Source',
        reference.source === 'google_maps' ? 'Saved Google reference' : 'Workside marketplace',
      ],
    ];

    for (const [label, value] of details) {
      page.drawText(label.toUpperCase(), {
        x: 362,
        y: detailY,
        size: 8,
        font: headingFont,
        color: colors.moss,
      });
      drawWrappedText(page, bodyFont, value, {
        x: 362,
        y: detailY - 12,
        size: 10,
        color: colors.ink,
        maxChars: 24,
        lineHeight: 12,
      });
      detailY -= 24;
    }

    cursorY -= cardHeight + 14;
  }

  drawWrappedText(
    page,
    bodyFont,
    'Reference contacts may include Workside marketplace providers and manually saved external references. Availability, pricing, and credentials should be confirmed before engagement.',
    {
      x: 52,
      y: 72,
      size: 9,
      color: colors.muted,
      maxChars: 92,
      lineHeight: 12,
    },
  );

  const bytes = await pdfDoc.save();
  const filename = `${sanitizeFilePart(property.title, 'property')}-provider-reference-sheet.pdf`;

  return {
    bytes,
    filename,
    count: references.length,
  };
}
