import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { BRANDING } from '@workside/branding';
import { formatCurrency } from '@workside/utils';

import { env } from '../../config/env.js';

const SUPPORT_EMAIL = BRANDING.supportEmail;
const SUPPORT_PHONE = BRANDING.supportPhone || String(env.SUPPORT_PHONE || '').trim();
const RAW_PUBLIC_WEB_URL = BRANDING.publicWebUrl || String(env.PUBLIC_WEB_URL || 'https://worksideadvisor.com');
const PUBLIC_WEB_URL = (() => {
  const normalized = String(RAW_PUBLIC_WEB_URL || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  if (!normalized || normalized.includes('netlify.app')) {
    return 'worksideadvisor.com';
  }
  return normalized;
})();

function logPdfEvent(event, details = {}) {
  const payload = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
  console.info(`[pdf] ${event}${payload ? ` ${payload}` : ''}`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateLabel(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatMetricValue(value, fallback = 'Unavailable') {
  return value || value === 0 ? escapeHtml(value) : fallback;
}

function buildPropertyAddress(property) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

function buildComparableMapImageUrl(property, comps = []) {
  const propertyQuery = buildPropertyAddress(property);
  if (!propertyQuery || !env.GOOGLE_MAPS_SERVER_API_KEY) {
    return '';
  }

  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_API_KEY);
  url.searchParams.set('size', '1400x900');
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.append('markers', `color:0xc87447|label:S|${propertyQuery}`);
  url.searchParams.append('visible', propertyQuery);

  comps.slice(0, 6).forEach((comp, index) => {
    if (!comp?.address) {
      return;
    }
    const label = String.fromCharCode(65 + index);
    url.searchParams.append('markers', `color:0x4f7b62|label:${label}|${comp.address}`);
    url.searchParams.append('visible', comp.address);
  });

  return url.toString();
}

function buildNeighborhoodMapImageUrl(property) {
  const propertyQuery = buildPropertyAddress(property);
  if (!propertyQuery || !env.GOOGLE_MAPS_SERVER_API_KEY) {
    return '';
  }

  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_API_KEY);
  url.searchParams.set('size', '1400x900');
  url.searchParams.set('scale', '2');
  url.searchParams.set('maptype', 'roadmap');
  url.searchParams.append('markers', `color:0xc87447|label:H|${propertyQuery}`);
  url.searchParams.append('visible', propertyQuery);
  return url.toString();
}

function bytesContainStaticMapError(buffer) {
  if (!buffer) {
    return false;
  }

  try {
    const decoded = Buffer.from(buffer).toString('latin1');
    return decoded.includes('g.co/staticmaperror');
  } catch {
    return false;
  }
}

async function resolveStaticMapImageUrl(url) {
  if (!url) {
    return '';
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return '';
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return '';
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length || bytesContainStaticMapError(buffer)) {
      return '';
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    return !['--', '—', 'pending', 'risk pending', 'opportunity pending'].includes(trimmed.toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  return true;
}

function titleCaseLabel(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPercentValue(value, digits = 0) {
  if (!hasMeaningfulValue(value) && value !== 0) {
    return '';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return `${numeric.toFixed(digits)}%`;
}

function formatSqftValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return `${numeric.toLocaleString('en-US')} sqft`;
}

function formatDistanceMiles(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return `${numeric.toFixed(numeric < 10 ? 2 : 1)} mi`;
}

function formatPropertyTypeLabel(value) {
  if (!hasMeaningfulValue(value)) {
    return '';
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'single_family') {
    return 'Single-family home';
  }
  return titleCaseLabel(normalized);
}

function formatCompactNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return numeric.toLocaleString('en-US');
}

function pickMeaningfulLines(items = [], limit = 5) {
  const seen = new Set();
  return (items || [])
    .flat()
    .map((item) => String(item ?? '').trim())
    .filter((item) => hasMeaningfulValue(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function normalizeRoomText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function flyerRoomBucket(roomLabel = '') {
  const room = normalizeRoomText(roomLabel);
  if (!room) {
    return 'other';
  }
  if (room.includes('exterior') || room.includes('front') || room.includes('backyard') || room.includes('yard')) {
    return 'exterior';
  }
  if (room.includes('kitchen')) {
    return 'kitchen';
  }
  if (room.includes('living') || room.includes('family') || room.includes('great room') || room.includes('main area')) {
    return 'living';
  }
  if (room.includes('primary') || room.includes('bedroom')) {
    return 'bedroom';
  }
  if (room.includes('bath')) {
    return 'bathroom';
  }
  return 'other';
}

function resolveFlyerPhotoIdentity(photo = {}) {
  const imageUrl = String(photo?.imageUrl || '').trim();
  const normalizedUrl = imageUrl.split('?')[0].toLowerCase();
  const fileName = normalizedUrl.split('/').pop() || '';
  return String(photo?.assetId || fileName || normalizedUrl || '').toLowerCase();
}

function selectFlyerGalleryPhotos(photos = [], maxCount = 4) {
  const withImages = (photos || []).filter((photo) => photo?.imageUrl);
  if (!withImages.length) {
    return [];
  }

  const safeMaxCount = Math.max(1, Number(maxCount) || 4);
  const selected = [];
  const requiredBuckets = ['exterior', 'kitchen', 'living'];
  const priorityBuckets = [...requiredBuckets, 'bedroom', 'bathroom', 'other'];

  for (const bucket of priorityBuckets) {
    const candidate = withImages.find(
      (photo) =>
        !selected.some((picked) => resolveFlyerPhotoIdentity(picked) === resolveFlyerPhotoIdentity(photo)) &&
        flyerRoomBucket(photo.roomLabel) === bucket,
    );
    if (!candidate) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= safeMaxCount) {
      return selected.slice(0, safeMaxCount);
    }
  }

  for (const photo of withImages) {
    if (selected.length >= safeMaxCount) {
      break;
    }
    if (selected.some((picked) => resolveFlyerPhotoIdentity(picked) === resolveFlyerPhotoIdentity(photo))) {
      continue;
    }
    selected.push(photo);
  }

  const deduped = [];
  const seenIdentities = new Set();
  for (const photo of selected) {
    const identity = resolveFlyerPhotoIdentity(photo);
    if (!identity || seenIdentities.has(identity)) {
      continue;
    }
    seenIdentities.add(identity);
    deduped.push(photo);
  }

  return deduped.slice(0, safeMaxCount);
}

function ensureMinimumFlyerPhotos(primaryPhotos = [], fallbackPhotos = [], minimum = 3, maximum = 5) {
  const allCandidates = [...(primaryPhotos || []), ...(fallbackPhotos || [])].filter(
    (photo) => photo?.imageUrl,
  );
  if (!allCandidates.length) {
    return [];
  }

  const minCount = Math.max(1, Number(minimum) || 3);
  const maxCount = Math.max(minCount, Number(maximum) || 5);
  const selected = [];
  const seenIdentities = new Set();
  for (const photo of allCandidates) {
    const identity = resolveFlyerPhotoIdentity(photo);
    if (!identity || seenIdentities.has(identity)) {
      continue;
    }
    seenIdentities.add(identity);
    selected.push({
      ...photo,
      roomLabel:
        photo?.roomLabel || `${titleCaseLabel(flyerRoomBucket(photo?.roomLabel || 'property'))} photo`,
    });
    if (selected.length >= maxCount) {
      break;
    }
  }

  if (selected.length < minCount) {
    return selected;
  }

  return selected.slice(0, maxCount);
}

function countDuplicateFlyerPhotos(photos = []) {
  const seen = new Set();
  let duplicateCount = 0;
  for (const photo of photos || []) {
    const identity = resolveFlyerPhotoIdentity(photo);
    if (!identity) {
      continue;
    }
    if (seen.has(identity)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(identity);
  }
  return duplicateCount;
}

function splitPrimaryAndOverflow(items = [], primaryLimit = 4) {
  const safeItems = (items || []).filter(Boolean);
  const safeLimit = Math.max(1, Number(primaryLimit) || 1);
  return {
    primary: safeItems.slice(0, safeLimit),
    overflow: safeItems.slice(safeLimit),
  };
}

function containsPlaceholderLanguage(value = '') {
  return /(final images coming soon|being curated|placeholder recommendation|placeholder provider)/i.test(
    String(value || ''),
  );
}

function rewriteGenericFlyerCopy(value = '') {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  const replacements = [
    { pattern: /\bcomfortable living\b/gi, replacement: 'clear living-room layout' },
    { pattern: /\bspacious living\b/gi, replacement: 'open living-zone flow' },
    { pattern: /\bgreat for entertaining\b/gi, replacement: 'supports hosting flow and daily function' },
    { pattern: /\bcharming\b/gi, replacement: 'well-positioned' },
    { pattern: /\bbeautiful\b/gi, replacement: 'well-presented' },
    { pattern: /\bcozy\b/gi, replacement: 'efficiently arranged' },
  ];
  for (const { pattern, replacement } of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function orderFlyerPhotosForNarrative(photos = [], maxCount = 6) {
  const safePhotos = (photos || []).filter((photo) => photo?.imageUrl);
  if (!safePhotos.length) {
    return [];
  }
  const order = ['exterior', 'kitchen', 'living', 'bedroom', 'bathroom', 'other'];
  const picked = [];
  for (const bucket of order) {
    const nextPhoto = safePhotos.find(
      (photo) =>
        !picked.some((item) => resolveFlyerPhotoIdentity(item) === resolveFlyerPhotoIdentity(photo)) &&
        flyerRoomBucket(photo?.roomLabel) === bucket,
    );
    if (nextPhoto) {
      picked.push(nextPhoto);
    }
  }
  for (const photo of safePhotos) {
    if (picked.length >= maxCount) {
      break;
    }
    if (picked.some((item) => resolveFlyerPhotoIdentity(item) === resolveFlyerPhotoIdentity(photo))) {
      continue;
    }
    picked.push(photo);
  }
  return picked.slice(0, maxCount);
}

function renderFlyerGalleryTiles(photos = []) {
  const galleryPhotos = (photos || []).filter((photo) => photo?.imageUrl).slice(0, 6);
  if (!galleryPhotos.length) {
    return '';
  }
  const slotClasses = ['large', 'medium-a', 'medium-b', 'small-a', 'small-b', 'small-c'];

  return `
    <div class="gallery-strip gallery-strip-polished gallery-strip-mosaic">
      ${galleryPhotos
        .map(
          (photo, index) => `
            <figure class="gallery-item gallery-item-${slotClasses[index] || 'small-c'}">
              <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.roomLabel || 'Gallery photo')}" />
            </figure>
          `,
        )
        .join('')}
    </div>
  `;
}

function resolveInsightTheme(line = '') {
  const normalized = String(line || '').toLowerCase();
  if (!normalized) {
    return 'other';
  }
  if (normalized.includes('retake') || normalized.includes('photo')) {
    return 'photo';
  }
  if (normalized.includes('readiness') || normalized.includes('launch status')) {
    return 'readiness';
  }
  if (normalized.includes('checklist')) {
    return 'checklist';
  }
  if (normalized.includes('pricing') || normalized.includes('price')) {
    return 'pricing';
  }
  if (normalized.includes('provider')) {
    return 'provider';
  }
  if (normalized.includes('action') || normalized.includes('next step')) {
    return 'action';
  }
  return 'other';
}

function dedupeInsightsByTheme(lines = [], limit = 5) {
  const output = [];
  const seenThemes = new Set();
  const seenLines = new Set();
  for (const line of lines || []) {
    const normalizedLine = String(line || '').trim().toLowerCase();
    if (!normalizedLine || seenLines.has(normalizedLine)) {
      continue;
    }
    const theme = resolveInsightTheme(line);
    if (theme !== 'other' && seenThemes.has(theme)) {
      continue;
    }
    seenLines.add(normalizedLine);
    if (theme !== 'other') {
      seenThemes.add(theme);
    }
    output.push(String(line || '').trim());
    if (output.length >= limit) {
      break;
    }
  }
  return output;
}

function toSecondaryInsightReference(line = '') {
  const normalized = String(line || '').toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized.includes('retake') || normalized.includes('photo')) {
    return 'Photo retakes are still required before listing.';
  }
  if (normalized.includes('checklist')) {
    return 'Checklist completion is still required before launch.';
  }
  if (normalized.includes('pricing') || normalized.includes('price')) {
    return 'Pricing alignment should stay tied to current comp signals.';
  }
  if (normalized.includes('provider')) {
    return 'Provider coordination is still required for launch readiness.';
  }
  return shortenNarrative(line, 1);
}

function deriveReadinessRiskOpportunity({
  photoSummary = {},
  checklistSummary = {},
  summaryRisk = '',
  summaryOpportunity = '',
  pricingInsightLines = [],
}) {
  if (Number(photoSummary?.retakeCount || 0) > 0) {
    return {
      risk: `Current photo quality may reduce listing click-through until ${photoSummary.retakeCount} priority retakes are completed.`,
      opportunity:
        'Completing targeted photo retakes can improve first-impression confidence and increase showing requests.',
    };
  }
  if (Number(checklistSummary?.openCount || 0) > 0) {
    return {
      risk: `${checklistSummary.openCount} open checklist items may delay launch confidence and buyer momentum.`,
      opportunity:
        'Closing the remaining checklist items can shorten prep time and improve launch consistency.',
    };
  }
  if (hasMeaningfulValue(pricingInsightLines?.[0])) {
    return {
      risk: 'Pricing and positioning drift can weaken buyer confidence when messaging is inconsistent.',
      opportunity: 'Consistent pricing posture and feature-backed copy can improve qualified buyer response.',
    };
  }
  return {
    risk: toSecondaryInsightReference(summaryRisk || 'Readiness blockers should be addressed before launch.'),
    opportunity: toSecondaryInsightReference(
      summaryOpportunity || 'Completing top readiness actions can improve launch outcomes.',
    ),
  };
}

function getReadinessTone({ score, label }) {
  const normalizedLabel = String(label || '').toLowerCase();
  const numericScore = Number(score || 0);
  if (normalizedLabel.includes('ready') && !normalizedLabel.includes('almost')) {
    return 'ready';
  }
  if (normalizedLabel.includes('almost') || numericScore >= 70) {
    return 'almost';
  }
  return 'needs-work';
}

function renderMetricCard(label, value, support = '', tone = 'default') {
  const valueText = String(value ?? '').trim();
  const shouldWrapValue = valueText.length > 24 || valueText.includes('\n');
  return `
    <div class="metric-card metric-card-${escapeHtml(tone)}">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value ${shouldWrapValue ? 'metric-value-wrap' : ''}">${formatMetricValue(value)}</div>
      ${support ? `<div class="metric-support">${escapeHtml(support)}</div>` : ''}
    </div>
  `;
}

function renderBulletList(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<p class="muted">${escapeHtml(emptyText)}</p>` : '';
  }

  return `
    <ul class="bullet-list">
      ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function renderInsightList(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<p class="muted">${escapeHtml(emptyText)}</p>` : '';
  }

  return `
    <div class="insight-list">
      ${safeItems
        .map(
          (item) => `
            <div class="insight-row">
              <span class="insight-dot"></span>
              <span>${escapeHtml(item)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderChecklistItems(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<p class="muted">${escapeHtml(emptyText)}</p>` : '';
  }

  return `
    <div class="checklist-ui">
      ${safeItems
        .map(
          (item, index) => `
            <div class="checklist-item">
              <div class="checklist-index">${index + 1}</div>
              <div class="checklist-copy">${escapeHtml(item)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderHighlightGrid(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  return `
    <div class="highlight-grid">
      ${safeItems
        .map(
          (item, index) => `
            <div class="highlight-card">
              <div class="highlight-index">${index + 1}</div>
              <div class="highlight-copy">${escapeHtml(item)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderStatusSentenceList(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  return `
    <div class="status-list">
      ${safeItems
        .map(
          (item) => `
            <div class="status-row">
              <span class="status-icon">•</span>
              <span class="status-copy">${escapeHtml(item)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderConfidenceScale(confidence) {
  const numeric = Number(confidence || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }

  const percent = Math.max(0, Math.min(100, Math.round(numeric * 100)));
  return `
    <div class="confidence-scale">
      <div class="confidence-scale-head">
        <span class="metric-label">Pricing confidence</span>
        <strong>${escapeHtml(`${percent}%`)}</strong>
      </div>
      <div class="confidence-track">
        <div class="confidence-fill" style="width:${percent}%;"></div>
      </div>
      <p class="compact-copy">Confidence reflects how tightly the selected comparable sales support the current pricing stance.</p>
    </div>
  `;
}

function renderFeatureIconGrid(items = [], emptyText = '') {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  return `
    <div class="feature-icon-grid">
      ${safeItems
        .map((item, index) => `
          <div class="feature-icon-card">
            <div class="feature-icon-badge">${index + 1}</div>
            <div class="feature-icon-copy">${escapeHtml(item)}</div>
          </div>
        `)
        .join('')}
    </div>
  `;
}

function getProviderIconLabel(categoryLabel = '') {
  const normalized = String(categoryLabel || '').trim().toLowerCase();
  if (normalized.includes('photograph')) {
    return 'PH';
  }
  if (normalized.includes('inspect')) {
    return 'IN';
  }
  if (normalized.includes('clean')) {
    return 'CL';
  }
  if (normalized.includes('title')) {
    return 'TT';
  }
  if (normalized.includes('attorney')) {
    return 'AT';
  }
  if (normalized.includes('notar')) {
    return 'NO';
  }
  return String(categoryLabel || 'PR')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'PR';
}

function medianCompSummary(comps = []) {
  if (!comps.length) {
    return '';
  }

  const comparableRows = comps.slice(0, 6);
  const medianPrice = comparableRows
    .map((comp) => Number(comp.price || 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

  if (!medianPrice.length) {
    return '';
  }

  const medianPriceValue = medianPrice[Math.floor(medianPrice.length / 2)];
  return `Median nearby comparable price ${formatCurrency(medianPriceValue)}.`;
}

function summarizeComparableSet(comps = []) {
  const comparableRows = (comps || []).slice(0, 6);
  const prices = comparableRows
    .map((comp) => Number(comp.price || 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const pricePerSqftValues = comparableRows
    .map((comp) => {
      const price = Number(comp.price || 0);
      const sqft = Number(comp.sqft || 0);
      return price > 0 && sqft > 0 ? price / sqft : null;
    })
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const closestComp = comparableRows
    .map((comp) => ({ ...comp, _distance: Number(comp.distanceMiles || Number.POSITIVE_INFINITY) }))
    .sort((left, right) => left._distance - right._distance)[0];

  return {
    compCount: comparableRows.length,
    medianPrice: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    medianPricePerSqft: pricePerSqftValues.length
      ? pricePerSqftValues[Math.floor(pricePerSqftValues.length / 2)]
      : null,
    closestComp,
    closestDistance: closestComp?._distance && Number.isFinite(closestComp._distance) ? closestComp._distance : null,
  };
}

function buildComparableInsights({ comps = [], selectedListPrice, pricingConfidence }) {
  const stats = summarizeComparableSet(comps);
  const signals = [];

  if (stats.medianPrice) {
    signals.push(`The selected comparable set centers near ${formatCurrency(stats.medianPrice)}.`);
  }

  if (selectedListPrice && stats.medianPrice) {
    const difference = Number(selectedListPrice) - Number(stats.medianPrice);
    const variance = Math.abs(difference) / Number(stats.medianPrice || 1);
    if (variance <= 0.03) {
      signals.push('The chosen list price stays close to the median comp cluster, supporting a balanced launch position.');
    } else if (difference > 0) {
      signals.push(`The chosen price sits above the median comp set by about ${formatPercentValue(variance * 100, 0)}, so presentation quality matters more.`);
    } else {
      signals.push(`The chosen price sits below the median comp set by about ${formatPercentValue(variance * 100, 0)}, which can improve early buyer response.`);
    }
  }

  if (stats.medianPricePerSqft) {
    signals.push(`Median comp pricing is about ${formatCurrency(Math.round(stats.medianPricePerSqft))} per square foot.`);
  }

  if (stats.closestDistance) {
    signals.push(`The closest selected comp is ${formatDistanceMiles(stats.closestDistance)} from the subject property.`);
  }

  if (pricingConfidence) {
    signals.push(`${Math.round(Number(pricingConfidence) * 100)}% pricing confidence based on available comparable support.`);
  }

  return pickMeaningfulLines(signals, 4);
}

function renderSuggestedCategoryCards(items = []) {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) {
    return '';
  }

  return `
    <div class="suggested-category-grid">
      ${safeItems
        .map(
          (item) => `
            <div class="suggested-category-card">
              <div class="suggested-category-label">Recommended support</div>
              <strong>${escapeHtml(item)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function resolvePriorityMeta(priority = '') {
  const normalized = String(priority || '').trim().toLowerCase();
  if (normalized === 'high' || normalized === 'p1' || normalized.includes('must')) {
    return {
      key: 'p1',
      label: 'P1 Must fix',
      shortLabel: 'P1',
      badgeClass: 'priority-badge priority-badge-p1',
      cardClass: 'action-card-p1',
    };
  }
  if (normalized === 'low' || normalized === 'p3' || normalized.includes('nice')) {
    return {
      key: 'p3',
      label: 'P3 Nice to have',
      shortLabel: 'P3',
      badgeClass: 'priority-badge priority-badge-p3',
      cardClass: 'action-card-p3',
    };
  }
  return {
    key: 'p2',
    label: 'P2 Should fix',
    shortLabel: 'P2',
    badgeClass: 'priority-badge priority-badge-p2',
    cardClass: 'action-card-p2',
  };
}

function resolveActionCategory(action = {}) {
  const actionType = String(action.recommendedActionType || '').toLowerCase();
  if (actionType.includes('photo')) {
    return 'Photo';
  }
  if (actionType.includes('pricing')) {
    return 'Pricing';
  }
  if (actionType.includes('curb') || actionType.includes('exterior')) {
    return 'Exterior';
  }
  if (actionType.includes('staging') || actionType.includes('lighting') || actionType.includes('declutter')) {
    return 'Interior';
  }
  if (actionType.includes('provider')) {
    if (String(action.linkedProviderCategory || '').toLowerCase().includes('clean')) {
      return 'Interior';
    }
    if (String(action.linkedProviderCategory || '').toLowerCase().includes('staging')) {
      return 'Interior';
    }
    if (String(action.linkedProviderCategory || '').toLowerCase().includes('exterior')) {
      return 'Exterior';
    }
    return 'Interior';
  }
  return 'General';
}

function actionRoiScore(action = {}) {
  const actionType = String(action.recommendedActionType || '').toLowerCase();
  const scoreMap = {
    photo_retake: 95,
    pricing_review: 92,
    staging_improvement: 84,
    lighting_improvement: 80,
    curb_appeal: 76,
    declutter: 72,
    provider_booking: 68,
    report_regeneration: 50,
  };
  return Number(scoreMap[actionType] || 60);
}

function actionUrgencyScore(action = {}) {
  const meta = resolvePriorityMeta(action.urgency);
  if (meta.key === 'p1') {
    return 3;
  }
  if (meta.key === 'p2') {
    return 2;
  }
  return 1;
}

function sortRecommendationActions(actions = []) {
  return [...(actions || [])].sort((left, right) => {
    const roiDelta = actionRoiScore(right) - actionRoiScore(left);
    if (roiDelta !== 0) {
      return roiDelta;
    }
    return actionUrgencyScore(right) - actionUrgencyScore(left);
  });
}

function inferFallbackActionType(title = '') {
  const normalized = String(title || '').toLowerCase();
  if (normalized.includes('photo') || normalized.includes('retake')) {
    return 'photo_retake';
  }
  if (normalized.includes('price')) {
    return 'pricing_review';
  }
  if (normalized.includes('curb') || normalized.includes('exterior')) {
    return 'curb_appeal';
  }
  if (normalized.includes('light')) {
    return 'lighting_improvement';
  }
  if (normalized.includes('declutter') || normalized.includes('organize')) {
    return 'declutter';
  }
  if (normalized.includes('stage') || normalized.includes('staging')) {
    return 'staging_improvement';
  }
  if (normalized.includes('provider') || normalized.includes('cleaning') || normalized.includes('photographer')) {
    return 'provider_booking';
  }
  return 'staging_improvement';
}

function fallbackActionUrgency(actionType = '') {
  if (actionType === 'photo_retake' || actionType === 'pricing_review' || actionType === 'provider_booking') {
    return 'high';
  }
  if (actionType === 'curb_appeal' || actionType === 'lighting_improvement') {
    return 'medium';
  }
  return 'medium';
}

function fallbackActionCost(actionType = '') {
  const map = {
    photo_retake: '$250-$650',
    pricing_review: 'Low direct cost',
    curb_appeal: '$300-$1,500',
    lighting_improvement: '$150-$600',
    declutter: '$100-$900',
    staging_improvement: '$500-$2,000',
    provider_booking: 'Varies by provider',
  };
  return map[actionType] || 'Varies';
}

function fallbackActionImpact(actionType = '') {
  const map = {
    photo_retake: 'Stronger first impressions and cleaner gallery quality.',
    pricing_review: 'Clearer buyer value positioning before launch.',
    curb_appeal: 'Improved street-level buyer perception.',
    lighting_improvement: 'Brighter visuals and clearer room presentation.',
    declutter: 'Cleaner perceived space and lower buyer friction.',
    staging_improvement: 'More compelling room purpose and buyer clarity.',
    provider_booking: 'Faster execution across high-priority prep items.',
  };
  return map[actionType] || 'Improved launch readiness and buyer confidence.';
}

function fallbackActionCtaLabel(actionType = '') {
  const map = {
    photo_retake: 'Retake Photos',
    pricing_review: 'Review Pricing',
    curb_appeal: 'Improve Exterior',
    lighting_improvement: 'Fix Lighting',
    declutter: 'Declutter Rooms',
    staging_improvement: 'Improve Staging',
    provider_booking: 'Find Provider',
  };
  return map[actionType] || 'Start Action';
}

function mapRawRecommendationToAction(rawRecommendation, index = 0) {
  const title = typeof rawRecommendation === 'string'
    ? rawRecommendation
    : rawRecommendation?.title || rawRecommendation?.label || '';
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) {
    return null;
  }
  const actionType = inferFallbackActionType(cleanTitle);
  const urgency = String(rawRecommendation?.priority || fallbackActionUrgency(actionType)).toLowerCase();
  return {
    id: `fallback-action-${index + 1}`,
    title: cleanTitle,
    urgency: ['high', 'medium', 'low'].includes(urgency) ? urgency : fallbackActionUrgency(actionType),
    estimatedCost: rawRecommendation?.estimatedCost || fallbackActionCost(actionType),
    expectedOutcome: rawRecommendation?.expectedImpact || rawRecommendation?.estimatedImpact || fallbackActionImpact(actionType),
    reason: rawRecommendation?.rationale || rawRecommendation?.reason || 'Action identified from the report recommendations pipeline.',
    recommendedActionType: rawRecommendation?.recommendedActionType || actionType,
    ctaLabel: rawRecommendation?.ctaLabel || fallbackActionCtaLabel(actionType),
  };
}

function ensureStructuredRecommendationActions({
  structuredActions = [],
  rawRecommendations = [],
  improvementItems = [],
}) {
  const normalizeStructured = (structuredActions || [])
    .map((action, index) => {
      const title = String(action?.title || '').trim();
      if (!title) {
        return null;
      }
      const actionType = action.recommendedActionType || inferFallbackActionType(title);
      return {
        id: action.id || `action-${index + 1}`,
        title,
        urgency: action.urgency || fallbackActionUrgency(actionType),
        estimatedCost: action.estimatedCost || fallbackActionCost(actionType),
        expectedOutcome: action.expectedOutcome || fallbackActionImpact(actionType),
        reason: action.reason || 'Action identified from the report recommendations pipeline.',
        recommendedActionType: actionType,
        ctaLabel: action.ctaLabel || action?.cta?.label || fallbackActionCtaLabel(actionType),
      };
    })
    .filter(Boolean);

  const fallbackPool = [
    ...(rawRecommendations || []),
    ...(improvementItems || []).map((item) => ({ title: item })),
  ];
  const fallbackMapped = fallbackPool
    .map((item, index) => mapRawRecommendationToAction(item, index))
    .filter(Boolean);
  const source = normalizeStructured.length ? normalizeStructured : fallbackMapped;
  const deduped = [];
  const seen = new Set();
  for (const action of source) {
    const key = String(action.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(action);
  }
  if (deduped.length) {
    return deduped.slice(0, 7);
  }
  return [{
    id: 'fallback-action-1',
    title: 'Complete top readiness blockers before listing',
    urgency: 'high',
    estimatedCost: 'Varies by scope',
    expectedOutcome: 'Higher launch confidence and better buyer first impressions.',
    reason: 'Fallback action generated to keep the preparation workflow actionable.',
    recommendedActionType: 'staging_improvement',
    ctaLabel: 'Start Action',
  }];
}

function buildPlaceholderProviders() {
  return [
    {
      categoryKey: 'photographer',
      categoryLabel: 'Photography',
      businessName: 'Local Professional Photographer',
      reason: 'Use for final listing photography and cleaner hero images.',
      reasonMatched: 'Generated from the local support profile when a direct provider match was unavailable.',
      sourceLabel: 'Local support profile',
      confidenceNote: 'Included so execution planning can move forward immediately.',
    },
    {
      categoryKey: 'cleaning_service',
      categoryLabel: 'Cleaning Service',
      businessName: 'Local Cleaning Service',
      reason: 'Useful before photography, brochure generation, and early showings.',
      reasonMatched: 'Generated from the local support profile when a direct provider match was unavailable.',
      sourceLabel: 'Local support profile',
      confidenceNote: 'Included so execution planning can move forward immediately.',
    },
    {
      categoryKey: 'staging_company',
      categoryLabel: 'Home Staging',
      businessName: 'Home Staging Specialist',
      reason: 'Helpful when key rooms still need stronger presentation and buyer clarity.',
      reasonMatched: 'Generated from the local support profile when a direct provider match was unavailable.',
      sourceLabel: 'Local support profile',
      confidenceNote: 'Included so execution planning can move forward immediately.',
    },
  ];
}

function ensureProviderRecommendations(items = []) {
  return (items || []).length ? items : buildPlaceholderProviders();
}

function renderPriorityLegend() {
  return `
    <div class="priority-legend">
      <div class="priority-legend-label">Priority legend</div>
      <span class="priority-badge priority-badge-p1">P1 Must fix before listing</span>
      <span class="priority-badge priority-badge-p2">P2 Should fix</span>
      <span class="priority-badge priority-badge-p3">P3 Nice to have</span>
    </div>
  `;
}

function renderRecommendationActionCards(actions = [], emptyText = '', options = {}) {
  const {
    maxCards = 4,
    maxPerCategory = 2,
    compact = true,
  } = options || {};
  const ranked = sortRecommendationActions(actions).slice(0, Math.max(1, Number(maxCards) || 4));
  if (!ranked.length) {
    return emptyText ? `<div class="empty-card">${escapeHtml(emptyText)}</div>` : '';
  }

  const categoryOrder = ['Photo', 'Interior', 'Exterior', 'Pricing', 'General'];
  const grouped = new Map(categoryOrder.map((category) => [category, []]));
  for (const action of ranked) {
    const category = resolveActionCategory(action);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category).push(action);
  }

  return `
    <div class="action-category-stack">
      ${categoryOrder
        .filter((category) => (grouped.get(category) || []).length)
        .map((category) => {
          const items = (grouped.get(category) || []).slice(0, Math.max(1, Number(maxPerCategory) || 2));
          return `
            <section class="action-group">
              <div class="section-kicker">${escapeHtml(category)} actions</div>
              <div class="action-card-grid">
                ${items
                  .map((action, index) => {
                    const priorityMeta = resolvePriorityMeta(action.urgency);
                    const expectedImpact = compact
                      ? shortenNarrative(action.expectedOutcome || '', 1)
                      : action.expectedOutcome;
                    const reason = compact
                      ? shortenNarrative(action.reason || '', 1)
                      : action.reason;
                    return `
                      <article class="action-card ${priorityMeta.cardClass}">
                        <div class="action-card-head">
                          <h4>${escapeHtml(action.title || `Action ${index + 1}`)}</h4>
                          <span class="${priorityMeta.badgeClass}">${escapeHtml(priorityMeta.shortLabel)}</span>
                        </div>
                        <div class="action-meta">
                          <span>${escapeHtml(category)}</span>
                          ${action.estimatedCost ? `<span>Cost: ${escapeHtml(action.estimatedCost)}</span>` : ''}
                        </div>
                        ${expectedImpact ? `<div class="action-impact"><strong>Expected impact:</strong> ${escapeHtml(expectedImpact)}</div>` : ''}
                        ${reason ? `<div class="action-why"><strong>Why it matters:</strong> ${escapeHtml(reason)}</div>` : ''}
                        ${action.ctaLabel ? `<div class="action-cta-pill">${escapeHtml(action.ctaLabel)}</div>` : ''}
                      </article>
                    `;
                  })
                  .join('')}
              </div>
            </section>
          `;
        })
        .join('')}
    </div>
  `;
}

function classifyPhotoQuality(photo = {}) {
  const score = Number(photo?.score || 0);
  if (score >= 80 && photo?.listingCandidate) {
    return {
      label: 'Strong',
      priority: resolvePriorityMeta('p3'),
      badgeClass: 'photo-quality-badge photo-quality-strong',
    };
  }
  if (score >= 60) {
    return {
      label: 'Usable',
      priority: resolvePriorityMeta('p2'),
      badgeClass: 'photo-quality-badge photo-quality-usable',
    };
  }
  return {
    label: 'Needs Retake',
    priority: resolvePriorityMeta('p1'),
    badgeClass: 'photo-quality-badge photo-quality-retake',
  };
}

function buildPhotoFeedback(photo = {}, quality = {}, usedFeedback = new Set(), position = 0) {
  const listingNote = String(photo?.listingNote || '').trim();
  if (listingNote) {
    const firstSentence = listingNote.split(/[.!?]/).map((part) => part.trim()).filter(Boolean)[0] || listingNote;
    const normalized = firstSentence.toLowerCase();
    if (!usedFeedback.has(normalized)) {
      usedFeedback.add(normalized);
      return firstSentence;
    }
  }
  const score = Number(photo?.score || 0);
  const room = String(photo?.roomLabel || '').toLowerCase();
  const isKitchen = room.includes('kitchen');
  const isExterior = room.includes('exterior') || room.includes('front') || room.includes('yard') || room.includes('backyard');
  const isLiving = room.includes('living') || room.includes('family') || room.includes('great room');
  const isBedroom = room.includes('bedroom') || room.includes('primary');
  const isBathroom = room.includes('bath');

  let candidates = [];
  if (quality.label === 'Needs Retake') {
    if (isKitchen) {
      candidates = score < 50
        ? [
            'Kitchen lighting is underexposed and flattens finish detail.',
            'Counter clutter is pulling focus away from prep surfaces.',
            'Camera angle reduces the island and circulation flow.',
          ]
        : [
            'Kitchen framing misses the prep-to-dining workflow.',
            'Counter details look visually busy near the focal wall.',
            'Reflections and shadow balance are masking cabinet depth.',
          ];
    } else if (isExterior) {
      candidates = [
        'Exterior shadows are too heavy across the front elevation.',
        'Street-side angle needs cleaner framing around the entry line.',
        'Lawn edge and driveway framing should be tightened for curb appeal.',
      ];
    } else if (isLiving) {
      candidates = [
        'Living-room composition feels unbalanced across the seating zone.',
        'Main staging focal point is cropped too tightly.',
        'Camera position should better anchor depth toward the primary wall.',
      ];
    } else if (isBedroom) {
      candidates = [
        'Bedroom angle limits room depth and circulation clarity.',
        'Lighting is flattening bedding texture and wall contrast.',
        'Framing should center the primary wall and nightstand spacing.',
      ];
    } else if (isBathroom) {
      candidates = [
        'Bathroom framing feels tight around the vanity line.',
        'Bathroom lighting reads uneven across mirror and tile surfaces.',
        'Angle should widen to better show fixture spacing.',
      ];
    } else {
      candidates = score < 50
        ? [
            'Lighting is too dark for a confident listing impression.',
            'Exposure should be lifted to recover room detail.',
          ]
        : [
            'Composition feels unbalanced for this room category.',
            'Framing should guide the eye to a clearer focal point.',
          ];
    }
  } else if (quality.label === 'Usable') {
    if (isKitchen) {
      candidates = photo?.listingCandidate
        ? [
            'Kitchen composition is solid; minor lighting polish will improve cabinet clarity.',
            'Prep surfaces read clearly with room for cleaner accessory styling.',
          ]
        : [
            'Kitchen layout reads well, but counter staging still feels busy.',
            'Angle is usable; reduce visual clutter around small appliances.',
          ];
    } else if (isExterior) {
      candidates = [
        'Exterior angle is usable with minor shadow cleanup on the facade.',
        'Curb-line framing is solid; trim lawn distractions near the foreground.',
      ];
    } else if (isLiving) {
      candidates = [
        'Living-room layout reads clearly with minor staging cleanup.',
        'Composition is usable; widen framing slightly to improve room balance.',
      ];
    } else if (isBedroom) {
      candidates = [
        'Bedroom framing is usable with small lighting polish opportunities.',
        'Perspective is solid; refine contrast to separate bed and wall textures.',
      ];
    } else if (isBathroom) {
      candidates = [
        'Bathroom shot is usable; tighten angle around the vanity focal area.',
        'Surface detail is visible; improve light balance near mirror edges.',
      ];
    } else {
      candidates = photo?.listingCandidate
        ? [
            'Good composition with minor polish opportunities before launch.',
            'Usable framing; a cleaner focal anchor will improve buyer readability.',
          ]
        : [
            'Usable image, but visual clutter still competes with the focal area.',
            'Basic composition works; tighten the shot for stronger listing impact.',
          ];
    }
  } else {
    if (isKitchen) {
      candidates = [
        'Kitchen composition is strong and listing-ready.',
        'Lighting and staging support a clear prep-flow story.',
      ];
    } else if (isExterior) {
      candidates = [
        'Exterior framing is strong and curb-focused.',
        'Street-facing angle supports a confident first impression.',
      ];
    } else if (isLiving) {
      candidates = [
        'Living-room composition is balanced and clear.',
        'Staging and depth cues support buyer walk-through pacing.',
      ];
    } else if (isBedroom) {
      candidates = [
        'Bedroom framing is clean and buyer-friendly.',
        'Lighting and composition present calm, usable room depth.',
      ];
    } else if (isBathroom) {
      candidates = [
        'Bathroom composition is clean and clear.',
        'Fixture framing and light balance read as listing-ready.',
      ];
    } else {
      candidates = [
        'Composition is strong for this room type.',
        'Visual balance and focal clarity are listing-ready.',
      ];
    }
  }

  for (const candidate of candidates) {
    const normalized = String(candidate || '').toLowerCase();
    if (!normalized || usedFeedback.has(normalized)) {
      continue;
    }
    usedFeedback.add(normalized);
    return candidate;
  }

  const fallbackCandidates = isKitchen
    ? [
        'Kitchen composition can be refined with cleaner counter styling.',
        'Kitchen angle can be tightened to emphasize prep flow.',
      ]
    : isExterior
      ? [
          'Exterior framing can be refined for stronger curb hierarchy.',
          'Exterior shot can be tightened around entry and lawn lines.',
        ]
      : isLiving
        ? [
            'Living-room staging can be refined for clearer focal balance.',
            'Living-room perspective can be widened for stronger flow.',
          ]
        : isBedroom
          ? [
              'Bedroom framing can be refined for clearer depth and symmetry.',
              'Bedroom lighting balance can be tuned for cleaner detail.',
            ]
          : isBathroom
            ? [
                'Bathroom angle can be refined for stronger fixture alignment.',
                'Bathroom exposure can be tuned for clearer surface detail.',
              ]
            : [
                'Composition can be tightened for stronger buyer readability.',
                'Lighting and framing can be refined for cleaner presentation.',
              ];

  for (const candidate of fallbackCandidates) {
    const normalized = String(candidate || '').toLowerCase();
    if (!normalized || usedFeedback.has(normalized)) {
      continue;
    }
    usedFeedback.add(normalized);
    return candidate;
  }

  const fallback = `Refine this photo angle for stronger listing clarity (pass ${position + 1}).`;
  usedFeedback.add(fallback.toLowerCase());
  return fallback;
}

function renderPhotoTiles(photos = [], limit = 4) {
  const selected = photos.filter((photo) => photo?.imageUrl).slice(0, limit);
  if (!selected.length) {
    return `<div class="empty-card">Upload listing photos to activate scored gallery recommendations.</div>`;
  }

  const usedFeedback = new Set();
  const feedbackValues = [];
  const cards = selected
    .map((photo, index) => {
      const quality = classifyPhotoQuality(photo);
      const feedback = buildPhotoFeedback(photo, quality, usedFeedback, index);
      feedbackValues.push(String(feedback || '').toLowerCase());
      const scoreLabel = Number.isFinite(Number(photo?.score))
        ? `${Math.round(Number(photo.score))}/100`
        : '--/100';

      return `
            <figure class="photo-tile">
              <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.roomLabel || 'Property photo')}" />
              <div class="photo-tile-overlay">
                <span class="photo-overlay-chip">${escapeHtml(photo.roomLabel || 'Property photo')}</span>
                <span class="photo-overlay-chip secondary">${escapeHtml(`${quality.label} · ${scoreLabel}`)}</span>
              </div>
              <figcaption>
                <span class="photo-meta">${escapeHtml(photo.marketplaceStatus || 'Needs review for launch readiness')}</span>
                <span class="photo-feedback">${escapeHtml(feedback)}</span>
              </figcaption>
            </figure>
          `;
    })
    .join('');

  const uniqueFeedbackCount = new Set(feedbackValues).size;
  if (uniqueFeedbackCount < feedbackValues.length) {
    console.warn(`[pdf] validation_warning issue=photo_feedback_duplicate total=${feedbackValues.length} unique=${uniqueFeedbackCount}`);
  }

  return `
    <div class="photo-grid">
      ${cards}
    </div>
  `;
}

function renderProviderCards(items = []) {
  const resolvedItems = ensureProviderRecommendations(items);

  return `
    <div class="provider-grid">
      ${resolvedItems
        .map(
          (provider) => `
            <article class="provider-card">
              <div class="provider-card-head">
                <div class="provider-icon">${escapeHtml(getProviderIconLabel(provider.categoryLabel || 'Provider'))}</div>
                <div>
                  <div class="provider-category">${escapeHtml(provider.categoryLabel || 'Provider')}</div>
                  <h4>${escapeHtml(provider.businessName || 'Provider recommendation')}</h4>
                </div>
              </div>
              <p class="provider-reason">${escapeHtml(provider.reason || provider.coverageLabel || '')}</p>
              <div class="provider-meta">
                ${provider.sourceLabel ? `<span>${escapeHtml(provider.sourceLabel)}</span>` : ''}
                ${provider.coverageLabel ? `<span>${escapeHtml(provider.coverageLabel)}</span>` : ''}
                ${provider.turnaroundLabel ? `<span>${escapeHtml(provider.turnaroundLabel)}</span>` : ''}
                ${provider.pricingSummary ? `<span>${escapeHtml(provider.pricingSummary)}</span>` : ''}
                ${provider.confidenceNote ? `<span>${escapeHtml(provider.confidenceNote)}</span>` : ''}
              </div>
              <div class="provider-contact">
                ${provider.phone ? `<span>${escapeHtml(provider.phone)}</span>` : ''}
                ${provider.email ? `<span>${escapeHtml(provider.email)}</span>` : ''}
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderCompRows(comps = []) {
  if (!comps.length) {
    return '';
  }

  const comparableRows = comps.slice(0, 6);
  const pricePerSqftValues = comparableRows
    .map((comp) => {
      const price = Number(comp.price || 0);
      const sqft = Number(comp.sqft || 0);
      return price > 0 && sqft > 0 ? price / sqft : null;
    })
    .filter((value) => Number.isFinite(value));
  const medianPrice = comparableRows
    .map((comp) => Number(comp.price || 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const medianPriceValue = medianPrice.length ? medianPrice[Math.floor(medianPrice.length / 2)] : null;
  const medianPpsf = pricePerSqftValues.length
    ? pricePerSqftValues.sort((left, right) => left - right)[Math.floor(pricePerSqftValues.length / 2)]
    : null;
  const closestComp = comparableRows
    .map((comp) => ({ ...comp, _distance: Number(comp.distanceMiles || Number.POSITIVE_INFINITY) }))
    .sort((left, right) => left._distance - right._distance)[0];

  return `
    <div class="comp-summary-row">
      ${medianPriceValue ? `<div class="badge">Median comp price ${escapeHtml(formatCurrency(medianPriceValue))}</div>` : ''}
      ${medianPpsf ? `<div class="badge">Median ${escapeHtml(formatCurrency(Math.round(medianPpsf)))}/sqft</div>` : ''}
      ${closestComp?._distance && Number.isFinite(closestComp._distance) ? `<div class="badge">Closest comp ${escapeHtml(formatDistanceMiles(closestComp._distance))}</div>` : ''}
      <div class="badge">${escapeHtml(`${comparableRows.length} selected comps`)}</div>
    </div>
    <div class="comp-table">
      <div class="comp-table-head">
        <span>Comp</span>
        <span>Price</span>
        <span>Details</span>
        <span>Distance</span>
      </div>
      ${comparableRows
        .map(
          (comp, index) => `
            <div class="comp-row ${index % 2 === 1 ? 'comp-row-alt' : ''}">
              <div>
                <strong>${String.fromCharCode(65 + index)}. ${escapeHtml(comp.address || 'Comparable property')}</strong>
                <div class="muted">${escapeHtml(comp.soldDate || comp.listedDate || 'Recent nearby comparable')}</div>
              </div>
              <div><strong>${escapeHtml(formatCurrency(comp.price || 0))}</strong></div>
              <div class="muted">${escapeHtml(
                pickMeaningfulLines([
                  `${comp.beds || ''} bd`,
                  `${comp.baths || ''} ba`,
                  formatSqftValue(comp.sqft),
                  Number(comp.price || 0) > 0 && Number(comp.sqft || 0) > 0
                    ? `${formatCurrency(Math.round(Number(comp.price) / Number(comp.sqft)))}/sqft`
                    : '',
                ]).join(' • '),
              )}</div>
              <div class="muted"><strong>${escapeHtml(formatDistanceMiles(comp.distanceMiles) || 'Local')}</strong></div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderFooter(pageLabel) {
  return `
    <footer class="page-footer">
      <div>
        <strong>Workside Home Advisor</strong><br/>
        ${escapeHtml(PUBLIC_WEB_URL)}
      </div>
      <div>
        ${escapeHtml(SUPPORT_EMAIL)}<br/>
        ${escapeHtml(pageLabel)}
      </div>
    </footer>
  `;
}

function buildDefaultLaunchChecklist({ checklistSummary, photoSummary, improvementItems = [], hasSelectedPrice }) {
  const steps = [];
  if (Number(photoSummary?.retakeCount || 0) > 0) {
    steps.push('Complete the highest-priority photo retakes.');
  }
  if (Number(checklistSummary?.openCount || 0) > 0) {
    steps.push('Finish the remaining open checklist items.');
  }
  if (improvementItems[0]) {
    steps.push(`Address the top preparation issue: ${improvementItems[0]}.`);
  }
  steps.push(hasSelectedPrice ? 'Confirm the selected launch price and buyer-facing positioning.' : 'Review pricing and confirm the launch position.');
  steps.push('Prepare the brochure, report, and showing assets for launch.');
  return steps.slice(0, 5);
}

function buildNeighborhoodContext(property) {
  const city = property?.city ? titleCaseLabel(property.city) : 'the surrounding area';
  return [
    `${city} location supports practical daily convenience, nearby services, and smoother showing conversations.`,
    'Neighborhood context reinforces livability, arrival comfort, and long-term value positioning.',
  ].join(' ');
}

function shortenNarrative(value, maxSentences = 2) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return sentences.slice(0, maxSentences).join(' ');
}

function buildInsightSentences(value, fallback = []) {
  const text = String(value || '').trim();
  const sentenceParts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  return pickMeaningfulLines([...sentenceParts, ...fallback], 4);
}

function renderHtmlDocument({ title, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: Letter; margin: 0; }
      :root {
        color-scheme: light;
        --ink: #1d2a2f;
        --muted: #5e6d6b;
        --line: #d8d6cc;
        --card: #fffdfa;
        --soft: #f6f3ea;
        --brand-blue: #2f5f8f;
        --brand-blue-soft: #dbe8f4;
        --accent: #c87447;
        --accent-soft: #f2d6c2;
        --moss: #4f7b62;
        --moss-soft: #dce8df;
        --risk: #b06254;
        --risk-soft: #f4dfda;
        --layout-gap: 18px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Aptos", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: #f4efe5;
        white-space: normal;
        word-break: keep-all;
        overflow-wrap: normal;
        hyphens: none;
        line-height: 1.62;
      }
      p, span, div, li, strong, h1, h2, h3, h4 { white-space: normal; word-break: keep-all; overflow-wrap: normal; hyphens: none; }
      p { max-width: 72ch; }
      .page {
        width: 8.5in;
        min-height: 11in;
        padding: 0.58in 0.58in 0.78in;
        background:
          radial-gradient(circle at top right, rgba(200,116,71,0.12), transparent 36%),
          linear-gradient(180deg, #fffdf8 0%, #f8f4ea 100%);
        position: relative;
        page-break-after: always;
      }
      .page:last-child { page-break-after: auto; }
      .hero-page { display: grid; gap: 18px; }
      .brand-kicker {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 10px;
        color: var(--moss);
        white-space: nowrap;
      }
      .section-kicker {
        letter-spacing: 0.08em;
        font-size: 10px;
        color: var(--moss);
        white-space: nowrap;
        font-weight: 700;
      }
      h1, h2, h3, h4, p { margin: 0; }
      h1 { font-family: Georgia, "Times New Roman", serif; font-size: 40px; line-height: 1.02; margin-top: 10px; letter-spacing: -0.015em; }
      h2 { font-family: Georgia, "Times New Roman", serif; font-size: 29px; line-height: 1.12; margin-bottom: 10px; letter-spacing: -0.01em; }
      h3 { font-size: 20px; margin-bottom: 10px; font-weight: 700; }
      h4 { font-size: 15px; margin-bottom: 6px; }
      .lede { font-size: 15px; line-height: 1.66; color: var(--muted); max-width: 72ch; }
      .muted { color: var(--muted); font-size: 13px; line-height: 1.6; max-width: 72ch; }
      .hero-photo, .map-frame {
        width: 100%;
        border-radius: 22px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: #f3efe4;
      }
      .hero-photo img, .map-frame img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }
      .hero-photo { min-height: 280px; }
      .map-frame { min-height: 280px; }
      .layout-grid-12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--layout-gap); align-items: start; }
      .col-span-4 { grid-column: span 4; }
      .col-span-5 { grid-column: span 5; }
      .col-span-6 { grid-column: span 6; }
      .col-span-7 { grid-column: span 7; }
      .col-span-8 { grid-column: span 8; }
      .col-span-12 { grid-column: span 12; }
      .summary-grid, .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .metric-card, .content-card, .sidebar-card, .provider-card, .feature-pill, .empty-card {
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.92);
        border-radius: 16px;
        box-shadow: 0 6px 14px rgba(16,24,32,0.04);
      }
      .metric-card, .feature-pill, .empty-card, .cta-band, .hero-photo, .map-frame,
      .photo-grid, .gallery-strip, .summary-grid, .metric-grid, .marketing-cover-grid, .marketing-metrics {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .content-card, .sidebar-card, .provider-card, .action-card, .action-group, .action-card-grid,
      .two-col, .dense-two-col, .summary-shell, .flyer-context-grid, .section-stack {
        break-inside: auto;
        page-break-inside: auto;
      }
      .metric-card { padding: 16px 18px; }
      .metric-card-ready { border-color: rgba(79,123,98,0.35); background: rgba(244,251,246,0.96); }
      .metric-card-almost { border-color: rgba(200,116,71,0.35); background: rgba(255,249,243,0.97); }
      .metric-card-needs-work { border-color: rgba(176,108,99,0.34); background: rgba(255,246,245,0.97); }
      .metric-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; white-space: nowrap; }
      .metric-value { font-size: 24px; font-weight: 700; white-space: nowrap; }
      .metric-value-wrap { white-space: normal; overflow-wrap: anywhere; line-height: 1.2; font-size: 19px; }
      .metric-support { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.4; }
      .section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 18px; }
      .content-card, .sidebar-card { padding: 20px 22px; display: grid; gap: 12px; }
      .section-stack { display: flex; flex-direction: column; gap: 20px; }
      .bullet-list { margin: 10px 0 0; padding-left: 18px; }
      .bullet-list li { margin: 0 0 8px; color: var(--muted); line-height: 1.56; }
      .feature-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .feature-pill { padding: 10px 12px; font-size: 12px; color: var(--ink); background: rgba(255,255,255,0.78); }
      .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .photo-tile { margin: 0; border: 1px solid var(--line); background: rgba(255,255,255,0.92); border-radius: 16px; overflow: hidden; position: relative; box-shadow: 0 8px 16px rgba(19,32,43,0.06); }
      .photo-tile img { width: 100%; height: 220px; display: block; object-fit: cover; }
      .photo-tile-overlay { position: absolute; top: 10px; left: 10px; display: grid; gap: 6px; align-items: start; justify-items: start; }
      .photo-overlay-chip { display: inline-block; padding: 5px 10px; border-radius: 999px; background: rgba(15,23,42,0.78); color: #fff; font-size: 10px; font-weight: 700; line-height: 1.2; }
      .photo-overlay-chip.secondary { background: rgba(47,95,143,0.88); }
      .photo-quality-badge { display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff; }
      .photo-quality-retake { background: rgba(176,98,84,0.92); }
      .photo-quality-usable { background: rgba(170,120,36,0.9); }
      .photo-quality-strong { background: rgba(61,120,88,0.9); }
      .photo-tile figcaption { padding: 12px 14px 14px; display: grid; gap: 6px; }
      .photo-tile figcaption span { font-size: 12px; color: var(--muted); }
      .photo-meta { font-size: 11px; color: #6f7c7a; }
      .photo-feedback { font-size: 12px; color: var(--ink); line-height: 1.45; }
      .priority-legend { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
      .priority-legend-label { font-size: 11px; color: var(--muted); font-weight: 700; }
      .priority-badge { padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .priority-badge-p1 { background: var(--risk-soft); color: #8f4d41; border: 1px solid rgba(176,98,84,0.28); }
      .priority-badge-p2 { background: rgba(245,158,11,0.16); color: #9a6808; border: 1px solid rgba(245,158,11,0.28); }
      .priority-badge-p3 { background: var(--moss-soft); color: var(--moss); border: 1px solid rgba(79,123,98,0.24); }
      .action-category-stack { display: grid; gap: 16px; }
      .action-group { display: grid; gap: 10px; }
      .action-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
      .action-card { border: 1px solid var(--line); border-left-width: 3px; border-radius: 16px; background: rgba(255,255,255,0.95); padding: 16px 18px; box-shadow: 0 8px 16px rgba(16,24,32,0.04); }
      .action-card-p1 { border-left-color: #c86a5b; }
      .action-card-p2 { border-left-color: #d49a2b; }
      .action-card-p3 { border-left-color: #5a8b70; }
      .action-card-head { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
      .action-card-head h4 { margin: 0; font-size: 15px; line-height: 1.3; }
      .action-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 8px; font-size: 11px; color: var(--muted); }
      .action-impact, .action-why { margin-top: 8px; font-size: 12px; line-height: 1.5; color: var(--ink); }
      .action-cta-pill { display: inline-block; margin-top: 10px; padding: 7px 10px; border-radius: 999px; background: rgba(47,95,143,0.12); border: 1px solid rgba(47,95,143,0.2); color: var(--brand-blue); font-size: 11px; font-weight: 700; }
      .dashboard-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .roi-hero-card { border: 1px solid rgba(79,123,98,0.28); border-radius: 20px; padding: 18px 20px; background: linear-gradient(135deg, rgba(79,123,98,0.12), rgba(47,95,143,0.08)); }
      .roi-hero-value { font-size: 56px; line-height: 0.98; font-weight: 800; color: #2f6a4e; margin-top: 8px; letter-spacing: -0.02em; }
      .roi-hero-sub { margin-top: 6px; font-size: 12px; color: var(--muted); }
      .roi-hero-compare { margin-top: 8px; display: inline-block; padding: 8px 12px; border-radius: 999px; background: rgba(47,95,143,0.14); border: 1px solid rgba(47,95,143,0.24); color: #1e4e79; font-size: 14px; font-weight: 800; }
      .roi-bar-shell { margin-top: 12px; display: grid; gap: 8px; }
      .roi-bar { height: 10px; border-radius: 999px; background: rgba(47,95,143,0.12); overflow: hidden; }
      .roi-bar-fill-upside { height: 100%; background: linear-gradient(90deg, rgba(79,123,98,0.72), rgba(47,95,143,0.88)); }
      .roi-bar-fill-cost { height: 100%; background: linear-gradient(90deg, rgba(176,98,84,0.62), rgba(200,116,71,0.78)); }
      .quick-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .provider-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .provider-card { padding: 16px; }
      .provider-card-head { display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: start; }
      .provider-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(47,95,143,0.12); color: var(--brand-blue); font-size: 12px; font-weight: 800; border: 1px solid rgba(47,95,143,0.18); }
      .provider-category { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; white-space: nowrap; }
      .provider-reason { font-size: 13px; color: var(--muted); line-height: 1.5; min-height: 54px; }
      .provider-meta, .provider-contact { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 10px; font-size: 12px; color: var(--muted); }
      .comp-table { display: grid; gap: 10px; }
      .comp-summary-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
      .comp-table-head, .comp-row { display: grid; grid-template-columns: minmax(250px, 1.6fr) minmax(96px, 0.75fr) minmax(150px, 1fr) minmax(96px, 0.75fr); gap: 14px; align-items: start; }
      .comp-table-head { padding: 0 4px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); }
      .comp-row { border: 1px solid var(--line); background: rgba(255,255,255,0.88); border-radius: 18px; padding: 14px 16px; }
      .comp-row-alt { background: rgba(252,250,245,0.95); }
      .page-footer {
        position: absolute;
        left: 0.58in;
        right: 0.58in;
        bottom: 0.34in;
        padding-top: 12px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        gap: 20px;
        font-size: 11px;
        color: var(--muted);
      }
      .brand-bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 14px; break-after: avoid-page; page-break-after: avoid; }
      .empty-card { padding: 18px; color: var(--muted); font-size: 13px; }
      .cta-band {
        margin-top: 18px;
        padding: 18px 20px;
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(200,116,71,0.14), rgba(79,123,98,0.08));
        border: 1px solid rgba(200,116,71,0.24);
      }
      .cta-label {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent);
        background: rgba(200,116,71,0.12);
        margin-bottom: 10px;
      }
      .single-column { display: grid; gap: 18px; }
      .marketing-cover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-top: 24px; align-items: start; }
      .marketing-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .action-card {
        margin-top: 14px;
        padding: 18px 20px;
        border-radius: 18px;
        border: 1px solid rgba(79,123,98,0.2);
        background: rgba(255,255,255,0.9);
      }
      .gallery-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
      .gallery-strip img { width: 100%; height: 220px; object-fit: cover; display: block; border-radius: 16px; border: 1px solid var(--line); }
      .gallery-strip-polished { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .gallery-strip-mosaic {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-auto-rows: 86px;
        gap: 10px;
      }
      .gallery-item { margin: 0; position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); box-shadow: 0 8px 16px rgba(19,32,43,0.06); background: rgba(255,255,255,0.95); }
      .gallery-item img { width: 100%; height: 220px; object-fit: cover; display: block; border-radius: 0; border: 0; }
      .gallery-strip-mosaic .gallery-item img { height: 100%; }
      .gallery-item-large { grid-column: 1 / span 3; grid-row: 1 / span 3; }
      .gallery-item-medium-a { grid-column: 4 / span 3; grid-row: 1 / span 2; }
      .gallery-item-medium-b { grid-column: 4 / span 2; grid-row: 3 / span 1; }
      .gallery-item-small-a { grid-column: 6 / span 1; grid-row: 3 / span 1; }
      .gallery-item-small-b { grid-column: 1 / span 3; grid-row: 4 / span 1; }
      .gallery-item-small-c { grid-column: 4 / span 3; grid-row: 4 / span 1; }
      @media (max-width: 900px) {
        .gallery-strip-mosaic { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 160px; }
        .gallery-item-large, .gallery-item-medium-a, .gallery-item-medium-b, .gallery-item-small-a, .gallery-item-small-b, .gallery-item-small-c {
          grid-column: auto;
          grid-row: auto;
        }
      }
      .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; break-inside: auto; page-break-inside: auto; }
      .map-frame.compact { min-height: 240px; }
      .flyer-context-grid { min-height: auto; align-content: start; align-items: start; }
      .badge-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .badge { padding: 8px 12px; border-radius: 999px; background: var(--moss-soft); color: var(--moss); font-size: 12px; font-weight: 600; white-space: nowrap; }
      .badge-address, .badge-contact { white-space: normal; line-height: 1.4; }
      .kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 22px; }
      .executive-summary-shell { display: grid; gap: 18px; margin-top: 18px; }
      .executive-callouts { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .callout-chip { border: 1px solid var(--line); background: rgba(255,255,255,0.9); border-radius: 18px; padding: 14px 16px; }
      .callout-chip-opportunity { border-color: rgba(79,123,98,0.24); background: rgba(244,251,246,0.96); }
      .callout-chip-risk { border-color: rgba(176,98,84,0.26); background: rgba(255,246,245,0.96); }
      .callout-chip-value { border-color: rgba(47,95,143,0.2); background: rgba(244,248,252,0.96); }
      .callout-chip strong { display: block; margin-top: 6px; font-size: 14px; }
      .fact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .fact-row { border: 1px solid var(--line); background: rgba(255,255,255,0.9); border-radius: 16px; padding: 12px 14px; }
      .fact-row-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 6px; white-space: nowrap; }
      .section-intro { margin-top: 6px; max-width: 6.2in; }
      .cover-price-badge { display: inline-flex; align-items: center; gap: 10px; margin-top: 16px; padding: 10px 14px; border-radius: 999px; background: rgba(79,123,98,0.14); color: var(--moss); font-weight: 700; }
      .marketing-hero-copy { display: grid; gap: 14px; }
      .brochure-bottom-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
      .highlight-list li { margin-bottom: 10px; }
      .gallery-strip.two-up { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .compact-copy { font-size: 12px; line-height: 1.58; color: var(--muted); max-width: 72ch; }
      .brochure-main-grid, .brochure-conversion-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--layout-gap); align-items: start; }
      .brochure-main-grid > .content-card, .brochure-main-grid > .brochure-cta-card, .brochure-conversion-grid > .content-card, .brochure-conversion-grid > .brochure-cta-card { margin: 0; }
      .page-spacer { height: 10px; }
      .insight-list { display: grid; gap: 10px; margin-top: 10px; }
      .insight-row { display: grid; grid-template-columns: 12px 1fr; gap: 10px; align-items: start; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.72); border: 1px solid rgba(79,123,98,0.14); }
      .insight-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--moss); margin-top: 6px; }
      .checklist-ui { display: grid; gap: 12px; margin-top: 10px; }
      .checklist-item { display: grid; grid-template-columns: 34px 1fr; gap: 12px; align-items: start; padding: 12px 14px; border-radius: 16px; border: 1px solid var(--line); background: rgba(255,255,255,0.88); }
      .checklist-index { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(79,123,98,0.14); color: var(--moss); font-weight: 700; }
      .checklist-copy { font-size: 14px; line-height: 1.5; }
      .highlight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .highlight-card { display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: start; padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(79,123,98,0.16); background: rgba(255,255,255,0.92); }
      .highlight-index { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(200,116,71,0.14); color: var(--accent); font-weight: 800; }
      .highlight-copy { font-size: 14px; line-height: 1.5; color: var(--ink); }
      .feature-icon-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-top: 12px; }
      .feature-icon-card { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: start; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(47,95,143,0.14); background: rgba(244,248,252,0.96); box-shadow: 0 6px 14px rgba(19,32,43,0.04); }
      .feature-icon-badge { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(135deg, rgba(47,95,143,0.14), rgba(200,116,71,0.14)); color: var(--brand-blue); font-size: 14px; font-weight: 800; }
      .feature-icon-copy { font-size: 13px; line-height: 1.42; color: var(--ink); font-weight: 600; }
      .hero-signal-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .hero-signal-chip { padding: 10px 12px; border-radius: 14px; font-size: 12px; line-height: 1.45; font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
      .hero-signal-chip-blue { background: var(--brand-blue-soft); color: var(--brand-blue); border-color: rgba(47,95,143,0.18); }
      .hero-signal-chip-green { background: var(--moss-soft); color: var(--moss); border-color: rgba(79,123,98,0.18); }
      .hero-signal-chip-orange { background: var(--accent-soft); color: #9a5a33; border-color: rgba(200,116,71,0.18); }
      .preview-urgency { margin-top: 8px; font-size: 12px; font-weight: 700; color: #9a5a33; }
      .suggested-category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .suggested-category-card { padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(47,95,143,0.16); background: rgba(244,248,252,0.96); }
      .suggested-category-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--brand-blue); margin-bottom: 8px; }
      .seller-cover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: stretch; }
      .seller-cover-row-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
      .cover-right-stack { display: grid; gap: 10px; align-content: start; }
      .cover-photo-card { padding: 12px; }
      .score-hero { border-radius: 28px; padding: 28px 26px 24px; border: 1px solid rgba(200,116,71,0.24); background: linear-gradient(145deg, rgba(47,95,143,0.08), rgba(200,116,71,0.16) 62%, rgba(255,250,244,0.98) 100%); text-align: left; min-height: 3.3in; display: flex; flex-direction: column; justify-content: center; }
      .score-hero-value { font-size: 84px; line-height: 0.92; font-weight: 800; margin-top: 10px; letter-spacing: -0.04em; }
      .continuation-title { font-size: 22px; line-height: 1.15; margin-bottom: 8px; }
      .score-status { display: inline-flex; margin-top: 10px; padding: 8px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
      .score-status-ready { background: rgba(79,123,98,0.16); color: var(--moss); }
      .score-status-almost { background: rgba(200,116,71,0.16); color: #9a5a33; }
      .score-status-needs-work { background: rgba(176,108,99,0.16); color: #96554a; }
      .score-hero-note { margin-top: 10px; font-size: 13px; line-height: 1.48; color: var(--muted); max-width: 4.6in; }
      .compact-metric-stack { display: grid; gap: 12px; }
      .compact-metric-card { border: 1px solid var(--line); background: rgba(255,255,255,0.92); border-radius: 18px; padding: 14px 16px; min-height: 88px; }
      .compact-metric-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--moss); margin-bottom: 8px; white-space: nowrap; }
      .compact-metric-value { font-size: 28px; line-height: 1.05; font-weight: 800; white-space: nowrap; }
      .compact-metric-support { margin-top: 6px; font-size: 12px; line-height: 1.45; color: var(--muted); }
      .seller-final-band { margin-top: 16px; padding: 18px 20px; border-radius: 16px; border: 1px solid rgba(200,116,71,0.18); background: linear-gradient(135deg, rgba(47,95,143,0.06), rgba(200,116,71,0.1)); }
      .full-page-grid { display: grid; gap: 18px; align-content: start; min-height: 9.2in; }
      .summary-shell { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
      .dense-two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .recommendation-grid { display: grid; gap: 14px; }
      .comp-map-stack { display: grid; gap: 14px; }
      .comp-meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
      .action-plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
      .brochure-cover { position: relative; min-height: 5.2in; border-radius: 28px; overflow: hidden; border: 1px solid var(--line); background: linear-gradient(135deg, #304f72 0%, #203245 100%); }
      .brochure-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .brochure-cover-media-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px; }
      .brochure-cover-media-grid img { position: relative; width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
      .brochure-cover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(16,24,32,0.08) 0%, rgba(30,57,84,0.40) 30%, rgba(16,24,32,0.72) 68%, rgba(16,24,32,0.9) 100%); }
      .brochure-cover-overlay { position: relative; z-index: 1; min-height: 5.2in; padding: 30px 30px 26px; color: #ffffff; display: flex; flex-direction: column; justify-content: flex-end; }
      .brochure-cover-overlay .brand-kicker { color: rgba(255,255,255,0.78); }
      .brochure-cover-overlay h1 { color: #ffffff; font-size: 52px; line-height: 0.98; max-width: 6.2in; text-shadow: 0 10px 24px rgba(0,0,0,0.18); }
      .brochure-cover-overlay .lede { color: rgba(255,255,255,0.88); max-width: 5.4in; }
      .brochure-price { display: inline-flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 12px 18px; border-radius: 999px; background: rgba(255,255,255,0.18); color: #ffffff; border: 1px solid rgba(255,255,255,0.26); font-weight: 800; font-size: 15px; backdrop-filter: blur(3px); box-shadow: 0 12px 26px rgba(0,0,0,0.12); white-space: nowrap; }
      .brochure-cover-facts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
      .brochure-cover-fact { padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.22); font-size: 12px; color: #fff; white-space: nowrap; }
      .brochure-cover-lower { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
      .brochure-cta-card { padding: 18px 20px; border-radius: 18px; border: 1px solid rgba(200,116,71,0.24); background: rgba(255,255,255,0.92); }
      .address-line { max-width: 100%; line-height: 1.45; overflow-wrap: normal; word-break: keep-all; }
      .status-list { display: grid; gap: 10px; margin-top: 12px; }
      .status-row { display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.76); border: 1px solid rgba(47,95,143,0.12); }
      .status-icon { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(79,123,98,0.16); color: var(--moss); font-size: 14px; font-weight: 800; line-height: 1; }
      .status-copy { color: var(--ink); font-size: 13px; line-height: 1.5; }
      .confidence-scale { display: grid; gap: 10px; margin-top: 14px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(47,95,143,0.14); background: rgba(244,248,252,0.94); }
      .confidence-scale-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .confidence-track { width: 100%; height: 12px; border-radius: 999px; background: rgba(47,95,143,0.10); overflow: hidden; }
      .confidence-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, rgba(79,123,98,0.55), rgba(47,95,143,0.88)); }
      .brochure-cta-button { display: inline-block; margin-top: 12px; padding: 13px 20px; border-radius: 999px; background: var(--accent); color: #fff; font-weight: 800; font-size: 14px; box-shadow: 0 8px 14px rgba(200,116,71,0.22); }
      .brochure-cta-button.secondary { background: var(--brand-blue); }
      .cta-button-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
      .legend-note { margin-top: 10px; font-size: 11px; line-height: 1.45; color: var(--muted); }
      .marketing-gallery-card { padding: 14px 16px; }
      .closing-band { margin-top: 14px; padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(47,95,143,0.10), rgba(200,116,71,0.12)); border: 1px solid rgba(47,95,143,0.14); }
      @media (max-width: 740px) {
        .photo-grid, .dashboard-row, .quick-summary-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function buildPropertySummaryHtml({ property, report }) {
  const photoSummary = report.payload?.photoSummary || {};
  const readinessSummary = report.payload?.readinessSummary || {};
  const propertyDetails = report.payload?.propertyDetails || {};
  const providerRecommendations = ensureProviderRecommendations(report.payload?.providerRecommendations || []);
  const nextSteps = report.payload?.nextSteps || [];
  const riskOpportunity = report.payload?.riskOpportunity || {};
  const improvementEconomics = report.payload?.improvementEconomics || {};
  const consequenceFraming = report.payload?.consequenceFraming || {};
  const rawRecommendationItems = report.payload?.improvementGuidance?.recommendations || [];
  const recommendationActions = ensureStructuredRecommendationActions({
    structuredActions: report.payload?.recommendationActions || [],
    rawRecommendations: rawRecommendationItems,
    improvementItems: report.improvementItems || [],
  });
  const buyerPersonaSummary = report.payload?.buyerPersonaSummary || {};
  const checklistSummary = report.payload?.checklistSummary || {};
  const compMapImageUrl = report._resolvedCompMapImageUrl || buildComparableMapImageUrl(property, report.selectedComps || []);
  const heroPhoto = report.selectedPhotos?.[0];
  const remainingPhotos = (report.selectedPhotos || []).slice(1);
  const featureTags = pickMeaningfulLines(propertyDetails.featureTags || [], 6);
  const topReasonsToBuy = pickMeaningfulLines(buyerPersonaSummary.topReasonsToBuy || [], 5);
  const executiveSummaryText = hasMeaningfulValue(report.executiveSummary)
    ? report.executiveSummary
    : `${property.title || 'This property'} is currently positioned at ${readinessSummary.overallScore || 0}/100 readiness with the strongest opportunity centered on listing preparation and buyer-facing presentation.`;
  const summaryOpportunityRaw = hasMeaningfulValue(riskOpportunity.biggestOpportunity)
    ? riskOpportunity.biggestOpportunity
    : pickMeaningfulLines(report.improvementItems || [], 1)[0] || 'Strengthen buyer confidence with final prep, pricing, and presentation decisions.';
  const summaryRiskRaw = hasMeaningfulValue(riskOpportunity.biggestRisk)
    ? riskOpportunity.biggestRisk
    : Number(photoSummary.retakeCount || 0) > 0
      ? 'Photo quality upgrades should be completed before listing launch.'
      : 'No single launch risk currently dominates the report.';
  const retakeCount = Number(photoSummary.retakeCount || 0);
  const summaryRisk = retakeCount > 0
    ? `Photo quality gaps may reduce buyer click-through until ${retakeCount} priority retakes are completed.`
    : summaryRiskRaw;
  const summaryOpportunity = resolveInsightTheme(summaryRisk) === resolveInsightTheme(summaryOpportunityRaw)
    ? retakeCount > 0
      ? 'Completing the priority photo retakes can improve engagement and qualified showing requests.'
      : 'Closing the highest-priority preparation actions can improve launch momentum and buyer confidence.'
    : summaryOpportunityRaw;
  const economicsSummary = hasMeaningfulValue(improvementEconomics.summary)
    ? improvementEconomics.summary
    : pickMeaningfulLines([
        improvementEconomics.estimatedCost ? `Estimated prep investment ${formatCurrency(improvementEconomics.estimatedCost)}.` : '',
        improvementEconomics.estimatedRoi ? `Potential value protection ${formatCurrency(improvementEconomics.estimatedRoi)}.` : '',
      ], 2).join(' ');
  const pricingNarrative = hasMeaningfulValue(report.pricingSummary?.narrative)
    ? report.pricingSummary.narrative
    : 'Pricing guidance is based on the latest comparable sales, home condition, and current market readiness signals.';
  const marketingMomentum = pickMeaningfulLines(report.marketingHighlights || [], 4);
  const orderedNextSteps = nextSteps.length
    ? nextSteps.map((step) => `${step.title}${step.eta ? ` · ${step.eta}` : ''}${step.owner ? ` · ${step.owner}` : ''}`)
    : recommendationActions.length
      ? recommendationActions.map(
          (action) =>
            `${action.title}${action.urgency ? ` · ${titleCaseLabel(action.urgency)} urgency` : ''}`,
        )
      : buildDefaultLaunchChecklist({
          checklistSummary,
          photoSummary,
          improvementItems: report.improvementItems || [],
          hasSelectedPrice: Boolean(property?.selectedListPrice),
        });
  const propertyFacts = [
    { label: 'Address', value: buildPropertyAddress(property) },
    { label: 'Home type', value: formatPropertyTypeLabel(property?.propertyType) },
    { label: 'Bedrooms', value: hasMeaningfulValue(propertyDetails.bedrooms || property?.bedrooms) ? String(propertyDetails.bedrooms || property?.bedrooms) : '' },
    { label: 'Bathrooms', value: hasMeaningfulValue(propertyDetails.bathrooms || property?.bathrooms) ? String(propertyDetails.bathrooms || property?.bathrooms) : '' },
    { label: 'Interior', value: formatSqftValue(propertyDetails.squareFeet || property?.squareFeet) },
    { label: 'Lot size', value: formatSqftValue(propertyDetails.lotSizeSqFt || property?.lotSizeSqFt) },
    { label: 'Year built', value: hasMeaningfulValue(propertyDetails.yearBuilt || property?.yearBuilt) ? String(propertyDetails.yearBuilt || property?.yearBuilt) : '' },
  ].filter((fact) => hasMeaningfulValue(fact.value));
  const shouldRenderCompMap = Boolean(compMapImageUrl && (report.selectedComps || []).length);
  const shouldRenderProviders = providerRecommendations.length > 0;
  const shouldRenderBuyerPersona = hasMeaningfulValue(buyerPersonaSummary.buyerPersona) || topReasonsToBuy.length > 0;
  const compStats = summarizeComparableSet(report.selectedComps || []);
  const coverNarrative = shortenNarrative(executiveSummaryText, 1);
  const pricingInsightLines = pickMeaningfulLines([
    shortenNarrative(report.pricingSummary?.strategy, 1),
    ...(report.pricingSummary?.strengths || []),
    hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? `Opportunity: ${riskOpportunity.biggestOpportunity}` : '',
    ...buildComparableInsights({
      comps: report.selectedComps || [],
      selectedListPrice: property?.selectedListPrice,
      pricingConfidence: report.pricingSummary?.confidence,
    }),
  ], 4);
  const coverPricingSignal = property?.selectedListPrice
    ? `Pricing signal: positioned at ${formatCurrency(property.selectedListPrice)}.`
    : '';
  const coverKeyInsight = Number(photoSummary.retakeCount || 0) > 0
    ? `Key insight: ${retakeCount} priority photo retakes are still required before launch.`
    : `${checklistSummary.openCount || 0} checklist items still need closure before launch.`;
  const executiveSummaryBulletPool = pickMeaningfulLines([
    coverNarrative,
    coverPricingSignal,
    coverKeyInsight,
    hasMeaningfulValue(report.payload?.listingDescriptions?.shortDescription)
      ? report.payload.listingDescriptions.shortDescription
      : '',
    summaryOpportunity,
  ], 5);
  const {
    primary: executiveSummaryBullets,
    overflow: executiveSummaryOverflowBullets,
  } = splitPrimaryAndOverflow(executiveSummaryBulletPool, 3);
  const pricingRationaleBullets = pickMeaningfulLines([
    report.pricingSummary?.strategy,
    ...(report.pricingSummary?.strengths || []),
    hasMeaningfulValue(report.pricingSummary?.confidence)
      ? `${Math.round(report.pricingSummary.confidence * 100)}% pricing confidence based on the selected comparable set.`
      : '',
    medianCompSummary(report.selectedComps || []),
    pricingNarrative,
  ], 5);
  const readinessTone = getReadinessTone({ score: readinessSummary.overallScore, label: readinessSummary.label });
  const suggestedProviderCategories = pickMeaningfulLines([
    photoSummary.retakeCount || photoSummary.roomCoverageCount < 5 ? 'Professional photography' : '',
    Number(checklistSummary.openCount || 0) > 0 ? 'Cleaning and prep support' : '',
    hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? 'Staging or presentation support' : '',
  ], 3);
  const summaryRecommendationPool = dedupeInsightsByTheme(pickMeaningfulLines([
    report.payload?.improvementGuidance?.summary,
    ...recommendationActions.map((action) => action.title),
    ...(report.improvementItems || []).slice(0, 3),
    pricingNarrative,
  ], 9), 7);
  const {
    primary: summaryRecommendations,
    overflow: summaryRecommendationsOverflow,
  } = splitPrimaryAndOverflow(summaryRecommendationPool, 4);
  const recommendationActionLines = pickMeaningfulLines(
    recommendationActions.map(
      (action) =>
        `${action.title}${action.urgency ? ` (${titleCaseLabel(action.urgency)} urgency)` : ''}${action.expectedOutcome ? ` - ${action.expectedOutcome}` : ''}`,
    ),
    8,
  );
  const sortedRecommendationActions = sortRecommendationActions(recommendationActions);
  const topThreeActions = sortedRecommendationActions.slice(0, 3);
  const topThreeActionLines = pickMeaningfulLines(
    topThreeActions.map((action) => {
      const priorityMeta = resolvePriorityMeta(action.urgency);
      return `${priorityMeta.shortLabel} · ${action.title}`;
    }),
    3,
  );
  const topThreeIssues = dedupeInsightsByTheme(pickMeaningfulLines([
    summaryRisk,
    ...(consequenceFraming.lines || []),
    checklistSummary.openCount ? `${checklistSummary.openCount} checklist items still open.` : '',
  ], 6), 3);
  const launchStatusHighlightPool = dedupeInsightsByTheme(pickMeaningfulLines([
    photoSummary.averageQualityScore ? `Average photo quality ${photoSummary.averageQualityScore}/100.` : '',
    checklistSummary.totalCount ? `${checklistSummary.completedCount || 0} of ${checklistSummary.totalCount} checklist items are complete.` : '',
    property?.selectedListPrice ? `Chosen list price ${formatCurrency(property.selectedListPrice)}.` : '',
    pricingInsightLines[0] || '',
    consequenceFraming.summary || '',
    summaryOpportunity,
  ], 8), 6);
  const {
    primary: launchStatusHighlights,
    overflow: launchStatusHighlightsOverflow,
  } = splitPrimaryAndOverflow(launchStatusHighlightPool, 4);
  const {
    primary: orderedNextStepsPrimary,
    overflow: orderedNextStepsOverflow,
  } = splitPrimaryAndOverflow(orderedNextSteps, 3);
  const actionCardsPrimary = sortedRecommendationActions.slice(0, 2);
  const actionCardsOverflow = sortedRecommendationActions.slice(2, 6);
  const readinessRiskOpportunity = deriveReadinessRiskOpportunity({
    photoSummary,
    checklistSummary,
    summaryRisk,
    summaryOpportunity,
    pricingInsightLines,
  });
  const readinessRiskHeadline = readinessRiskOpportunity.risk;
  const readinessOpportunityHeadline = readinessRiskOpportunity.opportunity;
  const readinessContinuationInsights = pickMeaningfulLines([
    ...topThreeIssues,
    ...recommendationActionLines,
    ...orderedNextStepsOverflow,
  ], 8);
  const {
    primary: readinessContinuationInsightsPrimary,
    overflow: readinessContinuationInsightsOverflow,
  } = splitPrimaryAndOverflow(readinessContinuationInsights, 4);
  const hasExecutiveSummaryContinuation = Boolean(
    executiveSummaryOverflowBullets.length ||
      summaryRecommendationsOverflow.length ||
      launchStatusHighlightsOverflow.length,
  );
  const hasReadinessContinuation = Boolean(
    orderedNextStepsOverflow.length ||
      actionCardsOverflow.length ||
      readinessContinuationInsightsOverflow.length,
  );
  const executiveContinuationUnitCount =
    executiveSummaryOverflowBullets.length +
    summaryRecommendationsOverflow.length +
    launchStatusHighlightsOverflow.length;
  const readinessContinuationUnitCount =
    orderedNextStepsOverflow.length +
    actionCardsOverflow.length +
    readinessContinuationInsightsPrimary.length +
    readinessContinuationInsightsOverflow.length;
  const shouldRenderExecutiveContinuation =
    hasExecutiveSummaryContinuation && executiveContinuationUnitCount >= 7;
  const shouldRenderReadinessContinuation = false;
  const dedupeActionCards = (actions = []) => {
    const seen = new Set();
    const deduped = [];
    for (const action of actions || []) {
      const key = String(action?.title || '').toLowerCase().trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(action);
    }
    return deduped;
  };
  const executiveSummaryDisplayBullets = shouldRenderExecutiveContinuation
    ? executiveSummaryBullets
    : pickMeaningfulLines([...executiveSummaryBullets, ...executiveSummaryOverflowBullets], 4);
  const summaryRecommendationsDisplay = shouldRenderExecutiveContinuation
    ? summaryRecommendations
    : dedupeInsightsByTheme([...summaryRecommendations, ...summaryRecommendationsOverflow], 4);
  const launchStatusHighlightsDisplay = shouldRenderExecutiveContinuation
    ? launchStatusHighlights
    : dedupeInsightsByTheme([...launchStatusHighlights, ...launchStatusHighlightsOverflow], 3);
  const orderedNextStepsDisplay = shouldRenderReadinessContinuation
    ? orderedNextStepsPrimary
    : pickMeaningfulLines([...orderedNextStepsPrimary, ...orderedNextStepsOverflow], 4);
  const actionCardsDisplay = shouldRenderReadinessContinuation
    ? actionCardsPrimary
    : dedupeActionCards([...actionCardsPrimary, ...actionCardsOverflow]).slice(0, 4);
  const supportProviderRecommendations = providerRecommendations.slice(0, 2);
  const supportSuggestedProviderCategories = suggestedProviderCategories.slice(0, 3);
  const roiUpside = Number(improvementEconomics.estimatedRoi || 0);
  const roiCost = Number(improvementEconomics.estimatedCost || 0);
  const roiMax = Math.max(roiUpside, roiCost, 1);
  const roiUpsideWidth = Math.max(4, Math.round((roiUpside / roiMax) * 100));
  const roiCostWidth = Math.max(4, Math.round((roiCost / roiMax) * 100));
  const roiUpsideLabel = roiUpside
    ? `~${formatCurrency(roiUpside)} potential upside`
    : 'Conservative upside baseline modeled';
  const roiCostLabel = roiCost
    ? `Estimated prep cost: ${formatCurrency(roiCost)}`
    : 'Prep investment modeled from current readiness profile';
  const roiComparisonLine = roiUpside && roiCost
    ? `${formatCurrency(roiUpside)} upside vs ${formatCurrency(roiCost)} cost`
    : '';
  const pricingMetricCards = [
    renderMetricCard('Suggested range', report.pricingSummary?.low && report.pricingSummary?.high ? `${formatCurrency(report.pricingSummary.low)} - ${formatCurrency(report.pricingSummary.high)}` : 'Unavailable', report.pricingSummary?.strategy || 'Market-aligned pricing recommendation'),
    renderMetricCard('Midpoint', report.pricingSummary?.mid ? formatCurrency(report.pricingSummary.mid) : 'Unavailable', report.pricingSummary?.confidence ? `${Math.round(report.pricingSummary.confidence * 100)}% confidence` : 'Comparable signal based'),
    renderMetricCard('Chosen price', property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set', property?.selectedListPrice ? 'Seller-confirmed' : 'Set in pricing tab'),
    renderMetricCard('Selected comps', String((report.selectedComps || []).length), 'Top market references included'),
  ].join('');
  const pricingCompMetaCards = [
    report.pricingSummary?.confidence ? renderMetricCard('Confidence', `${Math.round(report.pricingSummary.confidence * 100)}%`, 'Pricing support') : '',
    compStats.medianPrice ? renderMetricCard('Median comp price', formatCurrency(compStats.medianPrice), 'Selected comp median') : '',
    compStats.medianPricePerSqft ? renderMetricCard('Median price / sqft', `${formatCurrency(Math.round(compStats.medianPricePerSqft))}`, 'Comparable density') : '',
    compStats.closestDistance ? renderMetricCard('Closest comp', formatDistanceMiles(compStats.closestDistance), 'Nearest selected comparable') : '',
  ].filter(Boolean).join('');
  const reportPrimaryCta = Number(readinessSummary.overallScore || 0) >= 70 ? 'Request Showing' : 'Get Property Details';
  const reportSecondaryCta = reportPrimaryCta === 'Request Showing' ? 'Get Property Details' : 'Request Showing';
  const contactPhoneLabel = SUPPORT_PHONE || 'Phone available on request';
  const readinessScoreLabel = `${readinessSummary.overallScore || 0}/100`;

  const rawRecommendationCount = Number(rawRecommendationItems.length || (report.improvementItems || []).length || 0);
  console.info(
    `[pdf] action_pipeline_counts propertyId=${property?.id || property?._id?.toString?.() || ''} rawRecommendations=${rawRecommendationCount} actionCards=${recommendationActions.length}`,
  );
  if (rawRecommendationCount > 0 && recommendationActions.length < rawRecommendationCount) {
    console.warn(
      `[pdf] action_pipeline_mismatch propertyId=${property?.id || property?._id?.toString?.() || ''} rawRecommendations=${rawRecommendationCount} actionCards=${recommendationActions.length}`,
    );
  }
  if (!recommendationActions.length) {
    console.warn(`[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=no_action_cards`);
  }
  if (!providerRecommendations.length) {
    console.warn(`[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=no_provider_section`);
  }
  if (!roiUpside && !roiCost) {
    console.warn(`[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=roi_not_visible`);
  }
  if (!['request showing', 'get property details'].includes(reportPrimaryCta.toLowerCase())) {
    console.warn(`[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=cta_not_upgraded`);
  }
  const dedupeTopIssues = new Set(topThreeIssues.map((line) => String(line || '').toLowerCase()));
  if (dedupeTopIssues.size !== topThreeIssues.length) {
    console.warn(`[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=duplicate_insights_detected`);
  }
  if (
    containsPlaceholderLanguage(summaryOpportunity) ||
    containsPlaceholderLanguage(summaryRisk) ||
    containsPlaceholderLanguage(pricingNarrative)
  ) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=placeholder_language_detected`,
    );
  }
  if (readinessScoreLabel.length > 8) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=readiness_typography_risk value=${readinessScoreLabel}`,
    );
  }
  if (
    (executiveSummaryOverflowBullets.length ||
      summaryRecommendationsOverflow.length ||
      launchStatusHighlightsOverflow.length) &&
    !shouldRenderExecutiveContinuation
  ) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=continuation_merged section=executive_summary`,
    );
  }
  if ((orderedNextStepsOverflow.length || actionCardsOverflow.length) && !shouldRenderReadinessContinuation) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=continuation_merged section=readiness_dashboard`,
    );
  }
  if (shouldRenderExecutiveContinuation && executiveContinuationUnitCount < 5) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=continuation_density_low section=executive_summary items=${executiveContinuationUnitCount}`,
    );
  }
  if (shouldRenderReadinessContinuation && readinessContinuationUnitCount < 6) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=continuation_density_low section=readiness_dashboard items=${readinessContinuationUnitCount}`,
    );
  }
  if (orderedNextStepsDisplay.length > 5 || actionCardsDisplay.length > 5) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=action_plan_primary_too_long steps=${orderedNextStepsDisplay.length} cards=${actionCardsDisplay.length}`,
    );
  }

  const body = `
    <section class="page hero-page">
      <div class="seller-cover-grid">
        <div>
          <div class="brand-kicker">Workside Home Advisor · Seller Intelligence Report</div>
          <h1>${escapeHtml(report.title || property.title || 'Property Summary Report')}</h1>
          <div class="score-hero">
            <div class="metric-label">Readiness score</div>
            <div class="score-hero-value">${escapeHtml(readinessScoreLabel)}</div>
            <div class="score-status score-status-${escapeHtml(readinessTone)}">${escapeHtml(readinessSummary.label || 'Needs work')}</div>
            <p class="score-hero-note">${escapeHtml(coverNarrative || 'This report turns property data into a clear launch decision and next-step sequence.')}</p>
          </div>
        </div>
        <div class="cover-right-stack">
          <div class="compact-metric-stack">
            <div class="compact-metric-card">
              <div class="compact-metric-label">Price</div>
              <div class="compact-metric-value">${escapeHtml(property?.selectedListPrice ? formatCurrency(property.selectedListPrice) : 'Not set')}</div>
              <div class="compact-metric-support">${escapeHtml(report.pricingSummary?.mid ? `Suggested midpoint ${formatCurrency(report.pricingSummary.mid)}` : 'Pricing guidance available below')}</div>
            </div>
            <div class="compact-metric-card">
              <div class="compact-metric-label">Photo coverage</div>
              <div class="compact-metric-value">${escapeHtml(`${photoSummary.roomCoverageCount || 0}/5`)}</div>
              <div class="compact-metric-support">${escapeHtml(`${photoSummary.listingCandidateCount || 0} marketplace-ready${photoSummary.savedVisionPublishableCount ? ` · ${photoSummary.savedVisionPublishableCount} publishable Vision` : ''} · photo polish tracked in gallery review`)}</div>
            </div>
            <div class="compact-metric-card">
              <div class="compact-metric-label">Checklist</div>
              <div class="compact-metric-value">${escapeHtml(`${checklistSummary.progressPercent || 0}%`)}</div>
              <div class="compact-metric-support">${escapeHtml(`${checklistSummary.completedCount || 0} complete · ${checklistSummary.openCount || 0} open`)}</div>
            </div>
          </div>
          <div class="content-card cover-photo-card">
            <div class="hero-photo">
              ${heroPhoto?.imageUrl ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Property photo')}" />` : ''}
            </div>
            <p class="muted address-line" style="margin-top:10px;">${escapeHtml(buildPropertyAddress(property))}</p>
          </div>
        </div>
      </div>
      <div class="seller-cover-row-two">
        <div class="content-card">
          <div class="section-kicker">Pricing signal</div>
          <h3>Positioning snapshot</h3>
          ${renderInsightList(
            pickMeaningfulLines([
              coverPricingSignal,
              report.pricingSummary?.mid ? `Suggested midpoint ${formatCurrency(report.pricingSummary.mid)}.` : '',
              pricingInsightLines[0] || '',
            ], 3),
            'Pricing is being positioned from the latest comparable sales and readiness signals.',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Key insight</div>
          <h3>What deserves attention first</h3>
          ${renderInsightList(
            pickMeaningfulLines([
              coverKeyInsight,
              summaryOpportunity,
              summaryRisk,
            ], 3),
            'The clearest launch insight is drawn from the current pricing, checklist, and photo signals.',
          )}
        </div>
      </div>
      ${renderFooter('Property Summary Report · Cover')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Summary</div>
          <h2>Executive summary, insights, and recommendations</h2>
          <p class="muted">A seller-facing readout of the strongest signals, risks, and next opportunities.</p>
        </div>
      </div>
      <div class="summary-shell">
        <div class="content-card">
          <div class="section-kicker">Key insights</div>
          <h3>What matters most right now</h3>
          ${renderInsightList(executiveSummaryDisplayBullets, 'Use this report to identify the clearest launch priorities.')}
          <div class="page-spacer"></div>
          <div class="callout-chip callout-chip-opportunity">
            <div class="metric-label">Top opportunity</div>
            <strong>${escapeHtml(summaryOpportunity)}</strong>
          </div>
          <div class="page-spacer"></div>
          <div class="callout-chip callout-chip-risk">
            <div class="metric-label">Top risk</div>
            <strong>${escapeHtml(summaryRisk)}</strong>
          </div>
        </div>
        <div class="recommendation-grid">
          <div class="content-card">
            <div class="section-kicker">Recommendations</div>
            <h3>Priority actions</h3>
            ${renderBulletList(summaryRecommendationsDisplay, 'Use the guided workflow to continue improving readiness and launch confidence.')}
          </div>
          <div class="callout-chip callout-chip-value">
            <div class="metric-label">Budget / ROI</div>
            <strong>${escapeHtml(economicsSummary || 'Use this report to coordinate a confident, disciplined launch.')}</strong>
          </div>
          <div class="content-card">
            <div class="section-kicker">Launch status</div>
            <h3>${escapeHtml(readinessSummary.label || 'Needs work')}</h3>
            ${renderHighlightGrid(
              launchStatusHighlightsDisplay,
              'Launch status details are reflected here from pricing, photos, and checklist progress.',
            )}
          </div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Summary')}
    </section>

    ${
      shouldRenderExecutiveContinuation
        ? `
          <section class="page">
            <div class="brand-bar">
              <div>
                <div class="section-kicker">Summary</div>
                <h2 class="continuation-title">Executive Summary (continued)</h2>
                <p class="muted">Additional summary details moved to this page to keep each section clean and fully readable.</p>
              </div>
            </div>
            <div class="dense-two-col">
              <div class="content-card">
                <div class="section-kicker">Key insights (continued)</div>
                <h3>Additional observations</h3>
                ${renderInsightList(
                  executiveSummaryOverflowBullets,
                  'Primary insights are already captured on the summary page.',
                )}
              </div>
              <div class="content-card">
                <div class="section-kicker">Recommendations (continued)</div>
                <h3>Additional action guidance</h3>
                ${renderBulletList(
                  summaryRecommendationsOverflow,
                  'Priority recommendations are already captured on the summary page.',
                )}
              </div>
            </div>
            ${
              launchStatusHighlightsOverflow.length
                ? `
                  <div class="content-card" style="margin-top:14px;">
                    <div class="section-kicker">Launch status (continued)</div>
                    <h3>Additional readiness signals</h3>
                    ${renderHighlightGrid(
                      launchStatusHighlightsOverflow,
                      'No additional launch-status detail is required.',
                    )}
                  </div>
                `
                : ''
            }
            ${renderFooter('Property Summary Report · Summary Continuation')}
          </section>
        `
        : ''
    }

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Pricing analysis</div>
          <h2>Pricing, positioning, and comparable sales</h2>
          <p class="muted">Suggested range, chosen list price, pricing narrative, and comparable market context.</p>
        </div>
      </div>
      <div class="metric-grid">
        ${pricingMetricCards}
      </div>
      <div class="content-card" style="margin-top:18px;">
        <div class="section-kicker">Pricing narrative</div>
        <h3>What supports this recommendation</h3>
        <p class="muted">${escapeHtml(pricingNarrative)}</p>
        ${renderConfidenceScale(report.pricingSummary?.confidence)}
      </div>
      <div class="dense-two-col" style="margin-top:18px;">
        <div class="sidebar-card">
          <div class="section-kicker">Pricing rationale</div>
          <h3>Comparable-based rationale</h3>
          ${renderBulletList(pricingRationaleBullets, 'Comparable sales, property condition, and launch readiness support the pricing stance shown here.')}
          <div class="page-spacer"></div>
          <div class="section-kicker">Pricing callouts</div>
          <div class="badge-row">
            ${hasMeaningfulValue(riskOpportunity.biggestRisk) ? `<div class="badge">${escapeHtml(riskOpportunity.biggestRisk)}</div>` : ''}
            ${hasMeaningfulValue(riskOpportunity.biggestOpportunity) ? `<div class="badge">${escapeHtml(riskOpportunity.biggestOpportunity)}</div>` : ''}
            ${report.pricingSummary?.confidence ? `<div class="badge">${escapeHtml(`${Math.round(report.pricingSummary.confidence * 100)}% pricing confidence`)}</div>` : ''}
          </div>
        </div>
        <div class="content-card">
          <div class="section-kicker">Comp-derived signals</div>
          <h3>What the comp set is signaling</h3>
          ${renderHighlightGrid(pricingInsightLines, 'Comparable pricing signals are summarized here from the selected sales set.')}
        </div>
      </div>
      ${pricingCompMetaCards ? `<div class="comp-meta-grid" style="margin-top:14px;">${pricingCompMetaCards}</div>` : ''}
      ${renderFooter('Property Summary Report · Pricing & Comps')}
    </section>

    ${(report.selectedComps || []).length ? `
      <section class="page">
        <div class="brand-bar">
          <div>
            <div class="section-kicker">Comparable sales</div>
            <h2>Recent nearby comps</h2>
            <p class="muted">The selected comp set and its supporting local map.</p>
          </div>
        </div>
        <div class="comp-map-stack">
        ${shouldRenderCompMap ? `
          <div class="content-card">
            <div class="section-kicker">Comp map</div>
            <div class="map-frame" style="margin-top:12px;">
              <img src="${escapeHtml(compMapImageUrl)}" alt="Comparable properties map" onerror="this.closest('.content-card').style.display='none';" />
            </div>
            <div class="legend-note">Markers use S for the subject property and A-${String.fromCharCode(64 + Math.min((report.selectedComps || []).length, 6))} for the comparable sales listed below.</div>
            <div class="comp-summary-row" style="margin-top:12px;">
              ${compStats.medianPrice ? `<div class="badge">Median comp price ${escapeHtml(formatCurrency(compStats.medianPrice))}</div>` : ''}
              ${compStats.medianPricePerSqft ? `<div class="badge">Median ${escapeHtml(formatCurrency(Math.round(compStats.medianPricePerSqft)))}/sqft</div>` : ''}
              ${compStats.closestDistance ? `<div class="badge">Closest comp ${escapeHtml(formatDistanceMiles(compStats.closestDistance))}</div>` : ''}
              <div class="badge">${escapeHtml(`${compStats.compCount || 0} selected comps`)}</div>
              <div class="badge">${escapeHtml(`Markers S and A-${String.fromCharCode(64 + Math.min((report.selectedComps || []).length, 6))}`)}</div>
            </div>
          </div>
        ` : ''}
        <div class="content-card">
          ${renderCompRows(report.selectedComps || [])}
        </div>
        </div>
        ${renderFooter('Property Summary Report · Comparable Sales')}
      </section>
    ` : ''}

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Readiness and preparation</div>
          <h2>Readiness dashboard</h2>
          <p class="muted">A structured prep dashboard showing score, risk, opportunity, top actions, and value at risk.</p>
        </div>
      </div>
      ${renderPriorityLegend()}
      <div class="dashboard-row">
        ${renderMetricCard('Overall readiness', `${readinessSummary.overallScore || 0}/100`, readinessSummary.label || 'Needs work', readinessTone)}
        ${renderMetricCard('Photo quality', `${photoSummary.averageQualityScore || 0}/100`, 'Prioritized retakes are listed in the photo analysis page')}
        ${renderMetricCard('Checklist completion', `${checklistSummary.progressPercent || 0}%`, `${checklistSummary.completedCount || 0}/${checklistSummary.totalCount || 0} complete`)}
        ${renderMetricCard('Launch status', readinessSummary.label || 'Needs work', consequenceFraming.summary || 'Address top blockers before listing launch.', readinessTone)}
      </div>
      <div class="dashboard-row" style="margin-top:14px;">
        <div class="callout-chip callout-chip-risk">
          <div class="metric-label">Biggest risk</div>
          <strong>${escapeHtml(readinessRiskHeadline || 'No dominant launch risk identified.')}</strong>
          <div style="margin-top:10px;"><span class="priority-badge priority-badge-p1">P1 Must fix</span></div>
        </div>
        <div class="callout-chip callout-chip-opportunity">
          <div class="metric-label">Biggest opportunity</div>
          <strong>${escapeHtml(readinessOpportunityHeadline || 'No major opportunity signal was detected.')}</strong>
          <div style="margin-top:10px;"><span class="priority-badge priority-badge-p2">P2 Should fix</span></div>
        </div>
      </div>
      <div class="content-card" style="margin-top:14px;">
        <div class="section-kicker">Top 3 actions</div>
        <h3>What to do first</h3>
        ${renderChecklistItems(
          topThreeActionLines.length ? topThreeActionLines : orderedNextSteps.slice(0, 3),
          'Use the launch checklist to define the first three prep actions.',
        )}
      </div>
      <div class="roi-hero-card" style="margin-top:14px;">
        <div class="section-kicker">Estimated value at risk</div>
        <div class="roi-hero-value">${escapeHtml(roiUpsideLabel)}</div>
        <div class="roi-hero-sub">${escapeHtml(roiCostLabel)}</div>
        ${roiComparisonLine ? `<div class="roi-hero-compare">${escapeHtml(roiComparisonLine)}</div>` : ''}
        <div class="roi-hero-sub">${escapeHtml(improvementEconomics.decisionMessage || improvementEconomics.summary || 'Complete the top actions to protect listing value.')}</div>
        <div class="roi-bar-shell">
          <div>
            <div class="metric-label">Potential upside</div>
            <div class="roi-bar"><div class="roi-bar-fill-upside" style="width:${roiUpsideWidth}%;"></div></div>
          </div>
          <div>
            <div class="metric-label">Estimated prep cost</div>
            <div class="roi-bar"><div class="roi-bar-fill-cost" style="width:${roiCostWidth}%;"></div></div>
          </div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Readiness & Preparation')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Photo analysis</div>
          <h2>Scored photo gallery</h2>
          <p class="muted">Each selected photo includes quality score, readiness label, and one-line feedback.</p>
        </div>
      </div>
      ${renderPriorityLegend()}
      <div class="metric-grid">
        ${renderMetricCard('Total photos', String(photoSummary.totalPhotos || 0))}
        ${renderMetricCard('Marketplace-ready', String(photoSummary.listingCandidateCount || 0))}
        ${renderMetricCard('Retakes needed', String(photoSummary.retakeCount || 0), photoSummary.retakeCount ? 'Prioritize P1 retakes before listing launch.' : 'No high-priority retakes currently flagged.')}
        ${renderMetricCard('Average quality', `${photoSummary.averageQualityScore || 0}/100`)}
      </div>
      <div class="content-card" style="margin-top:14px;">
        <div class="section-kicker">Selected photos</div>
        <h3>Gallery review</h3>
        <div class="page-spacer"></div>
        ${renderPhotoTiles([heroPhoto, ...remainingPhotos].filter(Boolean), 6)}
      </div>
      ${renderFooter('Property Summary Report · Photo Gallery')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Action plan</div>
          <h2>Top actions to unlock launch readiness</h2>
          <p class="muted">This page is intentionally concise: top actions first, execution support after.</p>
        </div>
      </div>
      <div class="dense-two-col" style="margin-top:14px;">
        <div class="content-card">
          <div class="section-kicker">Top 3 launch actions</div>
          <h3>Do these first</h3>
          ${renderChecklistItems(
            topThreeActionLines.length ? topThreeActionLines : orderedNextStepsPrimary,
            'Use the guided workflow in the app to continue the launch checklist.',
          )}
          <div class="page-spacer"></div>
          ${renderBulletList(
            pickMeaningfulLines([
              `Risk focus: ${readinessRiskHeadline}`,
              `Opportunity focus: ${readinessOpportunityHeadline}`,
              pricingInsightLines[0] ? `Pricing context: ${pricingInsightLines[0]}` : '',
            ], 3),
            '',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Execution cards</div>
          <h3>Highest-impact actions</h3>
          ${renderRecommendationActionCards(
            actionCardsPrimary.length ? actionCardsPrimary : actionCardsDisplay.slice(0, 2),
            'Use these structured actions to keep launch readiness improving.',
            { maxCards: 2, maxPerCategory: 1, compact: true },
          )}
        </div>
      </div>
      <div class="seller-final-band">
        <div class="section-kicker">Final call to action</div>
        <h3>Take the next conversion step now</h3>
        <p class="compact-copy" style="margin-top:8px;">Addressing these items before listing may improve first impressions and buyer engagement. Current photo quality may limit showing performance until top actions are completed.</p>
        <div class="badge-row">
          <div class="badge badge-contact">${escapeHtml(contactPhoneLabel)}</div>
          <div class="badge badge-contact">${escapeHtml(SUPPORT_EMAIL)}</div>
        </div>
        <div class="badge-row">
          <div class="brochure-cta-button">${escapeHtml(reportPrimaryCta)}</div>
          <div class="brochure-cta-button secondary">${escapeHtml(reportSecondaryCta)}</div>
        </div>
      </div>
      ${renderFooter('Property Summary Report · Action Plan')}
    </section>

    ${
      actionCardsOverflow.length || shouldRenderProviders || shouldRenderBuyerPersona || propertyFacts.length
        ? `
          <section class="page">
            <div class="brand-bar">
              <div>
                <div class="section-kicker">Action support</div>
                <h2>Supporting actions and launch resources</h2>
                <p class="muted">Additional actions are grouped by category so execution can stay organized and fast.</p>
              </div>
            </div>
            <div class="dense-two-col">
              <div class="content-card">
                <div class="section-kicker">Supporting action cards</div>
                <h3>Photo, interior, and pricing follow-through</h3>
                ${renderRecommendationActionCards(
                  actionCardsOverflow,
                  'No additional supporting actions are required beyond the top priorities.',
                  { maxCards: 3, maxPerCategory: 2, compact: true },
                )}
              </div>
              <div class="section-stack">
                ${
                  shouldRenderProviders
                    ? `
                      <div class="content-card">
                        <div class="section-kicker">Provider recommendations</div>
                        <h3>Marketplace support nearby</h3>
                        ${renderProviderCards(supportProviderRecommendations)}
                      </div>
                    `
                    : `
                      <div class="content-card">
                        <div class="section-kicker">Suggested provider categories</div>
                        <h3>Execution support options</h3>
                        ${renderSuggestedCategoryCards(supportSuggestedProviderCategories)}
                      </div>
                    `
                }
                ${
                  shouldRenderBuyerPersona
                    ? `
                      <div class="content-card">
                        <div class="section-kicker">Buyer persona</div>
                        <h3>Who this home should resonate with</h3>
                        <p class="muted">${escapeHtml(buyerPersonaSummary.buyerPersona || 'This home should appeal to buyers prioritizing layout clarity, practical room function, and a market-aligned price position.')}</p>
                      </div>
                    `
                    : ''
                }
                ${
                  propertyFacts.length
                    ? `
                      <div class="content-card">
                        <div class="section-kicker">Property details</div>
                        <h3>Core facts reference</h3>
                        <div class="fact-grid">
                          ${propertyFacts
                            .slice(0, 4)
                            .map(
                              (fact) => `
                                <div class="fact-row">
                                  <div class="fact-row-label">${escapeHtml(fact.label)}</div>
                                  <div>${escapeHtml(fact.value)}</div>
                                </div>
                              `,
                            )
                            .join('')}
                        </div>
                      </div>
                    `
                    : ''
                }
              </div>
            </div>
            ${renderFooter('Property Summary Report · Action Support')}
          </section>
        `
        : ''
    }

    ${
      shouldRenderReadinessContinuation
        ? `
          <section class="page">
            <div class="brand-bar">
              <div>
                <div class="section-kicker">Readiness and preparation</div>
                <h2 class="continuation-title">Readiness Dashboard (continued)</h2>
                <p class="muted">Extended action detail is continued here so cards and checklists stay intact and readable.</p>
              </div>
            </div>
            <div class="dense-two-col">
              <div class="content-card">
                <div class="section-kicker">Ordered launch steps (continued)</div>
                <h3>Additional next steps</h3>
                ${renderChecklistItems(
                  orderedNextStepsOverflow,
                  'The primary launch sequence is already listed on the action-plan page.',
                )}
              </div>
              <div class="content-card">
                <div class="section-kicker">Priority action cards (continued)</div>
                <h3>Additional prep moves</h3>
                ${renderRecommendationActionCards(
                  actionCardsOverflow,
                  'No additional action cards remain after the primary set.',
                  { maxCards: 3, maxPerCategory: 2, compact: true },
                )}
              </div>
            </div>
            ${
              readinessContinuationInsightsPrimary.length
                ? `
                  <div class="content-card" style="margin-top:14px;">
                    <div class="section-kicker">Additional readiness notes</div>
                    <h3>Extended risk and opportunity context</h3>
                    ${renderBulletList(
                      readinessContinuationInsightsPrimary,
                      'No additional readiness notes were required.',
                    )}
                  </div>
                `
                : ''
            }
            ${
              readinessContinuationInsightsOverflow.length
                ? `
                  <div class="content-card" style="margin-top:14px;">
                    <div class="section-kicker">Additional readiness notes</div>
                    <h3>More detail</h3>
                    ${renderBulletList(
                      readinessContinuationInsightsOverflow,
                      'No additional readiness notes were required.',
                    )}
                  </div>
                `
                : ''
            }
            ${renderFooter('Property Summary Report · Readiness Continuation')}
          </section>
        `
        : ''
    }
  `;

  return renderHtmlDocument({
    title: report.title || property.title || 'Property Summary Report',
    body,
  });
}

function buildMarketingReportHtml({ property, flyer }) {
  const propertyAddress = buildPropertyAddress(property);
  const neighborhoodMapImageUrl = flyer._resolvedNeighborhoodMapImageUrl || buildNeighborhoodMapImageUrl(property);
  const flyerMode = String(flyer.mode || 'launch_ready').toLowerCase();
  const modeLabel = flyer.modeLabel || titleCaseLabel(flyerMode.replace(/_/g, ' '));
  const ctaPrimaryLabel = flyerMode === 'preview' ? 'Get Property Details' : 'Request Showing';
  const ctaSecondaryLabel = ctaPrimaryLabel === 'Request Showing' ? 'Get Property Details' : 'Request Showing';
  const ctaLabel = ctaPrimaryLabel;
  const ctaButtonLabel = ctaPrimaryLabel;
  const contactPhoneLabel = SUPPORT_PHONE || 'Phone available on request';
  const previewUrgencyLine = 'Early inquiries are currently prioritized for this listing.';
  const readinessScore = Number(flyer?.readinessScore || flyer?.readinessSignals?.readinessScore || 0);
  const marketplaceReadyCount = Number(
    flyer?.readinessSignals?.marketplaceReadyCount ||
      (flyer?.selectedPhotos || []).filter((photo) => photo?.listingCandidate).length ||
      0,
  );
  const expectedFlyerMode = readinessScore < 50 || marketplaceReadyCount < 2
    ? 'preview'
    : readinessScore >= 70 && marketplaceReadyCount >= 3
      ? 'launch_ready'
      : 'preview';
  if (flyerMode !== expectedFlyerMode) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_mode_mismatch mode=${flyerMode} expected=${expectedFlyerMode} readiness=${readinessScore} marketplaceReady=${marketplaceReadyCount}`,
    );
  }
  if (!['request showing', 'get property details'].includes(String(ctaPrimaryLabel || '').toLowerCase())) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=cta_not_upgraded flyerMode=${flyerMode}`,
    );
  }
  const modeHeroSignal = flyerMode === 'preview'
    ? 'Preview mode: positioning this property as an early opportunity while final prep is completed.'
    : flyerMode === 'premium'
      ? 'Premium mode: polished presentation designed to convert high-intent buyer interest.'
      : 'Launch-ready mode: private showings and property-package requests available now.';
  const selectedPhotos = (flyer.selectedPhotos || []).filter((photo) => photo?.imageUrl);
  const prioritizedPhotos = selectFlyerGalleryPhotos(selectedPhotos, 10);
  const coverPhotos = prioritizedPhotos.slice(0, 4);
  const hasFourPhotoCover = coverPhotos.length >= 4;
  const heroPhoto = coverPhotos[0];
  const gallerySeed = hasFourPhotoCover ? prioritizedPhotos.slice(4, 10) : prioritizedPhotos.slice(1, 7);
  const galleryPhotos = gallerySeed.length
    ? gallerySeed
    : selectFlyerGalleryPhotos(prioritizedPhotos.slice(1), 6);
  const seededGalleryPhotos = ensureMinimumFlyerPhotos(
    galleryPhotos.length ? galleryPhotos : selectFlyerGalleryPhotos(prioritizedPhotos, 6),
    prioritizedPhotos,
    4,
    6,
  );
  const coverIdentities = new Set(
    coverPhotos
      .map((photo) => resolveFlyerPhotoIdentity(photo))
      .filter(Boolean),
  );
  const resolvedGalleryPhotos = [];
  const galleryIdentities = new Set();
  let replacedDuplicateImages = 0;
  const addUniqueGalleryPhoto = (photo, source = 'primary') => {
    if (!photo?.imageUrl) {
      return false;
    }
    const identity = resolveFlyerPhotoIdentity(photo);
    if (!identity || coverIdentities.has(identity) || galleryIdentities.has(identity)) {
      if (source === 'primary') {
        replacedDuplicateImages += 1;
      }
      return false;
    }
    galleryIdentities.add(identity);
    resolvedGalleryPhotos.push({
      ...photo,
      roomLabel: photo?.roomLabel || `${titleCaseLabel(flyerRoomBucket(photo?.roomLabel || 'property'))} photo`,
    });
    return true;
  };
  for (const photo of seededGalleryPhotos) {
    addUniqueGalleryPhoto(photo, 'primary');
  }
  const replacementPool = selectFlyerGalleryPhotos([...prioritizedPhotos, ...selectedPhotos], 12);
  for (const photo of replacementPool) {
    if (resolvedGalleryPhotos.length >= 6) {
      break;
    }
    addUniqueGalleryPhoto(photo, 'fallback');
  }
  if (resolvedGalleryPhotos.length < 4) {
    for (const photo of [...selectedPhotos, ...prioritizedPhotos]) {
      if (resolvedGalleryPhotos.length >= 4) {
        break;
      }
      addUniqueGalleryPhoto(photo, 'fallback');
    }
  }
  const narrativeGalleryPhotos = orderFlyerPhotosForNarrative(resolvedGalleryPhotos, 6);
  const galleryDuplicateCount = countDuplicateFlyerPhotos(narrativeGalleryPhotos);
  const galleryStatusNote = flyerMode === 'preview'
    ? 'Preview mode: this gallery uses the strongest currently selected listing photos.'
    : '';
  const flyerTextCorpus = [
    flyer?.headline,
    flyer?.subheadline,
    flyer?.summary,
    ...(flyer?.highlights || []),
    ...(selectedPhotos || []).map((photo) => photo?.listingNote || ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hasKitchenIslandSignal = /\bisland\b/.test(flyerTextCorpus);
  const hasCornerLotSignal = /\bcorner lot\b|\bcorner-lot\b/.test(flyerTextCorpus);
  const lotSizeSqFt = Number(property?.lotSizeSqFt || 0);
  const specificFeatureLines = pickMeaningfulLines([
    hasKitchenIslandSignal
      ? 'Kitchen island anchors prep, serving, and casual seating flow.'
      : '',
    lotSizeSqFt > 0
      ? `Lot size is approximately ${formatCompactNumber(lotSizeSqFt)} square feet with flexible backyard use potential.`
      : '',
    hasCornerLotSignal
      ? 'Corner-lot placement improves curb visibility and arrival presence.'
      : '',
    property?.squareFeet
      ? `${formatCompactNumber(property.squareFeet)} interior square feet supports clear room-to-room flow.`
      : '',
    property?.bedrooms
      ? `${property.bedrooms}-bedroom layout supports guest flexibility and work-from-home options.`
      : '',
  ], 4);
  const featureTags = pickMeaningfulLines((flyer.highlights || []).map((line) => rewriteGenericFlyerCopy(line)), 6);
  const topReasonsToBuy = [
    ...specificFeatureLines,
    ...(featureTags || []),
    property?.selectedListPrice ? `Positioned at ${formatCurrency(property.selectedListPrice)}` : '',
  ]
    .filter(Boolean)
    .slice(0, 6);
  const heroIdentityLine = rewriteGenericFlyerCopy(
    flyer.headline || property.title || 'Featured property',
  );
  const heroFeatureLine = rewriteGenericFlyerCopy(
    pickMeaningfulLines([
      specificFeatureLines[0],
      featureTags[0],
      'Bright, open living spaces with feature-forward flow and strong showing appeal.',
    ], 1)[0] || '',
  );
  const heroPositioningLineCandidates = pickMeaningfulLines([
    specificFeatureLines.find((line) => /corner|lot|backyard/i.test(String(line || ''))),
    property?.city ? `Located in ${titleCaseLabel(property.city)} with lifestyle convenience and practical daily access.` : '',
    property?.selectedListPrice ? `Strategically positioned at ${formatCurrency(property.selectedListPrice)} for qualified buyer demand.` : '',
  ], 3);
  const normalizedHeroFeatureLine = String(heroFeatureLine || '').trim().toLowerCase();
  const heroPositioningLine = rewriteGenericFlyerCopy(
    heroPositioningLineCandidates.find((line) => String(line || '').trim().toLowerCase() !== normalizedHeroFeatureLine) || '',
  );
  const brochureSummary = hasMeaningfulValue(flyer.summary)
    ? rewriteGenericFlyerCopy(shortenNarrative(flyer.summary, 2))
    : pickMeaningfulLines([
        specificFeatureLines[0],
        specificFeatureLines[1],
        property?.selectedListPrice ? `Positioned at ${formatCurrency(property.selectedListPrice)} with buyer-ready marketing sequencing.` : '',
      ], 2).join(' ');
  const lifestyleContext = buildNeighborhoodContext(property);
  const featureGridItems = pickMeaningfulLines([
    ...specificFeatureLines,
    ...featureTags,
    property?.selectedListPrice ? `Seller-confirmed list price ${formatCurrency(property.selectedListPrice)}` : '',
  ], 6);
  const highlightsFeatureItems = featureGridItems.slice(0, 4);
  const keyHighlightsColumnClass = narrativeGalleryPhotos.length ? 'col-span-5' : 'col-span-12';
  const neighborhoodHighlights = pickMeaningfulLines([
    topReasonsToBuy.find((line) => /(school|park|trail|community|walk|retail|dining)/i.test(String(line || ''))),
    lifestyleContext,
    property?.city ? `${property.city} location supports daily convenience, lifestyle access, and showing appeal.` : '',
    property?.selectedListPrice ? `Price point ${formatCurrency(property.selectedListPrice)} aligns with current buyer search bands in this area.` : '',
    'Balanced neighborhood positioning supports both immediate move-in buyers and long-term value-focused buyers.',
  ], 3);
  const commuteNotes = pickMeaningfulLines([
    property?.city && property?.state ? `Commuter note: ${property.city}, ${property.state} offers multiple corridor options for daily travel patterns.` : '',
    'Local retail corridors and services are positioned for practical day-to-day access.',
    'Nearby amenities can improve showing conversations by helping buyers visualize everyday routines.',
  ], 2);
  const positioningOutcomeLines = pickMeaningfulLines([
    property?.selectedListPrice
      ? `Price positioning at ${formatCurrency(property.selectedListPrice)} supports a clear value narrative for qualified buyers.`
      : 'Pricing posture supports a clear value narrative for qualified buyers.',
    narrativeGalleryPhotos.length
      ? 'Image sequencing is structured from arrival impact to core living flow for faster buyer comprehension.'
      : '',
    'Feature-forward copy and neighborhood context are designed to move buyers from interest to showing request.',
  ], 2);
  const shouldRenderMapPage = Boolean(
    neighborhoodMapImageUrl ||
      neighborhoodHighlights.length ||
      commuteNotes.length ||
      positioningOutcomeLines.length,
  );
  const brochureFactBadges = pickMeaningfulLines([
    property?.bedrooms ? `${property.bedrooms} bedrooms` : '',
    property?.bathrooms ? `${property.bathrooms} bathrooms` : '',
    formatSqftValue(property?.squareFeet),
    formatPropertyTypeLabel(property?.propertyType),
    modeLabel ? `${modeLabel} mode` : '',
  ], 4);
  const flyerMapCount = neighborhoodMapImageUrl ? 1 : 0;
  const combinedDuplicateCount = countDuplicateFlyerPhotos([...coverPhotos, ...narrativeGalleryPhotos]);
  if (narrativeGalleryPhotos.length < 4) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_photo_count_low count=${narrativeGalleryPhotos.length}`,
    );
  }
  if (!narrativeGalleryPhotos.length) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_gallery_empty`,
    );
  }
  if (replacedDuplicateImages > 0) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_duplicate_images_replaced count=${replacedDuplicateImages}`,
    );
  }
  if (galleryDuplicateCount > 0) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_duplicate_images_remaining count=${galleryDuplicateCount}`,
    );
  }
  if (combinedDuplicateCount > 0) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_cover_gallery_duplicates count=${combinedDuplicateCount}`,
    );
  }
  if (flyerMapCount > 1) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_map_count_invalid count=${flyerMapCount}`,
    );
  }
  if (shouldRenderMapPage && neighborhoodHighlights.length < 2 && commuteNotes.length < 1) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_context_sparse`,
    );
  }
  if (!specificFeatureLines.length) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_copy_generic`,
    );
  }
  if (!shouldRenderMapPage) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_structure_incomplete`,
    );
  }
  const neighborhoodDedupKeySet = new Set(
    [...neighborhoodHighlights, ...commuteNotes].map((line) => String(line || '').toLowerCase().trim()).filter(Boolean),
  );
  if (neighborhoodDedupKeySet.size < [...neighborhoodHighlights, ...commuteNotes].filter(Boolean).length) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=flyer_neighborhood_repetition_detected`,
    );
  }
  if (
    containsPlaceholderLanguage(flyer.headline) ||
    containsPlaceholderLanguage(flyer.subheadline) ||
    containsPlaceholderLanguage(flyer.summary) ||
    containsPlaceholderLanguage(galleryStatusNote)
  ) {
    console.warn(
      `[pdf] validation_warning propertyId=${property?.id || property?._id?.toString?.() || ''} issue=placeholder_language_detected flyer=true`,
    );
  }

  const body = `
    <section class="page">
      <div class="brochure-cover">
        ${
          hasFourPhotoCover
            ? `
              <div class="brochure-cover-media-grid">
                ${coverPhotos
                  .map((photo) => `<img src="${escapeHtml(photo.imageUrl || '')}" alt="${escapeHtml(photo.roomLabel || 'Property photo')}" />`)
                  .join('')}
              </div>
            `
            : heroPhoto?.imageUrl
              ? `<img src="${escapeHtml(heroPhoto.imageUrl)}" alt="${escapeHtml(heroPhoto.roomLabel || 'Hero property photo')}" />`
              : ''
        }
        <div class="brochure-cover-overlay">
          <div class="brand-kicker">Workside Home Advisor · Marketing Report</div>
          <div class="brochure-price">${escapeHtml(property?.selectedListPrice ? `Starting at ${formatCurrency(property.selectedListPrice)}` : flyer.priceText || 'Pricing on request')}</div>
          <h1>${escapeHtml(heroIdentityLine)}</h1>
          <p class="lede" style="margin-top:12px;"><strong>${escapeHtml(heroFeatureLine || brochureSummary)}</strong></p>
          ${heroPositioningLine ? `<p class="compact-copy" style="margin-top:8px;color:rgba(255,255,255,0.88);">${escapeHtml(heroPositioningLine)}</p>` : ''}
          <div class="hero-signal-row" style="margin-top:14px;">
            <div class="hero-signal-chip hero-signal-chip-orange">${escapeHtml(modeHeroSignal)}</div>
          </div>
          ${flyerMode === 'preview' ? `<div class="preview-urgency">${escapeHtml(previewUrgencyLine)}</div>` : ''}
          <div class="brochure-cover-facts">
            ${brochureFactBadges.map((item) => `<div class="brochure-cover-fact">${escapeHtml(item)}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="brochure-cover-lower">
        <div class="content-card">
          <div class="section-kicker">Buyer appeal</div>
          <h3>Why this home stands out</h3>
            ${renderFeatureIconGrid(featureGridItems, 'This brochure highlights the features most likely to drive buyer interest and showing activity.')}
        </div>
        <div class="brochure-cta-card">
          <div class="section-kicker">Call to action</div>
          <h3>${escapeHtml(ctaLabel)}</h3>
          ${flyerMode === 'preview' ? `<p class="compact-copy" style="margin-top:8px;"><strong>${escapeHtml(previewUrgencyLine)}</strong></p>` : ''}
          <p class="compact-copy" style="margin-top:10px;">Prepared by Workside Home Advisor to support a polished listing launch, clearer buyer positioning, and smoother showing conversations.</p>
          <div class="badge-row">
            <div class="badge badge-address">${escapeHtml(propertyAddress)}</div>
            <div class="badge badge-contact">${escapeHtml(contactPhoneLabel)}</div>
            <div class="badge badge-contact">${escapeHtml(SUPPORT_EMAIL)}</div>
          </div>
          <div class="cta-button-row">
            <div class="brochure-cta-button">${escapeHtml(ctaButtonLabel)}</div>
            <div class="brochure-cta-button secondary">${escapeHtml(ctaSecondaryLabel)}</div>
          </div>
        </div>
      </div>
      ${renderFooter('Marketing Report · Cover')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Highlights and gallery</div>
          <h2>Visual story and feature proof</h2>
          <p class="muted">A brochure-style spread focused on what buyers notice first.</p>
        </div>
      </div>
      <div class="brochure-main-grid layout-grid-12">
        <div class="content-card ${keyHighlightsColumnClass}">
          <div class="section-kicker">Key highlights</div>
          <h3>Most marketable features</h3>
          ${renderFeatureIconGrid(
            highlightsFeatureItems.length ? highlightsFeatureItems : topReasonsToBuy.slice(0, 4),
            'Feature copy is anchored to concrete property details and photo-backed signals.',
          )}
        </div>
        ${narrativeGalleryPhotos.length ? `
        <div class="content-card marketing-gallery-card col-span-7">
          <div class="section-kicker">Photo gallery</div>
          <h3>Curated visual sequence</h3>
          ${
            galleryStatusNote
              ? `<p class="muted"><strong>${escapeHtml(galleryStatusNote)}</strong></p>`
              : ''
          }
          ${renderFlyerGalleryTiles(narrativeGalleryPhotos)}
        </div>
        ` : ''}
      </div>
      ${renderFooter('Marketing Report · Highlights & Gallery')}
    </section>

    <section class="page">
      <div class="brand-bar">
        <div>
          <div class="section-kicker">Pricing and positioning</div>
          <h2>Value story and buyer positioning</h2>
          <p class="muted">Pricing clarity and feature-backed positioning to support serious inquiries.</p>
        </div>
      </div>
      <div class="two-col">
        <div class="content-card">
          <div class="section-kicker">Pricing posture</div>
          <h3>${escapeHtml(flyer.priceText || 'Pricing on request')}</h3>
          ${renderInsightList(
            pickMeaningfulLines([
              property?.selectedListPrice
                ? `Positioned at ${formatCurrency(property.selectedListPrice)} to balance buyer urgency and perceived value.`
                : 'Positioned to align with recent comparable sales and current buyer demand.',
              topReasonsToBuy[0] ? `Primary buyer signal: ${topReasonsToBuy[0]}` : '',
              'Pricing communication should stay consistent across listing channels and showing conversations.',
            ], 3),
            '',
          )}
        </div>
        <div class="content-card">
          <div class="section-kicker">Positioning details</div>
          <h3>Feature-backed narrative</h3>
          ${renderBulletList(
            pickMeaningfulLines([
              ...specificFeatureLines,
              ...featureTags,
              property?.selectedListPrice ? `List-price strategy currently centers on ${formatCurrency(property.selectedListPrice)}.` : '',
            ], 5),
            'Feature-backed positioning should stay concise and specific.',
          )}
          ${flyerMode === 'preview' ? `<p class="compact-copy" style="margin-top:8px;"><strong>${escapeHtml(previewUrgencyLine)}</strong></p>` : ''}
        </div>
      </div>
      ${renderFooter('Marketing Report · Pricing & Positioning')}
    </section>

    ${
      shouldRenderMapPage
        ? `
          <section class="page">
            <div class="brand-bar">
              <div>
                <div class="section-kicker">Neighborhood and positioning</div>
                <h2>Local context and pricing posture</h2>
                <p class="muted">Neighborhood fit, practical convenience, and final showing call-to-action in one concise page.</p>
              </div>
            </div>
            <div class="two-col flyer-context-grid">
              <div class="content-card">
                <div class="section-kicker">Neighborhood</div>
                <h3>Local context</h3>
                ${
                  neighborhoodMapImageUrl
                    ? `
                      <div class="map-frame compact" style="margin-top:12px;">
                        <img src="${escapeHtml(neighborhoodMapImageUrl)}" alt="Neighborhood map" onerror="this.closest('.map-frame').style.display='none';" />
                      </div>
                    `
                    : ''
                }
                <p class="muted" style="margin-top:10px;">${escapeHtml(propertyAddress)}</p>
                <div class="badge-row">
                  <div class="badge">${escapeHtml(property?.selectedListPrice ? `Starting at ${formatCurrency(property.selectedListPrice)}` : flyer.priceText || 'Pricing on request')}</div>
                  <div class="badge">${escapeHtml('Neighborhood-lifestyle positioning')}</div>
                </div>
                <div class="page-spacer"></div>
                <div class="section-kicker">Area benefits</div>
                ${renderBulletList(
                  neighborhoodHighlights.slice(0, 3),
                  'Neighborhood positioning aligns with buyer priorities and showing-readiness goals.',
                )}
              </div>
              <div class="content-card">
                <div class="section-kicker">Why this positioning works</div>
                <h3>Built to convert serious buyer interest</h3>
                ${renderInsightList(
                  positioningOutcomeLines,
                  '',
                )}
                <div class="page-spacer"></div>
                <div class="section-kicker">Commute and local convenience</div>
                <h3>How the area supports day-to-day living</h3>
                ${renderBulletList(
                  commuteNotes.slice(0, 2),
                  'Everyday convenience and local access strengthen this home’s buyer appeal.',
                )}
                <div class="page-spacer"></div>
                <div class="section-kicker">Urgency and contact</div>
                <h3>${escapeHtml(ctaLabel)}</h3>
                ${flyerMode === 'preview' ? `<p class="compact-copy" style="margin-top:8px;"><strong>${escapeHtml(previewUrgencyLine)}</strong></p>` : ''}
                <div class="badge-row">
                  <div class="badge badge-contact">${escapeHtml(contactPhoneLabel)}</div>
                  <div class="badge badge-contact">${escapeHtml(SUPPORT_EMAIL)}</div>
                  <div class="badge badge-contact">${escapeHtml(PUBLIC_WEB_URL)}</div>
                </div>
                <div class="cta-button-row">
                  <div class="brochure-cta-button">${escapeHtml(ctaButtonLabel)}</div>
                  <div class="brochure-cta-button secondary">${escapeHtml(ctaSecondaryLabel)}</div>
                </div>
              </div>
            </div>
            ${renderFooter('Marketing Report · Neighborhood & Positioning')}
          </section>
        `
        : ''
    }
  `;

  return renderHtmlDocument({
    title: flyer.headline || property.title || 'Marketing Report',
    body,
  });
}

export async function renderPropertySummaryPdf({ property, report, filename }) {
  const html = buildPropertySummaryHtml({
    property,
    report: {
      ...report,
      _resolvedCompMapImageUrl: await resolveStaticMapImageUrl(
        buildComparableMapImageUrl(property, report.selectedComps || []),
      ),
    },
  });
  return renderHtmlPdf({ html, filename });
}

export async function renderMarketingReportPdf({ property, flyer, filename }) {
  const html = buildMarketingReportHtml({
    property,
    flyer: {
      ...flyer,
      _resolvedNeighborhoodMapImageUrl: await resolveStaticMapImageUrl(
        buildNeighborhoodMapImageUrl(property),
      ),
    },
  });
  return renderHtmlPdf({ html, filename });
}

function getPuppeteerLaunchOptions({ protocolTimeout = 120000 } = {}) {
  return {
    headless: 'new',
    executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=medium',
    ],
  };
}

export async function probePdfBrowserAvailability({ timeoutMs = 12000 } = {}) {
  let browser;
  const startedAt = Date.now();
  try {
    browser = await puppeteer.launch(
      getPuppeteerLaunchOptions({
        protocolTimeout: Math.max(5000, Number(timeoutMs) || 12000),
      }),
    );
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 640, deviceScaleFactor: 1 });
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"></head><body>pdf-health-check</body></html>',
      { waitUntil: 'domcontentloaded' },
    );
    const browserVersion = await browser.version();
    await page.close();

    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      browserVersion,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
      message: error?.message || String(error),
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function renderHtmlPdf({ html, filename }) {
  let browser;
  const startedAt = Date.now();
  try {
    logPdfEvent('launch_start', {
      filename,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || 'bundled',
      nodeEnv: env.NODE_ENV,
    });
    browser = await puppeteer.launch(getPuppeteerLaunchOptions());
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1280, height: 1660, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const bytes = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    const renderedPdf = await PDFDocument.load(bytes);
    await page.close();
    logPdfEvent('render_success', {
      filename,
      durationMs: Date.now() - startedAt,
      pageCount: renderedPdf.getPageCount(),
      bytes: bytes.length,
    });
    return { bytes, filename };
  } catch (error) {
    logPdfEvent('render_failure', {
      filename,
      durationMs: Date.now() - startedAt,
      message: error?.message || String(error),
    });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
