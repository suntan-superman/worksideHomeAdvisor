import sharp from 'sharp';
import { rgb } from 'pdf-lib';

import { env } from '../../config/env.js';

export const PDF_PAGE_WIDTH = 612;
export const PDF_PAGE_HEIGHT = 792;
export const PDF_PAGE_MARGIN = 42;

export function createPdfPalette() {
  return {
    ink: rgb(0.09, 0.12, 0.16),
    muted: rgb(0.38, 0.42, 0.41),
    clay: rgb(0.78, 0.45, 0.28),
    claySoft: rgb(0.96, 0.89, 0.83),
    moss: rgb(0.28, 0.4, 0.33),
    mossSoft: rgb(0.9, 0.95, 0.91),
    line: rgb(0.88, 0.83, 0.76),
    panel: rgb(0.985, 0.97, 0.94),
    paper: rgb(0.996, 0.992, 0.986),
    sky: rgb(0.92, 0.95, 0.99),
    warmGray: rgb(0.95, 0.93, 0.9),
    white: rgb(1, 1, 1),
  };
}

export function wrapText(text = '', maxChars = 84) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return [''];
  }

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

export function drawWrappedText(page, font, text, options) {
  const {
    x,
    y,
    size = 12,
    color = rgb(0, 0, 0),
    lineHeight = size * 1.45,
    maxChars = 84,
  } = options;
  let cursorY = y;

  for (const line of wrapText(text, maxChars)) {
    if (!line) {
      cursorY -= lineHeight;
      continue;
    }

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

export function drawBulletList(page, font, items, options) {
  const {
    x,
    y,
    size = 11,
    color = rgb(0, 0, 0),
    maxChars = 42,
    limit = items.length,
    gap = 6,
  } = options;
  let cursor = y;

  for (const item of items.slice(0, limit)) {
    cursor =
      drawWrappedText(page, font, `• ${item}`, {
        x,
        y: cursor,
        size,
        color,
        maxChars,
        lineHeight: size * 1.35,
      }) - gap;
  }

  return cursor;
}

export async function fetchPdfImage(pdfDoc, imageUrl) {
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
    const isPng =
      contentType.includes('png') ||
      imageUrl.toLowerCase().includes('.png') ||
      (bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47);
    const isJpeg =
      contentType.includes('jpeg') ||
      contentType.includes('jpg') ||
      imageUrl.toLowerCase().includes('.jpg') ||
      imageUrl.toLowerCase().includes('.jpeg') ||
      (bytes[0] === 0xff && bytes[1] === 0xd8);

    if (isPng) {
      return pdfDoc.embedPng(bytes);
    }

    if (isJpeg) {
      return pdfDoc.embedJpg(bytes);
    }

    const convertedBytes = await sharp(bytes).png().toBuffer();
    return pdfDoc.embedPng(convertedBytes);
  } catch {
    return null;
  }
}

export function sanitizeFilePart(value, fallback) {
  return (
    String(value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

export function drawDocumentFrame(page, colors) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PDF_PAGE_WIDTH,
    height: PDF_PAGE_HEIGHT,
    color: colors.paper,
  });

  page.drawRectangle({
    x: 24,
    y: 24,
    width: PDF_PAGE_WIDTH - 48,
    height: PDF_PAGE_HEIGHT - 48,
    color: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  });
}

export function drawBrandHeader(page, fonts, options = {}) {
  const {
    eyebrow = 'WORKSIDE HOME ADVISOR',
    title = '',
    subtitle = '',
    pageNumber = null,
    totalPages = null,
    colors = createPdfPalette(),
  } = options;
  const { headingFont, bodyFont } = fonts;

  page.drawRectangle({
    x: PDF_PAGE_MARGIN,
    y: 698,
    width: PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2,
    height: 58,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
  });

  page.drawText(eyebrow, {
    x: PDF_PAGE_MARGIN + 18,
    y: 734,
    size: 10,
    font: headingFont,
    color: colors.moss,
  });

  if (pageNumber && totalPages) {
    page.drawText(`Page ${pageNumber} of ${totalPages}`, {
      x: PDF_PAGE_WIDTH - PDF_PAGE_MARGIN - 74,
      y: 734,
      size: 10,
      font: bodyFont,
      color: colors.muted,
    });
  }

  if (title) {
    page.drawText(title, {
      x: PDF_PAGE_MARGIN + 18,
      y: 708,
      size: 22,
      font: headingFont,
      color: colors.ink,
      maxWidth: 390,
    });
  }

  if (subtitle) {
    drawWrappedText(page, bodyFont, subtitle, {
      x: PDF_PAGE_MARGIN + 18,
      y: 689,
      size: 10,
      color: colors.muted,
      maxChars: 86,
      lineHeight: 12,
    });
  }
}

export function drawDocumentFooter(page, fonts, options = {}) {
  const {
    colors = createPdfPalette(),
    footerNote = 'Prepared by Workside Home Advisor for seller planning and listing coordination.',
  } = options;
  const { headingFont, bodyFont } = fonts;
  const footerY = 38;

  page.drawLine({
    start: { x: PDF_PAGE_MARGIN, y: footerY + 22 },
    end: { x: PDF_PAGE_WIDTH - PDF_PAGE_MARGIN, y: footerY + 22 },
    thickness: 1,
    color: colors.line,
  });

  page.drawText('Workside Home Advisor', {
    x: PDF_PAGE_MARGIN,
    y: footerY + 8,
    size: 10,
    font: headingFont,
    color: colors.ink,
  });

  drawWrappedText(page, bodyFont, footerNote, {
    x: PDF_PAGE_MARGIN + 126,
    y: footerY + 10,
    size: 8,
    color: colors.muted,
    maxChars: 64,
    lineHeight: 10,
  });

  page.drawText(
    String(env.PUBLIC_WEB_URL || 'https://worksideadvisor.com')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, ''),
    {
      x: PDF_PAGE_WIDTH - PDF_PAGE_MARGIN - 110,
      y: footerY + 8,
      size: 9,
      font: bodyFont,
      color: colors.muted,
    },
  );
}

export function drawMetricCard(page, fonts, options = {}) {
  const {
    x,
    y,
    width,
    height = 74,
    label,
    value,
    supportText = '',
    colors = createPdfPalette(),
    tone = 'default',
  } = options;
  const { headingFont, bodyFont } = fonts;
  const fillColor = tone === 'accent' ? colors.claySoft : tone === 'moss' ? colors.mossSoft : colors.white;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fillColor,
    borderColor: colors.line,
    borderWidth: 1,
  });

  page.drawText(label, {
    x: x + 14,
    y: y + height - 20,
    size: 9,
    font: headingFont,
    color: colors.moss,
  });

  page.drawText(value, {
    x: x + 14,
    y: y + height - 46,
    size: 17,
    font: headingFont,
    color: colors.ink,
    maxWidth: width - 24,
  });

  if (supportText) {
    drawWrappedText(page, bodyFont, supportText, {
      x: x + 14,
      y: y + 16,
      size: 8,
      color: colors.muted,
      maxChars: Math.max(18, Math.floor((width - 30) / 5)),
      lineHeight: 10,
    });
  }
}

export function drawSectionEyebrow(page, fonts, options = {}) {
  const { x, y, text, colors = createPdfPalette() } = options;
  page.drawText(text, {
    x,
    y,
    size: 10,
    font: fonts.headingFont,
    color: colors.moss,
  });
}

export function drawContainedImageFrame(page, embeddedImage, options = {}) {
  const {
    x,
    y,
    width,
    height,
    colors = createPdfPalette(),
    backgroundColor = colors.white,
    borderColor = colors.line,
  } = options;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: backgroundColor,
    borderColor,
    borderWidth: 1,
  });

  if (!embeddedImage) {
    return;
  }

  const dims = embeddedImage.scale(1);
  const ratio = Math.min(width / dims.width, height / dims.height);
  const renderWidth = dims.width * ratio;
  const renderHeight = dims.height * ratio;

  page.drawImage(embeddedImage, {
    x: x + (width - renderWidth) / 2,
    y: y + (height - renderHeight) / 2,
    width: renderWidth,
    height: renderHeight,
  });
}
